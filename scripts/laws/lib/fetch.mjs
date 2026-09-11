// One request at a time, named, cached on disk, and backed off when told to.
//
// The point is to make public law free to read, not to hammer a legislature's
// website. Every loader goes through here: a real user agent that says who is
// asking and how to reach them, a pause between requests, a retry on 5xx and
// 429 that honours Retry-After, and a file cache so a re-run after a crash
// costs the source nothing.
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const UA = "GovBlock/1.0 (+https://gov.nysgpt.com; open public-law mirror; brendan@nysgpt.com)"

const CACHE = process.env.LAWS_CACHE || "/tmp/govblock-laws"
mkdirSync(CACHE, { recursive: true })

let last = 0
/** Milliseconds between requests to the same source. Raised by a 429. */
let gap = Number(process.env.LAWS_GAP ?? 350)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function pace() {
  const since = Date.now() - last
  if (since < gap) await wait(gap - since)
  last = Date.now()
}

const keyOf = (url) => createHash("sha1").update(url).digest("hex").slice(0, 20)

/**
 * Fetch a URL as text, cached. `cache: false` for anything that must be live.
 */
export async function get(url, { cache = true, json = false, binary = false, headers = {} } = {}) {
  const file = join(CACHE, keyOf(url) + (binary ? ".bin" : ".txt"))
  if (cache && existsSync(file)) {
    const body = binary ? readFileSync(file) : readFileSync(file, "utf8")
    return json ? JSON.parse(body) : body
  }
  for (let attempt = 0; ; attempt++) {
    await pace()
    let response
    try {
      response = await fetch(url, { headers: { "user-agent": UA, accept: json ? "application/json" : "*/*", ...headers }, redirect: "follow" })
    } catch (error) {
      if (attempt >= 5) throw error
      await wait(2000 * (attempt + 1))
      continue
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt >= 5) throw new Error(`${response.status} ${response.statusText} for ${url}`)
      const retry = Number(response.headers.get("retry-after") ?? 0)
      // A 429 is the source saying the gap is too short. Believe it, for the
      // rest of the run and not just this request.
      if (response.status === 429) gap = Math.min(5000, gap * 2)
      await wait(retry ? retry * 1000 : 2000 * (attempt + 1))
      continue
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
    const body = binary ? Buffer.from(await response.arrayBuffer()) : await response.text()
    if (cache) writeFileSync(file, body)
    return json ? JSON.parse(body) : body
  }
}

/** A large file, streamed to disk once and kept. Returns the path. */
export async function download(url, name) {
  const file = join(CACHE, name)
  if (existsSync(file)) return file
  await pace()
  const response = await fetch(url, { headers: { "user-agent": UA } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  return file
}

export const cacheDir = CACHE
