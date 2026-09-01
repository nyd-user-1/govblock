import "server-only"

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"

// One JSON secret, read by the Amplify compute role, cached briefly.
//
// Five minutes: long enough that a burst of tool calls costs one read, short
// enough that writing a token into a secret takes effect without a deploy —
// which is the whole point, since connecting a service is Brendan running a
// script, not a release. A failed read is cached as empty rather than retried
// on every call: the connection is simply not connected, and the agent says so.

const REGION = process.env.AWS_REGION || "us-east-1"
const TTL = 5 * 60_000

let client: SecretsManagerClient | null = null
const cache = new Map<string, { at: number; value: Record<string, string> }>()

export async function readSecret(id: string): Promise<Record<string, string>> {
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  if (!client) client = new SecretsManagerClient({ region: REGION })
  let value: Record<string, string> = {}
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: id }))
    if (result.SecretString) value = JSON.parse(result.SecretString) as Record<string, string>
  } catch {
    value = {}
  }
  cache.set(id, { at: Date.now(), value })
  return value
}
