#!/usr/bin/env python3
"""User-level native messaging host. Requires user-installed yt-dlp and ffmpeg."""
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import threading
from urllib.parse import urlsplit
import uuid

HOST = "com.extension_zed.downloader"
CAPABILITIES = ["clip"]
OUTPUT = Path.home() / "Downloads" / "Zed"
MAX_MESSAGE = 256 * 1024
INVALID_FILENAME = re.compile(r'[\\/:*?"<>|\x00-\x1f\x7f]')
FFMPEG_TIME = re.compile(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)")
WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
ERROR_LIMIT = 300
TRANSIENT_NETWORK_ERRORS = (
    "transporterror",
    "timed out",
    "timeouterror",
    "failed to establish a new connection",
    "network is unreachable",
    "connection reset",
    "connection aborted",
    "remotedisconnected",
    "temporary failure in name resolution",
)


def format_error(message, limit=ERROR_LIMIT):
    text = re.sub(r"\s+", " ", str(message or "")).strip()
    if " (caused by " in text:
        prefix, _, _ = text.partition(" (caused by ")
        if ": " in prefix:
            text = prefix.strip()
    if len(text) <= limit:
        return text
    return text[:limit - 1].rstrip() + "…"


def is_transient_error(message):
    lowered = str(message or "").lower()
    return any(token in lowered for token in TRANSIENT_NETWORK_ERRORS)


def valid_url(value):
    if not isinstance(value, str) or len(value) > 8192 or any(ord(c) < 32 for c in value):
        raise ValueError("That doesn’t look like a link.")
    parsed = urlsplit(value.strip())
    if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Only HTTP(S) links without embedded credentials are supported.")
    return value.strip()


def safe_name(value):
    """Keep a requested file name inside the output directory and valid on every OS."""
    if not isinstance(value, str):
        raise ValueError("Invalid file name.")
    name = re.sub(r"\s+", " ", INVALID_FILENAME.sub("_", value)).strip(" .")
    if not name:
        return ""
    if name.split(".")[0].upper() in WINDOWS_RESERVED:
        name = "_" + name
    return name[:120].rstrip(" .")


def valid_directory(value):
    """Accept only an absolute folder path, expanding a leading ~ for this user."""
    if not isinstance(value, str) or not value.strip() or len(value) > 4096 or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError("Enter a valid download folder.")
    path = Path(os.path.expanduser(value.strip()))
    if not path.is_absolute():
        raise ValueError("Use an absolute folder path, or one starting with ~.")
    path = Path(os.path.normpath(str(path)))
    if path.exists() and not path.is_dir():
        raise ValueError("That download folder is a file.")
    return path


def number(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0 else 0


def format_clock_filename(seconds):
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}-{minutes:02d}-{secs:02d}"
    return f"{minutes}-{secs:02d}"


def valid_section(section, media, has_ffmpeg):
    if not isinstance(section, dict):
        raise ValueError("Invalid clip range.")
    start = section.get("start")
    end = section.get("end")
    if isinstance(start, bool) or isinstance(end, bool) or not isinstance(start, int) or not isinstance(end, int):
        raise ValueError("Clip start and end must be whole seconds.")
    if start < 0 or end < start + 1:
        raise ValueError("Clip must be at least 1 second long.")
    if not media:
        raise ValueError("Read a video link first.")
    duration = number(media.get("duration"))
    if media.get("isLive") or duration < 1:
        raise ValueError("Live streams and videos with unknown duration can’t be clipped.")
    if end > math.ceil(duration):
        raise ValueError("Clip end cannot be past the video duration.")
    if not has_ffmpeg:
        raise ValueError("Cutting a clip needs ffmpeg.")
    return {"start": start, "end": end}


