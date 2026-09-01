#!/usr/bin/env bash
# Put a Slack bot token into the secret the Tracker reads, and prove it works.
#
#   ./scripts/agents/connect-slack.sh xoxb-… '#govblock'
#
# The token is passed as an argument and written straight into Secrets Manager;
# it is never echoed, never written to a file and never committed. The repo is
# public.
#
# Before this: create the app from scripts/agents/slack-app-manifest.json at
# https://api.slack.com/apps (Create New App → From a manifest), Install to
# Workspace, and copy the Bot User OAuth Token from OAuth & Permissions.
set -euo pipefail

TOKEN="${1:-}"
CHANNEL="${2:-#govblock}"
SECRET_ID="${SECRET_ID:-govblock/slack}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$TOKEN" ]; then
  echo "usage: $0 <xoxb-bot-token> [channel]" >&2
  exit 64
fi
case "$TOKEN" in
  xoxb-*) ;;
  *) echo "that is not a bot token — it must start with xoxb-" >&2; exit 64 ;;
esac

echo "→ auth.test"
WHO=$(curl -sS -H "Authorization: Bearer $TOKEN" https://slack.com/api/auth.test)
if ! grep -q '"ok":true' <<<"$WHO"; then
  echo "Slack rejected the token: $WHO" >&2
  exit 1
fi
python3 -c 'import json,sys; d=json.load(sys.stdin); print("   team:", d["team"], "· bot:", d["user"])' <<<"$WHO"

echo "→ writing $SECRET_ID"
aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ID" --region "$REGION" \
  --secret-string "$(python3 -c 'import json,sys; print(json.dumps({"bot_token": sys.argv[1], "channel": sys.argv[2]}))' "$TOKEN" "$CHANNEL")" \
  --query 'VersionId' --output text

echo "→ chat.postMessage to $CHANNEL"
POST=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json; charset=utf-8' \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"channel": sys.argv[1], "text": "govblock connected. The Tracker will post its digests here."}))' "$CHANNEL")")
if grep -q '"ok":true' <<<"$POST"; then
  echo "   posted."
else
  echo "   posted nothing: $POST" >&2
  echo "   (channel_not_found usually means the channel name is wrong;" >&2
  echo "    not_in_channel means chat:write.public was not granted.)" >&2
  exit 1
fi

echo
echo "Done. The site picks it up within five minutes — lib/agents/connections/slack.ts"
echo "caches the secret for that long — or immediately after the next deploy."
