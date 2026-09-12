// Many requests to one host at once, at the rate that host will bear.
//
// The polite fetcher in fetch.mjs is one request at a time, which is right for
// an API that hands back a whole law in one call and hopeless for a state that
// publishes ten thousand pages. This is the other shape: a lane pool per host
// that starts at eight, climbs while the host answers 200, halves on a 429 or
// a 503, and remembers the ceiling it found so the ledger can record it.
//
// Every body is written to disk under the state it belongs to, so a re-parse
// never re-fetches and the originals can be pushed to S3 as they are taken.
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { createRequire } from "node:module"

import { UA, cacheDir } from "./fetch.mjs"
import { completeChain, isChainGap, trusted } from "./certs.mjs"

const START = Number(process.env.LAWS_LANES ?? 8)
const CEILING = Number(process.env.LAWS_LANES_MAX ?? 24)

const hosts = new Map()

// One dispatcher for the run, rebuilt whenever an intermediate is added, so
// every later request trusts what the last host taught us. It has to be
// undici's own — `fetch` takes a dispatcher, not an https.Agent — and undici
// is already in the tree as one of the app's dependencies.
const { Agent } = createRequire(import.meta.url)("undici")
let dispatcher = null
// Thirty seconds to connect rather than undici's ten: several legislatures
// answer slowly under load, and a connect timeout reads as a dead host.
const agent = () =>
  (dispatcher ??= new Agent({ connect: { ca: trusted(), timeout: Number(process.env.LAWS_CONNECT_TIMEOUT ?? 30000) } }))

// Some hosts count requests rather than measure their rate — Florida's BigIP
// answers `X-Throttle-Reason: crawler-penalty-active` and `Retry-After: 300`
// once a window's count is past, and no number of lanes is the answer to that.
// A minimum spacing is: `LAWS_MIN_GAP` milliseconds between one host's
// requests, whatever the width of the pool.
const GAP = Number(process.env.LAWS_MIN_GAP ?? 0)

function laneState(host) {
  if (!hosts.has(host)) hosts.set(host, { lanes: START, inFlight: 0, clean: 0, best: START, waiting: [], until: 0, last: 0 })
  return hosts.get(host)
}

