#!/bin/bash
# The cut under nohup, with a log: the Bedrock shim up, cut.mjs with the
# given arguments, the shim down, and then the worker box stops itself five
# minutes later unless NO_SHUTDOWN is set. Returns at once.
#
#   bash run-cut.sh --meeting 119395 --desk house-ag
#   NO_SHUTDOWN=1 bash run-cut.sh --job cut_0123456789abcdef
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
nohup bash -c '
  ~/clips-venv/bin/python cut/bedrock_shim.py >> out/shim.log 2>&1 &
  shim=$!
  sleep 3
  node cut.mjs "$@"
  code=$?
  kill $shim
  if [ -z "${NO_SHUTDOWN:-}" ]; then sudo shutdown -h +5; fi
  exit $code
' _ "$@" >> out/run-cut.log 2>&1 &
echo "cut running as $!; log: $(pwd)/out/run-cut.log"
