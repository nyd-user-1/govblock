#!/usr/bin/env bash
# Which Claude this account can actually invoke on Bedrock.
#
# `aws bedrock list-foundation-models` advertises the whole Anthropic catalogue
# and `get-foundation-model-availability` reports AUTHORIZED / AVAILABLE for
# models a Converse call refuses. The only honest probe is an invoke, so this
# script invokes every us.* Anthropic inference profile the region lists and
# prints ANSWERS or DENIED for each. Run it before changing lib/agents/models.ts.
set -uo pipefail
REGION="${1:-us-east-1}"

aws bedrock list-inference-profiles --region "$REGION" \
  --query 'inferenceProfileSummaries[?starts_with(inferenceProfileId,`us.anthropic`)].inferenceProfileId' \
  --output text | tr '\t' '\n' | sort | while read -r id; do
  [ -n "$id" ] || continue
  out=$(aws bedrock-runtime converse --region "$REGION" --model-id "$id" \
    --messages '[{"role":"user","content":[{"text":"Reply with exactly: OK"}]}]' \
    --inference-config '{"maxTokens":16}' 2>&1)
  if grep -q '"stopReason"' <<<"$out"; then
    printf 'ANSWERS  %-52s %s\n' "$id" "$(tr -d '\n ' <<<"$out" | grep -o '"latencyMs":[0-9]*')"
  else
    printf 'DENIED   %-52s %s\n' "$id" "$(grep -o 'An error occurred ([A-Za-z]*)' <<<"$out" | head -1)"
  fi
done
