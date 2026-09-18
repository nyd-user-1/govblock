import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// An access token can post as the member, so it is sealed before it reaches
// the database: AES-256-GCM under LINKEDIN_TOKEN_KEY, or a key derived from
// the client secret when that is unset. Rotating either leaves the stored
// tokens unreadable, which reads as disconnected: reconnect and it is fixed.

function key() {
  const secret = process.env.LINKEDIN_TOKEN_KEY || process.env.LINKEDIN_CLIENT_SECRET
  if (!secret) throw new Error("LINKEDIN_CLIENT_SECRET is not set")
  return createHash("sha256").update(`linkedin-token:${secret}`).digest()
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".")
}

/** The token, or null when it was sealed under another key. */
export function unseal(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64url"))
    const decipher = createDecipheriv("aes-256-gcm", key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}
