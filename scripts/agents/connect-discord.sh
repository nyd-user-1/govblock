#!/usr/bin/env bash
# Put a Discord incoming-webhook URL into the secret the Tracker reads.
#
#   ./scripts/agents/connect-discord.sh 'https://discord.com/api/webhooks/…'
#
# The URL is the whole credential — anyone holding it can post to that channel
# and nothing else — so it is passed as an argument, written straight into
# Secrets Manager, never echoed, never written to a file and never committed.
# This repo is public.
#
# Before this: Discord → Server Settings → Integrations → Webhooks → New
# Webhook, pick the channel, Copy Webhook URL. The channel is named by the URL,
# which is why no channel argument exists here or anywhere in the agent code.
#
# Validation is a GET, not a post: the first message this webhook ever sends
# should be a real digest, not a test line.
set -euo pipefail

URL="${1:-}"
SECRET_ID="${SECRET_ID:-govblock/discord}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$URL" ]; then
  echo "usage: $0 <discord-webhook-url>" >&2
  exit 64
fi
case "$URL" in
  https://discord.com/api/webhooks/*|https://discordapp.com/api/webhooks/*) ;;
  *) echo "that is not a Discord webhook URL" >&2; exit 64 ;;
esac

echo "→ reading the webhook (GET; nothing is posted)"
INFO=$(curl -sS -H 'User-Agent: govblock-agents/1' "$URL")
if ! grep -q '"channel_id"' <<<"$INFO"; then
  echo "Discord did not recognise it: $INFO" >&2
  exit 1
fi
python3 -c 'import json,sys; d=json.load(sys.stdin); print("   name:", d.get("name"), "· channel:", d.get("channel_id"), "· guild:", d.get("guild_id"))' <<<"$INFO"

echo "→ writing $SECRET_ID"
aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ID" --region "$REGION" \
  --secret-string "$(python3 -c 'import json,sys; print(json.dumps({"webhook_url": sys.argv[1]}))' "$URL")" \
  --query 'VersionId' --output text

echo
echo "Done. The site picks it up within five minutes — the secret reader in"
echo "lib/agents/connections/secret.ts caches for that long — or immediately"
echo "after the next deploy. Ask the Tracker to watch something and it will post."