/** The ceiling each host was found to bear, for the ledger. */
export function lanesFound() {
  return [...hosts.entries()].map(([host, s]) => `${host}=${s.best}`).join(" ")
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function slot(host) {
  const s = laneState(host)
  while (true) {
    const now = Date.now()
    if (now < s.until) {
      await sleep(s.until - now)
      continue
    }
    if (s.inFlight < s.lanes) {
      if (GAP && now - s.last < GAP) {
        await sleep(GAP - (now - s.last))
        continue
      }
      s.last = Date.now()
      s.inFlight += 1
      return s
    }
    await new Promise((r) => s.waiting.push(r))
  }
}

function release(s) {
  s.inFlight -= 1
  const next = s.waiting.shift()
  if (next) next()
}

/** Where a URL's body is kept: one file per state, named after the URL's own path. */
export function originalPath(state, url) {
  const u = new URL(url)
  const clean = (u.pathname + (u.search ? "_" + u.search.replace(/[?&=]/g, "_") : ""))
    .replace(/[^A-Za-z0-9._/-]/g, "_")
    .replace(/^\/+/, "")
  const name = clean || "index"
  // A path that would run past the filesystem's name limit falls back to a
  // hash of the whole URL.
  const safe = name.length < 180 ? name : createHash("sha1").update(url).digest("hex")
  // ".body" on the end, always: a site serves both /Statutes/2025 and
  // /Statutes/2025/Title1, and without the suffix the first would have to be
  // a file and a directory at once.
  return join(cacheDir, "orig", state.toUpperCase(), u.host, safe + ".body")
}

/**
 * One document, fetched at the host's pace and kept on disk.
 *
 * `notFound: null` answers a 404 with null rather than throwing, because a
 * source enumerated by number has gaps and a gap is not a failure. A 404 is
 * remembered too, in a marker beside the file, so an enumeration is walked
 * once rather than on every re-run.
 */
export async function fetchDoc(state, url, options = {}) {
  // A caller that has already said a missing document is a gap rather than a
  // stop means that of any failure it cannot get past: a host that hangs up on
  // one chapter should cost that chapter, not the state.
  if (options.notFound === null) {
    try {
      return await take(state, url, options)
    } catch {
      return null
    }
  }
  return take(state, url, options)
}

async function take(state, url, { json = false, notFound = "throw", headers = {}, validate = null } = {}) {
  const file = originalPath(state, url)
  if (existsSync(file + ".404")) {
    if (notFound === "throw") throw new Error(`404 ${url}`)
    return null
  }
  if (existsSync(file)) {
    const body = readFileSync(file, "utf8")
    // A body that fails the caller's own test is not the document: an edge
    // cache that answers with an application shell where a document was asked
    // for has to be asked again rather than remembered.
    if (!validate || validate(body)) return json ? JSON.parse(body) : body
  }
  const host = new URL(url).host
  const s = await slot(host)
  try {
    for (let attempt = 0; ; attempt++) {
      let response
      try {
        response = await fetch(url, {
          headers: { "user-agent": UA, accept: json ? "application/json" : "*/*", ...headers },
          redirect: "follow",
          signal: AbortSignal.timeout(Number(process.env.LAWS_TIMEOUT ?? 60000)),
          dispatcher: agent(),
        })
      } catch (error) {
        // A chain that does not reach a root is the host's omission, not a
        // refusal: complete it from the address its own certificate names and
        // try again without spending an attempt or narrowing the pool.
        if (isChainGap(error) && completeChain(host, (m) => console.log(`  ${m}`))) {
          dispatcher = null
          attempt -= 1
          continue
        }
        // A timeout or a closed socket is a refusal, not a pause: it holds a
        // lane, so it narrows the pool the same way a 429 does. A host that
        // hangs up under width says so by hanging up, and the answer is to
        // wait and come back narrower rather than to give up on the document.
        back(s)
        if (attempt >= 8) throw error
        const wait = Math.min(30_000, 2000 * (attempt + 1))
        s.until = Date.now() + wait
        await sleep(wait)
        continue
      }
      if (response.status === 404 || response.status === 410) {
        keptOr(file + ".404", "")
        if (notFound === "throw") throw new Error(`404 ${url}`)
        return null
      }
      // A 3xx that reached here is one `fetch` would not follow — a WAF
      // answering 307 with no Location, which is Sucuri's way of saying the
      // count is too high. It is a refusal to wait out, not a redirect.
      const soft = response.status >= 300 && response.status < 400
      if (soft || response.status === 403 || response.status === 429 || response.status >= 500) {
        back(s)
        const retry = Number(response.headers.get("retry-after") ?? 0)
        // A 429 is not a failure, it is the host naming a price. Florida's is
        // five minutes and it means it; the run waits rather than dies, and it
        // waits for the whole host so the other lanes do not spend the wait
        // earning a longer one. A 5xx gets the shorter patience of a fault.
        // A 403 from a host that was answering a moment ago is a doorman
        // counting, not a door locked: narrow, wait, and ask again. One that
        // means it will still be 403 after the budget, and then it is a
        // refusal to route around rather than a pause to wait out.
        const budget = response.status === 429 ? 20 : response.status === 403 || soft ? 8 : 5
        if (attempt >= budget) throw new Error(`${response.status} for ${url}`)
        const wait = retry
          ? retry * 1000
          : response.status === 429
            ? Math.min(300_000, 15_000 * (attempt + 1))
            : response.status === 403 || soft
              ? Math.min(60_000, 5_000 * (attempt + 1))
              : 1500 * (attempt + 1)
        // The pause is the host's, not this request's: every lane waits it out.
        s.until = Date.now() + wait
        await sleep(wait)
        continue
      }
      if (!response.ok) throw new Error(`${response.status} for ${url}`)
      const body = decodeBody(await response.arrayBuffer(), response.headers.get("content-type"))
      if (validate && !validate(body)) {
        if (attempt >= 4) throw new Error(`not the document at ${url}`)
        await sleep(1000 * (attempt + 1))
        continue
      }
      forward(s)
      keptOr(file, body)
      return json ? JSON.parse(body) : body
    }
  } finally {
    release(s)
  }
}

/**
 * A document's bytes as text, in the encoding it was served in.
 *
 * Half the legislatures on this list still publish ISO-8859-1 — South
 * Carolina and Oregon say so in their headers, others only in a `<meta>` —
 * and reading those bytes as UTF-8 turns every dash, curly quote and section
 * mark into a replacement character in the middle of the law. Everything is
 * kept on disk as UTF-8 once it is decoded, so a re-parse never has to know.
 */
function decodeBody(buffer, contentType) {
  const stated = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1]
  const bytes = new Uint8Array(buffer)
  let charset = stated
  if (!charset) {
    // No header: the page's own <meta> is the next best word, and it is always
    // inside the first couple of kilobytes.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096))
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
  }
  try {
    return new TextDecoder(charset || "utf-8", { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

function keep(file, body) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
}

/** A path that a sibling already claimed as a file is not worth failing over. */
function keptOr(file, body) {
  try {
    keep(file, body)
  } catch {
    // Left uncached rather than thrown: the row matters, the mirror can be
    // rebuilt, and a name clash is the filesystem's problem, not the law's.
  }
}

/** A clean run widens the pool; the host tells us when to stop by refusing. */
function forward(s) {
  s.clean += 1
  if (s.clean >= 200 && s.lanes < CEILING) {
    s.lanes += 4
    s.best = Math.max(s.best, s.lanes)
    s.clean = 0
  }
}

function back(s) {
  s.clean = 0
  s.lanes = Math.max(2, Math.floor(s.lanes / 2))
}

/**
 * Run a job over every item, `width` of them at a time, in order.
 *
 * The pool above bounds what reaches a host; this bounds what is in memory,
 * which for a state whose chapters are a megabyte each is the other ceiling.
 */
export async function map(items, width, job, onProgress) {
  const out = new Array(items.length)
  let at = 0
  let done = 0
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (at < items.length) {
      const i = at++
      out[i] = await job(items[i], i)
      done += 1
      onProgress?.(done, items.length)
    }
  })
  await Promise.all(workers)
  return out
}
