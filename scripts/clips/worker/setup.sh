#!/bin/bash
# The clips worker box, from a fresh Amazon Linux 2023 x86_64 instance with
# the govblock-dev instance profile (Aurora Data API, Bedrock, S3). Run once,
# as ec2-user, from a checkout of this repo pushed to ~/govblock:
#
#   bash ~/govblock/scripts/clips/worker/setup.sh
#
# Installs: FFmpeg (static build), Node 22, Python 3.11 with faster-whisper,
# yt-dlp and boto3, autoclip at a pinned commit with GovBlock's patch and
# prompts, and the render's Chrome libraries. The worker's .env.local
# (POLICY_* and CLOUDFLARE_* only) is written separately, over stdin.
set -euo pipefail

AUTOCLIP_COMMIT=aaf863bbd7bba99c64bc53284d41c0ed19034387
HERE="$(cd "$(dirname "$0")" && pwd)"

sudo dnf install -y -q git tar xz python3.11 python3.11-pip dejavu-sans-fonts fontconfig \
  mesa-libgbm libX11 libXrandr libdrm libXdamage libXfixes libXcomposite dbus-libs libxcb libxkbcommon nss nspr alsa-lib cups-libs atk at-spi2-atk pango cairo

if ! command -v ffmpeg >/dev/null; then
  curl -sSL -o /tmp/ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
  mkdir -p /tmp/ffmpeg && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1
  sudo install -m 755 /tmp/ffmpeg/ffmpeg /tmp/ffmpeg/ffprobe /usr/local/bin/
fi

if ! command -v node >/dev/null; then
  curl -sSL -o /tmp/node.tar.xz https://nodejs.org/dist/v22.16.0/node-v22.16.0-linux-x64.tar.xz
  sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
fi

[ -d ~/autoclip ] || git clone -q https://github.com/zhouxiaoka/autoclip ~/autoclip
git -C ~/autoclip fetch -q origin && git -C ~/autoclip checkout -q "$AUTOCLIP_COMMIT"
python3.11 "$HERE/cut/patch_autoclip.py" ~/autoclip
cp "$HERE"/cut/prompts/*.txt ~/autoclip/backend/prompt/speech/

[ -d ~/clips-venv ] || python3.11 -m venv ~/clips-venv
~/clips-venv/bin/pip install -q --upgrade pip
~/clips-venv/bin/pip install -q -r ~/autoclip/requirements.txt 'faster-whisper>=1.1,<2' boto3

cd "$HERE" && npm install --no-audit --no-fund --silent

echo "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3), node $(node -v), $(~/clips-venv/bin/python --version), autoclip $(git -C ~/autoclip rev-parse --short HEAD)"
