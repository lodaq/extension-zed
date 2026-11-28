import io
import json
import os
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import Mock, patch

from zed_downloader import HOST, Host, MAX_MESSAGE, format_error, media_info, read_message, safe_name, valid_directory, valid_url
from install import discover_ids, install, setup


def fixture():
    return {"title": "A video", "uploader": "Creator", "duration": 65, "webpage_url": "https://example.com/watch",
            "formats": [
                {"format_id": "4k", "height": 2160, "ext": "webm", "vcodec": "vp9", "acodec": "none", "tbr": 5000},
                {"format_id": "hd", "height": 1080, "ext": "mp4", "vcodec": "avc1", "acodec": "none", "filesize": 1000},
                {"format_id": "av1", "height": 1080, "ext": "webm", "vcodec": "av01", "acodec": "none", "tbr": 4000},
                {"format_id": "single", "height": 720, "ext": "mp4", "vcodec": "avc1", "acodec": "aac", "filesize_approx": 800},
                {"format_id": "aac", "ext": "m4a", "vcodec": "none", "acodec": "mp4a", "abr": 128, "filesize": 200},
                {"format_id": "opus", "ext": "webm", "vcodec": "none", "acodec": "opus", "abr": 160},
                {"format_id": "drm", "height": 4320, "vcodec": "avc1", "has_drm": True},
                {"format_id": "bad+selector", "height": 8000, "vcodec": "avc1"},
            ]}


