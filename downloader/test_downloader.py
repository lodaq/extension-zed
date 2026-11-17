import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import Mock, patch

from zed_downloader import Host, MAX_MESSAGE, media_info, read_message, valid_url
from install import install


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

    def test_installer_restricts_origin_and_uses_user_paths(self):
        with tempfile.TemporaryDirectory() as root:
            with patch("install.Path.home", return_value=Path(root)), patch("install.sys.platform", "linux"), patch.dict("os.environ", {"XDG_CONFIG_HOME": str(Path(root) / "config")}):
                install("a" * 32, "brave")
            manifest = json.loads(next(Path(root).rglob("*.json")).read_text())
            self.assertEqual(manifest["allowed_origins"], ["chrome-extension://" + "a" * 32 + "/"])
            self.assertTrue(Path(manifest["path"]).is_file())
            with self.assertRaises(ValueError):
                install("invalid-id", "chrome")


if __name__ == "__main__":
    unittest.main()