def media_info(info, ffmpeg):
    """Reduce extractor data to selectable, safe format IDs; never accept raw selectors."""
    formats = [f for f in info.get("formats", []) if isinstance(f, dict)
               and re.fullmatch(r"[\w.-]{1,100}", str(f.get("format_id", "")))
               and not f.get("has_drm") and f.get("protocol") != "mhtml"]
    audio = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") not in (None, "none")]
    best_audio = max(audio, key=lambda f: (not str(f.get("protocol", "")).startswith("m3u8"), number(f.get("abr")) or number(f.get("tbr"))), default=None)
    conversion_source = best_audio or max((f for f in formats if f.get("acodec") != "none"),
                                         key=lambda f: number(f.get("tbr")), default=None)

    def row(f, mode, label, merge=None):
        size = number(f.get("filesize")) or number(f.get("filesize_approx"))
        if merge:
            other = number(merge.get("filesize")) or number(merge.get("filesize_approx"))
            size = size + other if size and other else 0
        bitrate = round((number(f.get("tbr")) or number(f.get("vbr")) or number(f.get("abr"))) +
                        ((number(merge.get("abr")) or number(merge.get("tbr"))) if merge else 0))
        return {"id": f'{mode}:{f["format_id"]}', "label": label,
                "meta": " · ".join(str(x) for x in [str(f.get("ext", "")).upper(),
                    f.get("vcodec") if mode == "video" else f.get("acodec"),
                    f'{f["fps"]} fps' if mode == "video" and f.get("fps") else
                    f'{round(number(f.get("abr")) or number(f.get("tbr")))} kbps' if mode != "video" else ""] if x),
                "size": size, "approximate": not bool(f.get("filesize")) or bool(merge and not merge.get("filesize")),
                "bitrate": bitrate,
                "selector": str(f["format_id"]) + ("+" + str(merge["format_id"]) if merge else ""), "tags": []}

    heights = {}
    for f in formats:
        if f.get("vcodec") == "none":
            continue
        separate = f.get("acodec") == "none"
        if separate and (not ffmpeg or not best_audio):
            continue
        height = int(number(f.get("height")))
        rank = (f.get("ext") == "mp4" and str(f.get("vcodec", "")).startswith(("avc", "h264")),
                not str(f.get("protocol", "")).startswith("m3u8"),
                bool(number(f.get("filesize")) or number(f.get("filesize_approx"))),
                number(f.get("tbr")), number(f.get("fps")))
        if height not in heights or rank > heights[height][0]:
            heights[height] = (rank, row(f, "video", f"{height}p" if height else "Original", best_audio if separate else None))
    video = [heights[h][1] for h in sorted(heights, reverse=True)]
    if video:
        video[0]["tags"].append("Best quality")
        compatible = next((heights[h][1] for h in sorted(heights, reverse=True) if h <= 1080 and heights[h][0][0]), None)
        if compatible:
            compatible["tags"].append("Most compatible")
    rows = []
    for extension, label in [("m4a", "M4A · AAC"), ("webm", "WebM · Opus")]:
        candidates = [f for f in audio if f.get("ext") == extension]
        if candidates:
            f = max(candidates, key=lambda f: (not str(f.get("protocol", "")).startswith("m3u8"), number(f.get("abr")) or number(f.get("tbr"))))
            rows.append(row(f, "audio", label))
    if not rows and best_audio:
        rows.append(row(best_audio, "audio", str(best_audio.get("ext", "Audio")).upper()))
    if rows:
        rows[0]["tags"].append("Recommended")
    if ffmpeg and conversion_source:
        converted = row(conversion_source, "mp3", "MP3 · Converted")
        converted.update(size=0, approximate=True, meta="MP3 · Variable bitrate",
                         bitrate=round(number(conversion_source.get("abr")) or number(conversion_source.get("tbr")) or 192))
        rows.append(converted)
    if not video and not rows:
        raise ValueError("No supported, unencrypted formats were found.")
    is_live = bool(info.get("is_live")) or info.get("live_status") in ("is_live", "is_upcoming")
    return {"title": str(info.get("title", "Untitled"))[:500], "uploader": str(info.get("uploader") or "")[:200],
            "host": urlsplit(info.get("webpage_url") or "").hostname or "", "duration": number(info.get("duration")),
            "isLive": is_live, "video": video, "audio": rows}


def read_message(stream):
    def exact(size):
        data = bytearray()
        while len(data) < size:
            chunk = stream.read(size - len(data))
            if not chunk:
                if not data:
                    return None
                raise ValueError("Truncated native message")
            data.extend(chunk)
        return bytes(data)
    header = exact(4)
    if header is None:
        return None
    size = struct.unpack("=I", header)[0]
    if size > MAX_MESSAGE:
        raise ValueError("Native message too large")
    payload = exact(size)
    if payload is None:
        raise ValueError("Missing native message")
    return json.loads(payload)


