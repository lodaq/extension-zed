import io
import json
import multiprocessing.connection as ipc
import os
from pathlib import Path
import struct
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

import install
from zed_limiter import Store, LEASE, day_at, hostname, matches, peer_pid, read_exact, verify_bridge


class LimiterTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "state.json"
        self.now = 1800000000.0
        self.policies = []
        self.store = Store(self.path, lambda rules: self.policies.append(rules), lambda: self.now)

    def add(self, mode="block", minutes=1, host="example.com"):
        return self.store.handle({"action": "add", "url": host, "mode": mode, "minutes": minutes})

    def report(self, url="https://example.com/path?secret=hidden"):
        return self.store.handle({"action": "report", "url": url})

    def test_locked_block_has_no_replacement_or_unblock_api(self):
        self.add()
        for action in ("remove", "reset", "shorten", "pause", "unblock"):
            with self.assertRaises(ValueError):
                self.store.handle({"action": action, "url": "example.com"})
        with self.assertRaises(ValueError):
            self.add(minutes=100)
        self.store.handle({"action": "report", "url": "", "until": 0, "used": 0, "rules": []})
        self.assertEqual(self.policies[-1], ["example.com"])
        self.assertEqual(len(json.loads(self.path.read_text())["rules"]), 1)

    def test_timed_rule_survives_restart_and_expires(self):
        self.add()
        restarted = Store(self.path, lambda rules: self.policies.append(rules), lambda: self.now)
        self.assertEqual(self.policies[-1], ["example.com"])
        self.now += 59
        restarted.tick()
        self.assertEqual(self.policies[-1], ["example.com"])
        self.now += 1
        restarted.tick()
        self.assertEqual(self.policies[-1], [])
        self.assertEqual(restarted.handle({"action": "status"})["rules"], [])

    def test_only_foreground_usage_counts_and_totals_are_service_owned(self):
        self.add("daily")
        self.report()
        self.now += 20
        result = self.report("https://other.com")
        self.assertEqual(result["rules"][0]["used"], 20000)
        self.now += 20
        self.report("")
        result = self.store.handle({"action": "report", "url": "https://example.com", "used": -999, "day": "tomorrow", "until": 0})
        self.assertEqual(result["rules"][0]["used"], 20000)
        self.now += 40
        result = self.report()
        self.assertTrue(result["rules"][0]["locked"])
        self.assertEqual(self.policies[-1], ["example.com"])
        self.assertNotIn("secret", self.path.read_text())
        self.assertNotIn("/path", self.path.read_text())

    def test_missing_reports_lock_and_reconnect_cannot_unlock(self):
        self.add("daily", 30)
        self.report("")
        self.now += LEASE + 1
        self.store.tick()
        result = self.report("")
        self.assertTrue(result["rules"][0]["locked"])
        self.assertEqual(self.policies[-1], ["example.com"])

    def test_restart_locks_daily_rule_without_losing_used_minutes(self):
        self.add("daily", 30)
        self.report()
        self.now += 10
        self.report()
        restarted = Store(self.path, lambda rules: None, lambda: self.now)
        result = restarted.handle({"action": "report", "url": ""})
        self.assertTrue(result["rules"][0]["locked"])
        self.assertEqual(result["rules"][0]["used"], 10000)

    def test_day_rollover_resets_only_with_healthy_reporting(self):
        import datetime as dt
        self.now = dt.datetime(2028, 1, 1, 23, 58, 50, tzinfo=dt.timezone.utc).timestamp()
        self.add("daily")
        self.report()
        self.now += 30
        self.report()
        self.now += 30
        self.report()
        self.assertTrue(self.store.state["rules"][0]["locked"])
        self.now += 30
        rule = self.report()["rules"][0]
        self.assertFalse(rule["locked"])
        self.assertEqual(rule["day"], day_at(self.now))
        self.assertEqual(rule["used"], 20000)  # 00:00:00 through 00:00:20

    def test_clock_rollback_cannot_release_a_rule(self):
        self.add()
        self.now -= 86400
        self.store.tick()
        self.assertEqual(self.policies[-1], ["example.com"])

    def test_policy_failure_is_not_acknowledged_and_state_is_retained(self):
        def fail(_):
            raise OSError("disk failure")
        self.store.publish = fail
        with self.assertRaises(OSError):
            self.add()
        self.assertEqual(json.loads(self.path.read_text())["rules"][0]["host"], "example.com")
        self.store.publish = lambda rules: self.policies.append(rules)
        self.store.tick()
        self.assertEqual(self.policies[-1], ["example.com"])

    def test_validation_rejects_policy_injection_and_bad_durations(self):
        for host in ("*", "example.com/*", "file:///etc/hosts", "chrome://policy", "https://user:pass@example.com", "127.0.0.1", "localhost", "[*.]example.com", "example.com\n*.other.com"):
            # A valid URL path is intentionally ignored; not copied into policy.
            if host == "example.com/*":
                self.assertEqual(hostname(host), "example.com")
            else:
                with self.subTest(host=host), self.assertRaises(ValueError):
                    hostname(host)
        for minutes in (True, 0, -1, 1.5, "1", 525601):
            with self.subTest(minutes=minutes), self.assertRaises(ValueError):
                self.add(minutes=minutes)
        with self.assertRaises(ValueError):
            self.add(mode="daily", minutes=1441)

    def test_normalization_and_domain_boundaries(self):
        self.assertEqual(hostname("https://WWW.Example.COM./a?q=1"), "example.com")
        self.assertEqual(hostname("https://bücher.example"), "xn--bcher-kva.example")
        self.assertTrue(matches("https://a.example.com", "example.com"))
        self.assertFalse(matches("https://example.com.attacker.test", "example.com"))
        self.assertFalse(matches("https://notexample.com", "example.com"))

    def test_native_framing_rejects_truncated_input(self):
        self.assertEqual(read_exact(io.BytesIO(struct.pack("=I", 1)), 4), struct.pack("=I", 1))
        with self.assertRaises(EOFError):
            read_exact(io.BytesIO(b"abc"), 4)

    @unittest.skipIf(sys.platform == "win32", "Unix peer credential test")
    def test_kernel_peer_identity_rejects_an_unrelated_local_process(self):
        address = str(Path(self.directory.name) / "test.sock")
        listener = ipc.Listener(address, family="AF_UNIX")
        self.addCleanup(listener.close)
        def connect():
            with ipc.Client(address, family="AF_UNIX") as client:
                client.send_bytes(b"{}")
        thread = threading.Thread(target=connect)
        thread.start()
        with listener.accept() as connection:
            self.assertEqual(peer_pid(connection), os.getpid())
            with self.assertRaises(PermissionError):
                verify_bridge(connection, {"python": sys.executable, "browsers": ["/no-trusted-browser"]})
        thread.join(timeout=2)
        self.assertFalse(thread.is_alive())

    def test_bridge_accepts_only_expected_runtime_launcher_and_browser(self):
        config = {"python": sys.executable, "browsers": ["/trusted/browser"], "launcher": "/trusted/zed-native.exe"}
        with patch("zed_limiter.peer_pid", return_value=123), patch("zed_limiter.process_info", side_effect=[(456, sys.executable), (789, "/trusted/browser")]), patch("zed_limiter.sys.platform", "linux"):
            verify_bridge(None, config)
        with patch("zed_limiter.peer_pid", return_value=123), patch("zed_limiter.process_info", side_effect=[(456, sys.executable), (789, "/untrusted/browser")]), patch("zed_limiter.sys.platform", "linux"):
            with self.assertRaises(PermissionError):
                verify_bridge(None, config)

    def test_bundle_generation_has_exact_origin_and_all_platform_services(self):
        output = Path(self.directory.name) / "bundle"
        extension_id = "a" * 32
        install.bundle(output, extension_id, {}, "https://example.com/update.xml")
        for platform in ("linux", "windows", "macos"):
            native = json.loads((output / platform / "com.extension_zed.limiter.json").read_text())
            self.assertEqual(native["allowed_origins"], [f"chrome-extension://{extension_id}/"])
            config = json.loads((output / platform / "config.json").read_text())
            self.assertEqual(config["policies"]["ExtensionDeveloperModeSettings"], 1)
            self.assertEqual(config["policies"]["DeveloperToolsAvailability"], 2)
            self.assertFalse(config["policies"]["NativeMessagingUserLevelHosts"])
        self.assertTrue((output / "linux/extension-zed.service").exists())
        self.assertTrue((output / "macos/extension-zed.mobileconfig").exists())
        self.assertTrue((output / "install-windows.ps1").exists())
        with self.assertRaises(ValueError):
            install.bundle(output, "*", {}, "https://example.com/update.xml")


if __name__ == "__main__":
    unittest.main()
