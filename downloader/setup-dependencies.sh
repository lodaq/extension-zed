set -eu

if [ "$(id -u)" -eq 0 ]; then
    echo "Run setup as your normal user. Setup uses sudo for Linux packages when needed." >&2
    exit 1
fi

dependencies_ready() {
    python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null &&
        command -v yt-dlp >/dev/null && command -v ffmpeg >/dev/null
}

if ! dependencies_ready; then
    if [ "$(uname -s)" = Darwin ]; then
        if ! command -v brew >/dev/null; then
            echo "Install Homebrew and add it to PATH, then rerun setup." >&2
            exit 1
        fi
        brew install python yt-dlp ffmpeg
    elif command -v pacman >/dev/null; then
        sudo pacman -S --needed python yt-dlp ffmpeg
    elif command -v apt-get >/dev/null; then
        sudo apt-get update
        sudo apt-get install python3 yt-dlp ffmpeg
    else
        echo "Install Python 3.10+, yt-dlp, and ffmpeg with your package manager, then rerun setup." >&2
        exit 1
    fi
fi

if ! dependencies_ready; then
    echo "Python 3.10+, yt-dlp, and ffmpeg must be on PATH before setup can finish." >&2
    exit 1
fi