class DownloaderTests(unittest.TestCase):
    def make_host(self, root):
        with patch("zed_downloader.shutil.which", side_effect=lambda name: "/bin/" + name):
            host = Host(Mock(), root)
        host.url = "https://example.com/watch?x=$(bad)"
        host.media = media_info(fixture(), True)
        return host

    def test_url_boundary(self):
        for url in ["file:///etc/passwd", "javascript:alert(1)", "--exec=bad", "https://user:secret@example.com", "https://example.com/\ncommand", "https://"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                valid_url(url)
        self.assertEqual(valid_url(" https://example.com/a?x=$(bad) "), "https://example.com/a?x=$(bad)")

    def test_native_framing_and_limits(self):
        payload = json.dumps({"id": "1", "command": "ping"}).encode()
        frame = struct.pack("=I", len(payload)) + payload
        class Chunked(io.BytesIO):
            def read(self, size=-1):
                return super().read(min(size, 2))
        self.assertEqual(read_message(Chunked(frame))["command"], "ping")
        self.assertIsNone(read_message(io.BytesIO()))
        for frame in [frame[:-1], struct.pack("=I", MAX_MESSAGE + 1)]:
            with self.assertRaises(ValueError):
                read_message(io.BytesIO(frame))

    def test_formats_derive_selection_sizes_and_tags(self):
        media = media_info(fixture(), True)
        self.assertEqual([r["label"] for r in media["video"]], ["2160p", "1080p", "720p"])
        self.assertEqual(media["video"][0]["tags"], ["Best quality"])
        hd = media["video"][1]
        self.assertEqual(hd["selector"], "hd+opus")
        self.assertIn("Most compatible", hd["tags"])
        self.assertEqual(hd["size"], 0)  # Combined total is unknown when one stream has no size.
        self.assertIn("Recommended", media["audio"][0]["tags"])
        self.assertEqual(media["audio"][-1]["id"], "mp3:opus")
        no_ffmpeg = media_info(fixture(), False)
        self.assertEqual([r["id"] for r in no_ffmpeg["video"]], ["video:single"])
        self.assertTrue(no_ffmpeg["video"][0]["approximate"])
        self.assertFalse(any(r["id"].startswith("mp3:") for r in no_ffmpeg["audio"]))

    def test_rejects_unlisted_selector_and_arbitrary_file(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            for command in [{"command": "download", "formatId": "hd+arbitrary"}, {"command": "open", "path": "/etc/passwd"}]:
                with self.assertRaises(ValueError):
                    host.handle({"id": "1", **command})
            public = host.public_state()
            self.assertNotIn("selector", public["media"]["video"][0])

    def test_direct_files_without_resolution_are_selectable(self):
        media = media_info({"title": "Direct video", "formats": [{"format_id": "mp4", "ext": "mp4"}]}, True)
        self.assertEqual(media["video"][0]["label"], "Original")
        self.assertEqual(media["audio"][0]["id"], "mp3:mp4")
        self.assertEqual(media["audio"][0]["size"], 0)

    def test_prefers_direct_https_formats_over_m3u8_hls(self):
        media = media_info({
            "title": "YouTube video",
            "formats": [
                {"format_id": "270", "height": 1080, "ext": "mp4", "vcodec": "avc1.640028", "acodec": "none", "tbr": 4684, "protocol": "m3u8_native"},
                {"format_id": "137", "height": 1080, "ext": "mp4", "vcodec": "avc1.640028", "acodec": "none", "tbr": 1534, "protocol": "https", "filesize": 97000000},
                {"format_id": "140-0", "ext": "m4a", "vcodec": "none", "acodec": "mp4a.40.2", "abr": 129, "protocol": "https", "filesize": 8000000},
            ],
        }, True)
        self.assertEqual(media["video"][0]["id"], "video:137")
        self.assertEqual(media["video"][0]["size"], 105000000)

    def test_new_link_clears_previous_format_selectors(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            with patch("zed_downloader.threading.Thread"):
                host.handle({"id": "2", "command": "formats", "url": "https://example.com/other"})
            self.assertIsNone(host.media)
            self.assertNotIn("media", host.public_state())

    def test_download_progress_arguments_and_preserves_previous_files(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            original = Path(root) / "earlier.mp4"
            original.write_bytes(b"old")
            process = Mock(returncode=0)
            process.poll.return_value = 0
            def spawn(args):
                staging = Path(args[args.index("--paths") + 1])
                result = staging / "A_video.mp4"
                result.write_bytes(b"new")
                process.stdout = iter(['ZED_PROGRESS {"downloaded_bytes":5,"total_bytes":10,"speed":2,"eta":3}',
                                       'ZED_STAGE processing', 'ZED_FILE ' + json.dumps(str(result))])
                host.process = process
                return process
            with patch.object(host, "spawn", side_effect=spawn) as launch:
                host.download(host.media["video"][1])
            args = launch.call_args.args[0]
            self.assertEqual(args[-2:], ["--", host.url])
            self.assertEqual(args[args.index("--format") + 1], "hd+opus")
            self.assertEqual(host.completed.read_bytes(), b"new")
            self.assertEqual(original.read_bytes(), b"old")
            self.assertFalse(list(Path(root).glob(".zed-*")))
            self.assertEqual(host.state["phase"], "done")
            snapshots = [call.args[0]["state"] for call in host.emit.call_args_list]
            self.assertTrue(any(s.get("pct") == 50 for s in snapshots))
            self.assertTrue(any(s.get("stage") == "Merging video and audio…" for s in snapshots))

    def test_download_folder_validation_and_custom_destination(self):
        self.assertEqual(valid_directory(" ~/Videos/Clips "), Path.home() / "Videos" / "Clips")
        for value in ["", "relative/path", "bad\npath", "--exec=bad"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                valid_directory(value)
        with tempfile.TemporaryDirectory() as root:
            file_path = Path(root) / "not-a-folder"
            file_path.write_bytes(b"x")
            with self.assertRaises(ValueError):
                valid_directory(str(file_path))
            host = self.make_host(root)
            folder = Path(root) / "Custom folder"
            process = Mock(returncode=0)
            process.poll.return_value = 0
            def spawn(args):
                staging = Path(args[args.index("--paths") + 1])
                result = staging / "A_video.mp4"
                result.write_bytes(b"new")
                process.stdout = iter(['ZED_FILE ' + json.dumps(str(result))])
                host.process = process
                return process
            with patch.object(host, "spawn", side_effect=spawn):
                host.download(host.media["video"][1], "Clip", folder)
            self.assertEqual(host.completed.parent, folder)
            self.assertEqual(host.completed_root, folder)
            self.assertEqual(host.state["directory"], str(folder))
            self.assertEqual(host.completed.read_bytes(), b"new")
            self.assertFalse(list(folder.glob(".zed-*")))

    def test_handle_passes_validated_directory_to_download(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            folder = Path(root) / "Chosen"
            with patch("zed_downloader.threading.Thread"):
                reply = host.handle({"id": "1", "command": "download", "formatId": "video:hd", "directory": str(folder)})
            self.assertEqual(reply["state"]["phase"], "downloading")
            self.assertEqual(reply["state"]["directory"], str(folder))
            host.thread = None
            for directory in ["relative", "", "bad\npath"]:
                with self.subTest(directory=directory), self.assertRaises(ValueError):
                    host.handle({"id": "2", "command": "download", "formatId": "video:hd", "directory": directory})

    def test_custom_file_name_stays_inside_output_and_never_overwrites(self):
        self.assertEqual(safe_name(" My: video?.mp4 "), "My_ video_.mp4")
        self.assertEqual(safe_name("../../etc/passwd"), "_.._etc_passwd")
        self.assertEqual(safe_name("CON.mp4"), "_CON.mp4")
        self.assertEqual(safe_name("   "), "")
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            existing = Path(root) / "Clip.mp4"
            existing.write_bytes(b"old")
            process = Mock(returncode=0)
            process.poll.return_value = 0
            def spawn(args):
                staging = Path(args[args.index("--paths") + 1])
                result = staging / "A_video.mp4"
                result.write_bytes(b"new")
                process.stdout = iter(['ZED_FILE ' + json.dumps(str(result))])
                host.process = process
                return process
            with patch.object(host, "spawn", side_effect=spawn):
                host.download(host.media["video"][1], "Clip.mp4")
            self.assertEqual(existing.read_bytes(), b"old")
            self.assertEqual(host.completed.parent, Path(root))
            self.assertRegex(host.completed.name, r"^Clip-[a-f0-9]{8}\.mp4$")
            self.assertEqual(host.completed.read_bytes(), b"new")

    def test_cancel_cleans_staging_and_stops_process_tree(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            def spawn(args):
                staging = Path(args[args.index("--paths") + 1])
                (staging / "partial.part").write_bytes(b"partial")
                host.cancelled.set()
                return Mock(stdout=iter([]), returncode=-9)
            with patch.object(host, "spawn", side_effect=spawn):
                host.download(host.media["video"][1])
            self.assertEqual(list(Path(root).iterdir()), [])
            host.process = Mock(pid=123)
            host.process.poll.return_value = None
            with patch("zed_downloader.os.name", "posix"), patch("zed_downloader.os.killpg") as kill:
                host.stop_process()
            kill.assert_called_once()

    def test_process_is_never_started_in_a_shell_and_ignores_config(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            with patch("zed_downloader.subprocess.Popen") as popen:
                host.spawn(["--version"])
            args, kwargs = popen.call_args
            self.assertEqual(args[0][:3], ["/bin/yt-dlp", "--ignore-config", "--no-playlist"])
            self.assertFalse(kwargs.get("shell", False))

    def test_errors_and_update_result(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            with patch.object(host, "run_text", side_effect=ValueError("Not available")):
                host.work("formats", {})
            self.assertEqual(host.state["phase"], "error")
            self.assertEqual(host.state["error"], "Not available")
            with patch.object(host, "run_text", side_effect=["updated", "2026.11.17\n"]) as run:
                host.work("update", {})
            self.assertEqual(host.state["version"], "2026.11.17")
            self.assertEqual(run.call_args_list[0].args[0], ["--update"])

    def test_empty_output_gives_a_clear_error(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            with patch.object(host, "run_text", return_value=""):
                host.work("formats", {})
            self.assertEqual(host.state["phase"], "error")
            self.assertIn("unexpected response", host.state["error"])

    def test_malformed_json_gives_a_clear_error(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            with patch.object(host, "run_text", return_value="not json at all"):
                host.work("formats", {})
            self.assertEqual(host.state["phase"], "error")
            self.assertIn("unexpected response", host.state["error"])

    def test_run_text_raises_on_empty_output(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            process = Mock(returncode=0)
            process.communicate.return_value = ("", None)
            with patch.object(host, "spawn", return_value=process):
                with self.assertRaises(ValueError) as ctx:
                    host.run_text(["--dump-single-json"])
                self.assertIn("no output", str(ctx.exception))

    def test_formats_parses_json_with_surrounding_warnings(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            json_text = json.dumps(fixture())
            polluted = f"WARNING: [youtube] Deno provider failed\n{json_text}\n"
            with patch.object(host, "run_text", return_value=polluted):
                host.work("formats", {})
            self.assertEqual(host.state["phase"], "results")
            self.assertIsNotNone(host.media)
            self.assertEqual(host.media["title"], "A video")

    def test_run_text_extracts_stderr_error_ignoring_null(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            process = Mock(returncode=1)
            process.communicate.return_value = ("null\n", "ERROR: [youtube] Video unavailable\n")
            with patch.object(host, "spawn", return_value=process):
                with self.assertRaises(ValueError) as ctx:
                    host.run_text(["--dump-single-json"])
                self.assertEqual(str(ctx.exception), "ERROR: [youtube] Video unavailable")

    def test_installer_restricts_origin_and_uses_user_paths(self):
        with tempfile.TemporaryDirectory() as root:
            with patch("install.Path.home", return_value=Path(root)), patch("install.sys.platform", "linux"), patch.dict("os.environ", {"XDG_CONFIG_HOME": str(Path(root) / "config")}):
                install("a" * 32, "brave")
            manifest = json.loads(next(Path(root).rglob("*.json")).read_text())
            self.assertEqual(manifest["allowed_origins"], ["chrome-extension://" + "a" * 32 + "/"])
            self.assertTrue(Path(manifest["path"]).is_file())
            with self.assertRaises(ValueError):
                install("invalid-id", "chrome")

    def test_installer_discovers_only_zed_ids_without_manual_configuration(self):
        with tempfile.TemporaryDirectory() as root:
            profile = Path(root) / "Default"
            profile.mkdir()
            extension = Path(root) / "zed-dist"
            extension.mkdir()
            (extension / "manifest.json").write_text(json.dumps({"name": "Extension Zed", "permissions": ["nativeMessaging"]}))
            (profile / "Preferences").write_text(json.dumps({"extensions": {"settings": {
                "a" * 32: {"path": str(extension)},
                "b" * 32: {"manifest": {"name": "Other extension", "permissions": ["nativeMessaging"]}},
                "invalid": {"path": str(extension)},
            }}}))
            (profile / "Secure Preferences").write_text(json.dumps({"extensions": {"settings": {
                "c" * 32: {"manifest": {"name": "Extension Zed", "permissions": ["nativeMessaging"]}},
            }}}))
            with patch("install.browser_root", return_value=Path(root)):
                self.assertEqual(discover_ids("brave"), ["a" * 32, "c" * 32])
            with patch("install.discover_ids", side_effect=[[], ["a" * 32]]), patch("install.install") as register:
                setup()
            register.assert_called_once_with("a" * 32, "brave", ["a" * 32])
            with patch("install.discover_ids", return_value=[]), self.assertRaisesRegex(ValueError, "Install/load the extension first"):
                setup()

    def test_clip_download_flags_naming_and_validation(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            host.media["title"] = "How: dark interfaces stay readable?"
            process = Mock(returncode=0)
            process.poll.return_value = 0
            def spawn(args):
                staging = Path(args[args.index("--paths") + 1])
                result = staging / "clip.mp4"
                result.write_bytes(b"clip")
                process.stdout = iter(['frame=30 fps=0 time=00:00:27.50 bitrate=500kbits/s', 'ZED_STAGE processing', 'ZED_FILE ' + json.dumps(str(result))])
                host.process = process
                return process
            with patch.object(host, "spawn", side_effect=spawn) as launch:
                host.download(host.media["video"][1], None, root, {"start": 10, "end": 65}, True)
            args = launch.call_args.args[0]
            self.assertEqual(args[args.index("--download-sections") + 1], "*10-65")
            self.assertIn("--force-keyframes-at-cuts", args)
            self.assertEqual(host.completed.name, "How_ dark interfaces stay readable_ [0-10 to 1-05].mp4")
            snapshots = [call.args[0]["state"] for call in host.emit.call_args_list]
            self.assertTrue(any(s.get("pct") == 50 for s in snapshots))
            self.assertTrue(any(s.get("stage") == "Cutting precisely…" for s in snapshots))
            self.assertIn("clip", host.public_state()["capabilities"])

    def test_clip_validation_rejects_missing_ffmpeg_live_and_out_of_range(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            host.ffmpeg = False
            with self.assertRaisesRegex(ValueError, "ffmpeg"):
                host.handle({"id": "1", "command": "download", "formatId": "video:hd", "section": {"start": 0, "end": 10}})
            host.ffmpeg = True
            with self.assertRaisesRegex(ValueError, "duration"):
                host.handle({"id": "2", "command": "download", "formatId": "video:hd", "section": {"start": 0, "end": 120}})
            host.media["isLive"] = True
            with self.assertRaisesRegex(ValueError, "Live"):
                host.handle({"id": "3", "command": "download", "formatId": "video:hd", "section": {"start": 0, "end": 10}})
            host.media["isLive"] = False
            with patch("zed_downloader.threading.Thread"):
                reply = host.handle({"id": "4", "command": "download", "formatId": "video:hd", "section": {"start": 5, "end": 20}, "precise": False})
            self.assertEqual(reply["state"]["section"], {"start": 5, "end": 20})
            self.assertEqual(reply["state"]["precise"], False)
            host.thread = None
            res = host.handle({"id": "5", "command": "reset", "keepMedia": True})
            self.assertEqual(res["state"]["phase"], "results")
            self.assertIn("media", res["state"])

    def test_format_error_preserves_meaningful_prefix(self):
        long_err = (
            'ERROR: [Instagram] DgNjs4azner: Unable to download webpage: '
            'HTTPSConnectionPool(host=\'www.instagram.com\', port=443): Read timed out. (read timeout=20.0) '
            '(caused by TransportError("HTTPSConnectionPool(host=\'www.instagram.com\', port=443): Read timed out. (read timeout=20.0)"))'
        )
        formatted = format_error(long_err)
        self.assertTrue(formatted.startswith("ERROR: [Instagram] DgNjs4azner:"))
        self.assertIn("Read timed out", formatted)
        self.assertNotIn("caused by", formatted)
        self.assertTrue(format_error("x" * 400).endswith("…"))
        self.assertEqual(len(format_error("x" * 400)), 300)

    def test_run_text_retries_transient_errors_and_stops_on_permanent_errors(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            fail = Mock(returncode=1)
            fail.communicate.return_value = ("", 'ERROR: [Instagram] id: Unable to download webpage: (caused by TransportError("Read timed out"))')
            ok = Mock(returncode=0)
            ok.communicate.return_value = (json.dumps(fixture()), "")
            with patch.object(host, "spawn", side_effect=[fail, ok]) as launch, patch.object(host.cancelled, "wait", return_value=False) as wait:
                result = host.run_text(["--dump-single-json"], retries=3, socket_timeout=10)
            self.assertEqual(launch.call_count, 2)
            self.assertEqual(launch.call_args_list[0].args[0][:2], ["--socket-timeout", "10"])
            wait.assert_called_once_with(0.5)
            self.assertIn("A video", result)

            permanent = Mock(returncode=1)
            permanent.communicate.return_value = ("", "ERROR: [youtube] Video unavailable")
            with patch.object(host, "spawn", return_value=permanent) as launch:
                with self.assertRaisesRegex(ValueError, "Video unavailable"):
                    host.run_text(["--dump-single-json"], retries=3, socket_timeout=10)
            self.assertEqual(launch.call_count, 1)

    def test_download_retries_transient_errors_before_producing_file(self):
        with tempfile.TemporaryDirectory() as root:
            host = self.make_host(root)
            calls = []
            def spawn(args):
                calls.append(args)
                if len(calls) == 1:
                    return Mock(stdout=iter(['ERROR: [Instagram] id: (caused by TransportError("Read timed out"))']), returncode=1)
                staging = Path(args[args.index("--paths") + 1])
                result = staging / "A_video.mp4"
                result.write_bytes(b"video")
                proc = Mock(stdout=iter(['ZED_FILE ' + json.dumps(str(result))]), returncode=0)
                host.process = proc
                return proc
            with patch.object(host, "spawn", side_effect=spawn), patch.object(host.cancelled, "wait", return_value=False):
                host.download(host.media["video"][1])
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][:2], ["--socket-timeout", "15"])
            self.assertEqual(host.state["phase"], "done")
            self.assertEqual(host.completed.read_bytes(), b"video")


    def test_uninstall_removes_only_its_own_registration_and_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            helper = root / "helper"
            helper.mkdir()
            (helper / "zed_downloader.py").write_text("x")
            config = root / "config"
            own_dir = config / "google-chrome" / "NativeMessagingHosts"
            own_dir.mkdir(parents=True)
            own_manifest = own_dir / (HOST + ".json")
            own_manifest.write_text(json.dumps({"name": HOST, "path": str(helper / "zed-downloader")}))
            other_dir = config / "BraveSoftware" / "Brave-Browser" / "NativeMessagingHosts"
            other_dir.mkdir(parents=True)
            foreign_manifest = other_dir / (HOST + ".json")
            foreign_manifest.write_text(json.dumps({"name": HOST, "path": str(root / "someone-else" / "host")}))
            with patch("zed_downloader.shutil.which", side_effect=lambda name: "/bin/" + name), \
                 patch("zed_downloader.Path.home", return_value=root / "home"), \
                 patch.dict(os.environ, {"XDG_CONFIG_HOME": str(config)}), \
                 patch("zed_downloader.sys.platform", "linux"), \
                 patch("zed_downloader.os.name", "posix"):
                host = Host(Mock(), root, root=helper)
                reply = host.handle({"id": "1", "command": "uninstall"})
            self.assertTrue(reply["ok"])
            self.assertTrue(host.stopping)
            self.assertFalse(own_manifest.exists())
            self.assertTrue(foreign_manifest.exists())
            self.assertFalse(helper.exists())

    def test_uninstall_refuses_while_busy(self):
        with tempfile.TemporaryDirectory() as root:
            with patch("zed_downloader.shutil.which", side_effect=lambda name: "/bin/" + name):
                host = Host(Mock(), root)
            host.thread = Mock()
            host.thread.is_alive.return_value = True
            with self.assertRaisesRegex(ValueError, "Cancel the current task first"):
                host.handle({"id": "1", "command": "uninstall"})
            self.assertFalse(host.stopping)


if __name__ == "__main__":
    unittest.main()
