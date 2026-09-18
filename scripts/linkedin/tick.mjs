// The LinkedIn publisher's clock: once a minute, ask the site to send every
// scheduled post that is due (POST /api/linkedin/publish).
//
//   node scripts/linkedin/tick.mjs                       # localhost:3000
//   node scripts/linkedin/tick.mjs https://gov.nysgpt.com
//
// Reads LINKEDIN_CRON_SECRET from apps/web/.env.local. The deployed site
// needs something to call it the same way, each minute.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  readFileSync(join(root, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)
const secret = process.env.LINKEDIN_CRON_SECRET ?? env.LINKEDIN_CRON_SECRET
if (!secret) {
  console.error("LINKEDIN_CRON_SECRET is not set in apps/web/.env.local")
  process.exit(2)
}
const origin = process.argv[2] ?? "http://localhost:3000"

async function tick() {
  try {
    const response = await fetch(`${origin}/api/linkedin/publish`, { method: "POST", headers: { "x-linkedin-cron": secret } })
    const body = await response.json().catch(() => ({}))
    const stamp = new Date().toLocaleTimeString()
    if (!response.ok) console.error(`${stamp}  ${response.status} ${JSON.stringify(body)}`)
    else if (body.sent || body.failed) console.log(`${stamp}  sent ${body.sent}, failed ${body.failed}`)
  } catch (error) {
    console.error(`${new Date().toLocaleTimeString()}  ${error.message}`)
  }
}

await tick()
setInterval(tick, 60_000)
