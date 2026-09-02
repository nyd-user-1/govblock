#!/usr/bin/env bash
# Give govblock a read-only view of the PolicyBot channel.
#
#   ./scripts/agents/connect-discord-bot.sh <bot-token> <channel-id>
#
# The webhook the Tracker posts through can write and cannot read — the URL is a
# one-way door — so rendering the channel's threads on our own pages needs a
# bot. This is the smallest bot that can do it: it reads one channel and does
# nothing else.
#
# Before this, at https://discord.com/developers/applications:
#   1. New Application → name it "govblock" → Bot → Reset Token → copy it.
#   2. Bot → Privileged Gateway Intents: leave them all OFF. Reading threads
#      needs none of them.
#   3. OAuth2 → URL Generator → scope "bot" → permissions "View Channels" and
#      "Read Message History" ONLY → open the generated URL → add it to the
#      server.
#   4. In Discord, right-click the PolicyBot channel → Copy Channel ID
#      (Settings → Advanced → Developer Mode if you do not see it).
#
# The token is passed as an argument and written straight into Secrets Manager;
# it is never echoed, never written to a file and never committed. This repo is
# public. Reset the token in the developer portal if it is ever pasted anywhere
# it should not have been.
set -euo pipefail

TOKEN="${1:-}"
CHANNEL="${2:-}"
SECRET_ID="${SECRET_ID:-govblock/discord-bot}"
REGION="${AWS_REGION:-us-east-1}"
GUILD="${GUILD_ID:-1537459604626219018}"

if [ -z "$TOKEN" ] || [ -z "$CHANNEL" ]; then
  echo "usage: $0 <bot-token> <channel-id>" >&2
  exit 64
fi

echo "→ who is this bot?"
ME=$(curl -sS -H "Authorization: Bot $TOKEN" -H 'User-Agent: govblock-agents/1' \
  https://discord.com/api/v10/users/@me)
if ! grep -q '"id"' <<<"$ME"; then
  echo "Discord rejected the token: $ME" >&2
  exit 1
fi
python3 -c 'import json,sys; d=json.load(sys.stdin); print("   bot:", d.get("username"), "· id", d.get("id"))' <<<"$ME"

echo "→ can it see the channel?"
CH=$(curl -sS -H "Authorization: Bot $TOKEN" -H 'User-Agent: govblock-agents/1' \
  "https://discord.com/api/v10/channels/$CHANNEL")
if ! grep -q '"id"' <<<"$CH"; then
  echo "   it cannot: $CH" >&2
  echo "   (invite it to the server with View Channels + Read Message History)" >&2
  exit 1
fi
python3 -c 'import json,sys; d=json.load(sys.stdin); print("   channel:", d.get("name"), "· type", d.get("type"))' <<<"$CH"

echo "→ writing $SECRET_ID"
aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ID" --region "$REGION" \
  --secret-string "$(python3 -c 'import json,sys; print(json.dumps({"bot_token": sys.argv[1], "guild_id": sys.argv[2], "channel_id": sys.argv[3]}))' "$TOKEN" "$GUILD" "$CHANNEL")" \
  --query 'VersionId' --output text

echo
echo "Done. /agents/discord lists the channel's threads within five minutes —"
echo "the secret reader caches for that long — or immediately after the next deploy."