class Host:
    def __init__(self, emit, output=OUTPUT):
        self.emit = emit
        self.output = Path(output)
        self.lock = threading.RLock()
        self.process = None
        self.thread = None
        self.cancelled = threading.Event()
        self.ytdlp = shutil.which("yt-dlp")
        self.ffmpeg = shutil.which("ffmpeg") is not None
        self.state = {"phase": "ready", "version": "", "ffmpeg": self.ffmpeg, "capabilities": list(CAPABILITIES)}
        self.media = None
        self.url = ""
        self.completed = None
        self.completed_root = None

    def publish(self, **patch):
        with self.lock:
            self.state.update(patch)
            self.emit({"event": "state", "state": self.public_state()})

    def public_state(self):
        # Selectors stay in the host; the extension can only select a listed ID.
        state = dict(self.state)
        if self.media:
            state["media"] = {**self.media, **{mode: [{k: v for k, v in f.items() if k != "selector"}
                                    for f in self.media[mode]] for mode in ("video", "audio")}}
        return state

    def spawn(self, args, merge_stderr=True):
        with self.lock:
            if self.cancelled.is_set():
                raise ValueError("Cancelled")
            self.process = subprocess.Popen([self.ytdlp, "--ignore-config", "--no-playlist", *args],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT if merge_stderr else subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
                start_new_session=os.name != "nt", creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
            return self.process

    def should_retry(self, attempt, attempts, error_message):
        if attempt >= attempts or self.cancelled.is_set() or not is_transient_error(error_message):
            return False
        return not self.cancelled.wait(0.5 * attempt)

    def run_text(self, args, timeout=120, retries=1, socket_timeout=None):
        full_args = [*args]
        if socket_timeout is not None and "--socket-timeout" not in full_args:
            full_args = ["--socket-timeout", str(socket_timeout), *full_args]
        attempts = max(1, int(retries))
        for attempt in range(1, attempts + 1):
            process = self.spawn(full_args, merge_stderr=False)
            try:
                stdout, stderr = process.communicate(timeout=timeout)
            except subprocess.TimeoutExpired:
                self.stop_process()
                process.communicate()
                error_message = "yt-dlp timed out. Try again."
                if self.should_retry(attempt, attempts, error_message):
                    continue
                if self.cancelled.is_set():
                    raise ValueError("Cancelled") from None
                raise ValueError(error_message) from None
            if process.returncode:
                lines = [l.strip() for l in (stderr or "").splitlines() if l.strip() and l.strip() != "null"]
                if not lines:
                    lines = [l.strip() for l in (stdout or "").splitlines() if l.strip() and l.strip() != "null"]
                raw_error = (lines or ["yt-dlp failed"])[-1]
                if self.should_retry(attempt, attempts, raw_error):
                    continue
                if self.cancelled.is_set():
                    raise ValueError("Cancelled")
                raise ValueError(format_error(raw_error))
            if not stdout or not stdout.strip() or stdout.strip() == "null":
                raise ValueError("yt-dlp returned no output. The link may be invalid, private, or region-locked.")
            return stdout

    def stop_process(self):
        with self.lock:
            process = self.process
            if process and process.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                else:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass

    def handle(self, message):
        if not isinstance(message, dict) or not isinstance(message.get("id"), str):
            raise ValueError("Invalid command")
        command = message.get("command")
        with self.lock:
            busy = self.thread and self.thread.is_alive()
            if command == "cancel":
                if busy and self.state["phase"] in ("reading", "downloading", "checking", "updating"):
                    self.cancelled.set()
                    self.stop_process()
            elif command in ("open", "reveal"):
                path = self.completed
                root = self.completed_root or self.output
                if not path or not path.is_file() or path.resolve().parent != Path(root).resolve():
                    raise ValueError("Downloaded file is unavailable")
                if sys.platform == "win32":
                    if command == "open":
                        os.startfile(str(path))
                    else:
                        subprocess.Popen(["explorer.exe", "/select,", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    args = ["open", "-R", str(path)] if sys.platform == "darwin" and command == "reveal" else ["open" if sys.platform == "darwin" else "xdg-open", str(path if command == "open" else path.parent)]
                    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            elif command == "reset":
                if busy:
                    raise ValueError("Cancel the current task first")
                self.completed = None
                self.completed_root = None
                if message.get("keepMedia") is True and self.media:
                    self.state = {"phase": "results", "version": self.state.get("version", ""), "ffmpeg": self.ffmpeg, "capabilities": list(CAPABILITIES), "url": self.url}
                else:
                    self.media = None
                    self.url = ""
                    self.state = {"phase": "ready", "version": self.state.get("version", ""), "ffmpeg": self.ffmpeg, "capabilities": list(CAPABILITIES)}
                self.publish()
            elif command in ("ping", "formats", "download", "update"):
                if busy:
                    raise ValueError("Another task is already running")
                if command == "ping":
                    self.ytdlp = shutil.which("yt-dlp")
                    self.ffmpeg = shutil.which("ffmpeg") is not None
                    self.state["ffmpeg"] = self.ffmpeg
                if not self.ytdlp:
                    raise ValueError("yt-dlp was not found on PATH. See the setup guide.")
                if command == "formats":
                    self.url = valid_url(message.get("url"))
                    self.media = None
                section = None
                precise = True
                if command == "download":
                    choices = self.media["video"] + self.media["audio"] if self.media else []
                    choice = next((f for f in choices if f["id"] == message.get("formatId")), None)
                    if not choice:
                        raise ValueError("Choose an available format first")
                    output = valid_directory(message["directory"]) if message.get("directory") is not None else self.output
                    if message.get("section") is not None:
                        section = valid_section(message["section"], self.media, self.ffmpeg)
                        if message.get("precise") is not None and not isinstance(message.get("precise"), bool):
                            raise ValueError("Invalid clip precision option.")
                        precise = message.get("precise", True)
                    message = {**message, "choice": choice, "output": output, "section": section, "precise": precise}
                self.cancelled.clear()
                self.state.pop("section", None)
                self.state.pop("precise", None)
                self.publish(phase={"ping": "checking", "formats": "reading", "download": "downloading", "update": "updating"}[command],
                             error="", pct=None if section else 0, stage="Downloading clip…" if section else "Downloading…", url=self.url, cancelled=False,
                             summary=message["choice"]["label"] + " · " + message["choice"]["meta"] if command == "download" else "",
                             capabilities=list(CAPABILITIES),
                             **({"directory": str(message["output"])} if command == "download" else {}),
                             **({"section": section, "precise": precise} if section else {}))
                self.thread = threading.Thread(target=self.work, args=(command, message), daemon=True)
                self.thread.start()
            else:
                raise ValueError("Unknown command")
            return {"id": message["id"], "ok": True, "state": self.public_state()}

    def work(self, command, message):
        try:
            if command in ("ping", "update"):
                if command == "update":
                    self.run_text(["--update"], timeout=300)
                version = self.run_text(["--version"], timeout=15).strip()[:80]
                self.publish(phase="results" if self.media else "ready", version=version)
            elif command == "formats":
                raw = self.run_text(
                    ["--no-warnings", "--dump-single-json", "--skip-download", "--", self.url],
                    timeout=45,
                    retries=3,
                    socket_timeout=10,
                )
                try:
                    start = raw.find("{")
                    end = raw.rfind("}")
                    if start != -1 and end != -1 and end > start:
                        info = json.loads(raw[start:end + 1])
                    else:
                        info = json.loads(raw)
                except (json.JSONDecodeError, ValueError):
                    raise ValueError("yt-dlp returned an unexpected response. The link may be unsupported, private, or region-locked.")
                media = media_info(info, self.ffmpeg)
                if self.cancelled.is_set():
                    return
                self.media = media
                self.publish(phase="results")
            else:
                self.download(message["choice"], message.get("filename"), message.get("output"), message.get("section"), message.get("precise", True))
        except Exception as error:
            if not self.cancelled.is_set():
                self.publish(phase="error", error=format_error(error))
        finally:
            self.stop_process()
            if self.cancelled.is_set():
                self.state.pop("section", None)
                self.state.pop("precise", None)
                self.publish(phase="results" if self.media else "ready", error="", cancelled=True)
            with self.lock:
                self.process = None
                self.thread = None

    def download(self, choice, filename=None, output=None, section=None, precise=True, retries=3):
        custom_name = safe_name(filename) if filename is not None else ""
        directory = Path(output) if output else self.output
        directory.mkdir(parents=True, exist_ok=True)
        attempts = max(1, int(retries))
        for attempt in range(1, attempts + 1):
            with tempfile.TemporaryDirectory(prefix=".zed-", dir=directory) as staging:
                args = ["--socket-timeout", "15", "--no-simulate", "--newline", "--progress", "--progress-delta", "0.5",
                        "--progress-template", 'download:ZED_PROGRESS %(progress)j',
                        "--progress-template", 'postprocess:ZED_STAGE %(progress.status)s',
                        "--print", "after_move:ZED_FILE %(filepath)j", "--restrict-filenames", "--no-overwrites",
                        "--paths", staging, "--output", "%(title).100s [%(id).50s].%(ext)s", "--format", choice["selector"]]
                if section:
                    args += ["--download-sections", f"*{section['start']}-{section['end']}"]
                    if precise:
                        args += ["--force-keyframes-at-cuts"]
                if choice["id"].startswith("mp3:"):
                    args += ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
                process = self.spawn([*args, "--", self.url])
                raw_error = "yt-dlp did not produce a file"
                result = None
                clip_duration = (section["end"] - section["start"]) if section else 0
                last_clip_pct = -1
                for line in process.stdout:
                    line = line.strip()
                    if line.startswith("ZED_PROGRESS "):
                        progress = json.loads(line[len("ZED_PROGRESS "):])
                        total = number(progress.get("total_bytes")) or number(progress.get("total_bytes_estimate"))
                        downloaded = number(progress.get("downloaded_bytes"))
                        self.publish(pct=min(100, round(100 * downloaded / total)) if total else None,
                                     downloaded=downloaded, total=total, speed=number(progress.get("speed")), eta=number(progress.get("eta")),
                                     stage="Downloading clip…" if section else "Downloading…")
                    elif line.startswith("ZED_STAGE "):
                        if choice["id"].startswith("mp3:"):
                            stage = "Converting to MP3…"
                        elif section:
                            stage = "Cutting precisely…" if precise else "Finishing…"
                        else:
                            stage = "Merging video and audio…"
                        self.publish(pct=None, stage=stage)
                    elif line.startswith("ZED_FILE "):
                        result = Path(json.loads(line[len("ZED_FILE "):]))
                    elif section and clip_duration > 0 and (match := FFMPEG_TIME.search(line)):
                        elapsed = int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3))
                        pct = min(99, max(0, round(100 * elapsed / clip_duration)))
                        if pct != last_clip_pct:
                            last_clip_pct = pct
                            self.publish(pct=pct, stage="Cutting precisely…" if precise else "Downloading clip…")
                    elif line and line.strip() != "null":
                        raw_error = line
                process.wait()
                if self.cancelled.is_set():
                    return
                if process.returncode or not result or not result.is_file() or result.resolve().parent != Path(staging).resolve():
                    if self.should_retry(attempt, attempts, raw_error):
                        self.publish(pct=None if section else 0, stage="Retrying…")
                        continue
                    if self.cancelled.is_set():
                        return
                    raise ValueError(format_error(raw_error))
                # Never replace an earlier download, even when the extractor repeats a title.
                if custom_name:
                    base = custom_name
                    if result.suffix and base.lower().endswith(result.suffix.lower()):
                        base = base[:-len(result.suffix)].rstrip(" .") or result.stem
                    destination = directory / (base + result.suffix)
                    if destination.exists():
                        destination = directory / (base + "-" + uuid.uuid4().hex[:8] + result.suffix)
                elif section:
                    suffix = f" [{format_clock_filename(section['start'])} to {format_clock_filename(section['end'])}]"
                    title_part = safe_name(self.media.get("title") or "") if self.media else ""
                    if not title_part:
                        title_part = result.stem
                    max_title = max(1, 120 - len(suffix))
                    base = (title_part[:max_title].rstrip(" .") + suffix).strip(" .")
                    destination = directory / (base + result.suffix)
                    if destination.exists():
                        max_title_uuid = max(1, 120 - len(suffix) - 9)
                        base = (title_part[:max_title_uuid].rstrip(" .") + suffix + "-" + uuid.uuid4().hex[:8]).strip(" .")
                        destination = directory / (base + result.suffix)
                else:
                    destination = directory / (result.stem + "-" + uuid.uuid4().hex[:8] + result.suffix)
                with self.lock:
                    if self.cancelled.is_set():
                        return
                    result.rename(destination)
                    self.completed = destination
                    self.completed_root = directory
                    self.publish(phase="done", pct=100, filename=destination.name, size=destination.stat().st_size,
                                 directory=str(directory), summary=choice["label"] + " · " + choice["meta"])
                return


def main():
    if os.name == "nt":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    write_lock = threading.Lock()

    def emit(message):
        payload = json.dumps(message, allow_nan=False).encode("utf-8")
        if len(payload) > 1024 * 1024:
            raise ValueError("Native response too large")
        with write_lock:
            sys.stdout.buffer.write(struct.pack("=I", len(payload)) + payload)
            sys.stdout.buffer.flush()

    host = Host(emit)
    try:
        while True:
            message = read_message(sys.stdin.buffer)
            if message is None:
                break
            try:
                emit(host.handle(message))
            except Exception as error:
                emit({"id": message.get("id") if isinstance(message, dict) else None, "ok": False, "error": str(error)[:120]})
    finally:
        host.cancelled.set()
        host.stop_process()
        if host.thread:
            host.thread.join(timeout=10)


if __name__ == "__main__":
    main()
