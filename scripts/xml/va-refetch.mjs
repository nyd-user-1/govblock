// Virginia's bills, fetched again (window 7, part 1; claimed by window 4,
// 2026-09-14). 97,115 of Virginia's stored bill texts are legacy LIS's error
// page ("Sorry, your query could not be completed", then the address it
// refused), captured when the walker fetched sessions 2010–2024 at speed from
// AWS. The same links answer with the bill today: lis.virginia.gov's CGI
// redirects to legacylis.virginia.gov, whose `ful … hil` page carries the bill
// in <div id="mainC">. The error page is legacy LIS's answer to a caller going
// too fast (fifty documents at 2.5 a second drew thirteen of them in a row,
// then bills again), so a refused document is waited on and asked again, and
// the pace slows.
//
//   node scripts/xml/va-refetch.mjs --targets                  write logs/va-refetch/targets.json from the database
//   node scripts/xml/va-refetch.mjs --rank --sample file       fifty documents through each source, measured
//   node scripts/xml/va-refetch.mjs --run [--pause-ms 750] [--limit N]
//   node scripts/xml/va-refetch.mjs --run --retry-refused      the documents a run was refused on
//
// Rules (docs/prompts/2026-09-14-acquisition.md): one request at a time to the
// legislature with a pause between, a user agent that says who is asking; a
// response that is not a bill is never stored, it is counted and named in
// failures.jsonl; "BillTexts" is written only in the loaders' shape (livingston
// api/_lib/text-shared.ts TextBuffer: upsert on document_id, rewritten only
// when the text's hash or the error differs, "Bills" stamped after), never
// deleted from, never sampled by random order. Resumable: the cursor file
// holds the last document settled.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"

import { env, q, WEB } from "../laws/lib/db.mjs"

const require = (await import("node:module")).createRequire(join(WEB, "package.json"))
const { RDSDataClient, BatchExecuteStatementCommand, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d = "") => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const DIR = join(WEB, "..", "..", "logs", "va-refetch")
mkdirSync(DIR, { recursive: true })
const TARGETS = join(DIR, "targets.json")
const CURSOR = join(DIR, "cursor")
const FAILURES = join(DIR, "failures.jsonl")
const UA = "GovBlock bill-text acquisition (legislative XML program; one request at a time)"
const FLOOR_MS = Number(val("--pause-ms", "750")) || 750
const CEILING_MS = 8000
const ERROR_PAGE = /Sorry, your query could not be completed/i
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
const sha = (s) => createHash("sha256").update(s).digest("hex")

// ------------------------------------------------ the loader's converters ---
// Verbatim from livingston api/_lib/text-shared.ts (tidy, decodeEntities,
// htmlToText), so a re-fetched Virginia text reads as every other state's.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", sect: "§", para: "¶", deg: "°" }
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}
function tidy(s) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<=\S)[ \t]{2,}/g, (m) => (m.length > 8 ? "  " : m))
    .replace(/^\n+/, "")
    .replace(/\s+$/, "")
}
function htmlToText(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(s|strike|del)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _t, inner) => (inner.trim() ? `[-${inner}-]` : ""))
    .replace(/<(ins|u)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi, (_m, _t, inner) => (inner.trim() ? `{+${inner}+}` : ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|section|article|blockquote)\s*>/gi, "\n")
    .replace(/<(p|div|tr|li|h[1-6]|section|article|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
  return tidy(decodeEntities(stripped))
}

// ------------------------------------------------------------ the sources ---

/** lis.virginia.gov/cgi-bin/legp604.exe?161+ful+HB2+hil → the same page on legacylis, where the CGI now lives. */
const legacyUrl = (link) => String(link).replace(/^https?:\/\/(?:www\.)?lis\.virginia\.gov\/cgi-bin\//i, "https://legacylis.virginia.gov/cgi-bin/")

/**
 * The bill in a legacy LIS page: <div id="mainC"> without the session heading
 * and the history/pdf links. Virginia prints new matter in <i class=new> and
 * struck matter in <s>; new matter is marked as the loader marks <ins>.
 */
export function legacyBillText(html) {
  if (ERROR_PAGE.test(html)) return { verdict: "error-page" }
  const start = html.search(/<div id="mainC">/i)
  if (start < 0) return { verdict: "no-bill-division" }
  let body = html.slice(start + '<div id="mainC">'.length)
  const end = body.search(/<\/div>\s*<\/div>\s*<div id="ftr">/i)
  if (end >= 0) body = body.slice(0, end)
  body = body
    .replace(/<h2>[\s\S]*?<\/h2>/i, "")
    .replace(/<ul id="rtNav">[\s\S]*?<\/ul>/i, "")
    .replace(/<i class=["']?new["']?>([\s\S]*?)<\/i>/gi, "<ins>$1</ins>")
  const text = htmlToText(body)
  if (!text) return { verdict: "empty" }
  if (text.length < 60 || !/\b(BILL|RESOLUTION|RESOLVED|enacted|CHAPTER|MEMORIAL|AMENDMENT)\b/i.test(text)) return { verdict: "not-a-bill", text }
  return { verdict: "bill", text }
}

const isRefusal = (r) => r.verdict === "error-page" || r.status === 429 || r.status === 503

async function fetchLegacy(link) {
  const url = legacyUrl(link)
  const t = Date.now()
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(60_000) })
    const buf = Buffer.from(await r.arrayBuffer())
    // Legacy LIS serves Windows-1252 without saying so; the section sign is 0xA7.
    const html = new TextDecoder("windows-1252").decode(buf)
    return { url, status: r.status, ms: Date.now() - t, bytes: buf.length, retryAfter: Number(r.headers.get("retry-after") ?? 0), ...(r.ok ? legacyBillText(html) : { verdict: `http-${r.status}` }) }
  } catch (error) {
    return { url, status: 0, ms: Date.now() - t, bytes: 0, verdict: `fetch-error: ${String(error?.message ?? error).slice(0, 80)}` }
  }
}

/** The LIS API, for comparison, only under a registered key (VA_LIS_API_KEY). "161" is 2016's regular session, the API's "20161". */
async function fetchApi(link) {
  const key = process.env.VA_LIS_API_KEY || env.VA_LIS_API_KEY
  // Without the key the API answers 401 (checked 2026-09-14); asking fifty more times would only be traffic.
  if (!key) return { verdict: "no-registered-key" }
  const m = /legp604\.exe\?(\d{2})(\d)\+ful\+([A-Z]+\d+)([A-Z0-9]*)\+hil/i.exec(link)
  if (!m) return { verdict: "unparseable-link" }
  const sessionCode = `20${m[1]}${m[2]}`
  const bill = m[3].toUpperCase()
  const doc = `${m[3]}${m[4]}`.toUpperCase()
  const t = Date.now()
  const headers = { WebAPIKey: key, Accept: "application/json", "User-Agent": UA }
  try {
    const list = await fetch(`https://lis.virginia.gov/LegislationText/api/getlegislationtextlistasync/?sessionCode=${sessionCode}&legislationNumber=${bill}`, { headers, signal: AbortSignal.timeout(60_000) })
    if (!list.ok) return { status: list.status, ms: Date.now() - t, verdict: `list-http-${list.status}` }
    const body = await list.json().catch(() => null)
    const item = (body?.LegislationTextList ?? []).find((i) => String(i.DocumentCode ?? "").trim().toUpperCase() === doc)
    if (!item) return { status: list.status, ms: Date.now() - t, verdict: "not-in-list" }
    await sleep(FLOOR_MS)
    const text = await fetch(`https://lis.virginia.gov/LegislationText/api/GetLegislationTextByIDAsync?legislationTextID=${item.LegislationTextID}`, { headers, signal: AbortSignal.timeout(60_000) })
    const html = (await text.json().catch(() => null))?.TextsList?.[0]?.DraftText ?? ""
    const plain = html ? htmlToText(html) : ""
    return { status: text.status, ms: Date.now() - t, verdict: plain ? "bill" : "empty", text: plain }
  } catch (error) {
    return { status: 0, ms: Date.now() - t, verdict: `fetch-error: ${String(error?.message ?? error).slice(0, 80)}` }
  }
}

// ------------------------------------------------------------- the targets ---

async function targets() {
  const t = Date.now()
  const sessions = (await q(`select session_id, count(*)::int as n from "BillTexts" where state = 'VA' and chars = 323 group by 1 order by 1`)).map((r) => r.session_id)
  const out = []
  for (const session of sessions) {
    let after = 0
    for (;;) {
      const rows = await q(
        `select t.document_id, t.bill_id, t.session_id, d.document_desc, d.state_link
           from "BillTexts" t join "Documents" d on d.document_id = t.document_id
          where t.state = 'VA' and t.session_id = $1 and t.chars = 323 and t.document_id > $2
          order by t.document_id limit 3000`,
        [session, after]
      )
      for (const r of rows) out.push([Number(r.document_id), Number(r.bill_id), Number(r.session_id), r.document_desc, r.state_link])
      if (rows.length < 3000) break
      after = rows[rows.length - 1].document_id
    }
    log(`session ${session}: ${out.length.toLocaleString()} so far`)
  }
  out.sort((a, b) => a[0] - b[0])
  writeFileSync(TARGETS, JSON.stringify(out))
  log(`${out.length.toLocaleString()} targets written to ${TARGETS} in ${((Date.now() - t) / 1000).toFixed(1)} s`)
}

// ---------------------------------------------------------------- ranking ---

async function rank() {
  const sample = JSON.parse(readFileSync(val("--sample"), "utf8"))
  const pause = Number(val("--pause-ms", "250")) || 250
  const tally = { legacy: {}, api: {} }
  const ms = { legacy: [], api: [] }
  const rows = []
  for (const d of sample) {
    const a = await fetchLegacy(d.state_link)
    await sleep(pause)
    const b = await fetchApi(d.state_link)
    if (b.ms) await sleep(pause)
    for (const [name, r] of [["legacy", a], ["api", b]]) {
      tally[name][r.verdict] = (tally[name][r.verdict] ?? 0) + 1
      if (r.ms) ms[name].push(r.ms)
    }
    rows.push({ document_id: d.document_id, session: d.session_id, bill: d.bill_number, desc: d.document_desc, legacy: a.verdict, legacyChars: a.text?.length ?? 0, legacyMs: a.ms, api: b.verdict, apiChars: b.text?.length ?? 0, head: (a.text ?? "").slice(0, 90).replace(/\s+/g, " ") })
  }
  const median = (xs) => (xs.length ? xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] : null)
  writeFileSync(join(DIR, "rank.json"), JSON.stringify({ tally, medianMs: { legacy: median(ms.legacy), api: median(ms.api) }, rows }, null, 1))
  console.log(JSON.stringify({ tally, medianMs: { legacy: median(ms.legacy), api: median(ms.api) } }))
  for (const r of rows) console.log(`${r.session} ${r.bill} ${r.desc}: legacy ${r.legacy} ${r.legacyChars} ch ${r.legacyMs} ms · api ${r.api} · ${r.head}`)
}

// ------------------------------------------------------------ the writes ---

const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })
const base = { resourceArn: env.POLICY_CLUSTER_ARN, secretArn: env.POLICY_SECRET_ARN, database: env.POLICY_DATABASE || "policy" }
const field = (v) => (v === null || v === undefined ? { isNull: true } : typeof v === "number" ? { longValue: v } : { stringValue: String(v) })

async function send(command, attempts = 20) {
  for (let i = 0; ; i++) {
    try {
      return await client.send(command)
    } catch (error) {
      const m = `${error?.name ?? ""} ${error?.message ?? error}`
      if (!/Resuming|Throttl|TooManyRequests|ServiceUnavailable|StatementTimeout|timed out|ECONNRESET|EPIPE|insufficient resources/i.test(m) || i >= attempts) throw error
      await sleep(Math.min(30_000, 2000 + i * 2000))
    }
  }
}

// TextBuffer.insertBatch, a row per parameter set: the same columns, the same
// conflict target and the same "only when the hash or the error differs".
const UPSERT = `INSERT INTO "BillTexts" (document_id, bill_id, state, session_id, version, source, mime, chars, text, text_hash, error, fetched_at)
  VALUES (:document_id, :bill_id, :state, :session_id, :version, :source, :mime, :chars, :text, :text_hash, :error, now())
  ON CONFLICT (document_id) DO UPDATE
     SET bill_id = EXCLUDED.bill_id, state = EXCLUDED.state, session_id = EXCLUDED.session_id,
         version = EXCLUDED.version, source = EXCLUDED.source, mime = EXCLUDED.mime,
         chars = EXCLUDED.chars, text = EXCLUDED.text, text_hash = EXCLUDED.text_hash,
         fetched_at = now(), error = EXCLUDED.error
   WHERE "BillTexts".text_hash IS DISTINCT FROM EXCLUDED.text_hash
      OR "BillTexts".error IS DISTINCT FROM EXCLUDED.error`

const MAX_BATCH_BYTES = 1_500_000
const COLUMNS = ["document_id", "bill_id", "state", "session_id", "version", "source", "mime", "chars", "text", "text_hash", "error"]

/** Postgres refuses a tsvector past 1,048,575 bytes; the loader cuts such a text at the longest prefix the column's expression accepts. */
async function fitForIndex(row) {
  if (row.text.length < 250_000) return
  let n = Math.min(row.text.length, 1_000_000)
  for (;;) {
    try {
      await send(new ExecuteStatementCommand({ ...base, sql: `SELECT to_tsvector('english', left(:t, :n)) IS NOT NULL AS ok`, parameters: [{ name: "t", value: { stringValue: row.text } }, { name: "n", value: { longValue: n } }] }))
      break
    } catch (error) {
      if (!/too long for tsvector/i.test(String(error?.message)) || n < 100_000) throw error
      n = Math.floor(n * 0.9)
    }
  }
  if (n < row.text.length) {
    log(`text-cut-for-index: document ${row.document_id}: ${row.text.length} -> ${n} chars`)
    row.text = row.text.slice(0, n)
  }
}

async function writeBatch(rows) {
  if (!rows.length) return
  const sets = (list) => list.map((r) => COLUMNS.map((name) => ({ name, value: field(r[name]) })))
  for (const r of rows) Object.assign(r, { chars: r.text.length, text_hash: sha(r.text) })
  try {
    await send(new BatchExecuteStatementCommand({ ...base, sql: UPSERT, parameterSets: sets(rows) }))
  } catch (error) {
    if (!/too long for tsvector/i.test(String(error?.message))) throw error
    for (const r of rows) {
      await fitForIndex(r)
      Object.assign(r, { chars: r.text.length, text_hash: sha(r.text) })
      await send(new BatchExecuteStatementCommand({ ...base, sql: UPSERT, parameterSets: sets([r]) }))
    }
  }
  // The loader stamps each bill with the text it just wrote. A bill keeps the longest text it has.
  const best = new Map()
  for (const r of rows) best.set(r.bill_id, Math.max(best.get(r.bill_id) ?? 0, r.chars))
  await send(
    new BatchExecuteStatementCommand({
      ...base,
      sql: `UPDATE "Bills" SET text_fetched_at = now(), text_chars = greatest(coalesce(text_chars, 0), :chars) WHERE bill_id = :bill_id`,
      parameterSets: [...best].map(([bill_id, chars]) => [{ name: "bill_id", value: { longValue: bill_id } }, { name: "chars", value: { longValue: chars } }]),
    })
  )
}

// ---------------------------------------------------------------- the run ---

async function run() {
  if (!existsSync(TARGETS)) throw new Error(`no ${TARGETS}; run --targets first`)
  const all = JSON.parse(readFileSync(TARGETS, "utf8"))
  const limit = Number(val("--limit", "0")) || Infinity
  let todo
  if (has("--retry-refused")) {
    const refused = new Set(
      existsSync(FAILURES)
        ? readFileSync(FAILURES, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((f) => f.verdict === "error-page" || f.status === 429 || f.status === 503).map((f) => f.document_id)
        : []
    )
    todo = all.filter((t) => refused.has(t[0])).slice(0, limit)
    log(`${refused.size.toLocaleString()} refused documents on file, ${todo.length.toLocaleString()} to ask again`)
  } else {
    const cursor = existsSync(CURSOR) ? Number(readFileSync(CURSOR, "utf8")) || 0 : 0
    todo = all.filter((t) => t[0] > cursor).slice(0, limit)
    log(`${all.length.toLocaleString()} targets, ${todo.length.toLocaleString()} after the cursor ${cursor}`)
  }
  log(`one request at a time; pause ${FLOOR_MS} ms at the fastest, slowing on refusal up to ${CEILING_MS} ms`)

  const counts = { tried: 0, stored: 0, notBill: 0, refused: 0, requests: 0, refusals: 0, chars: 0 }
  const verdicts = {}
  let pause = FLOOR_MS
  let clean = 0
  let refusedInARow = 0
  let batch = []
  let bytes = 0
  let settled = null
  let lastFlush = Date.now()
  let lastLog = Date.now()
  const started = Date.now()

  const flush = async () => {
    await writeBatch(batch)
    counts.stored += batch.length
    batch = []
    bytes = 0
    lastFlush = Date.now()
    if (settled !== null && !has("--retry-refused")) writeFileSync(CURSOR, String(settled))
  }

  for (const [document_id, bill_id, session_id, version, link] of todo) {
    let r
    for (let attempt = 1; ; attempt++) {
      r = await fetchLegacy(link)
      counts.requests++
      if (!isRefusal(r)) break
      counts.refusals++
      clean = 0
      pause = Math.min(CEILING_MS, Math.round(pause * 1.5))
      if (attempt >= 4) break
      const wait = Math.min(600_000, (r.retryAfter > 0 ? r.retryAfter * 1000 : 30_000) * attempt)
      log(`refused on ${document_id} (attempt ${attempt}): waiting ${Math.round(wait / 1000)} s; pause now ${pause} ms`)
      await sleep(wait)
    }
    counts.tried++
    verdicts[r.verdict] = (verdicts[r.verdict] ?? 0) + 1

    if (isRefusal(r)) {
      counts.refused++
      refusedInARow++
      appendFileSync(FAILURES, JSON.stringify({ document_id, bill_id, session_id, url: r.url, status: r.status, verdict: r.verdict }) + "\n")
      if (refusedInARow >= 3) {
        await flush()
        log(`stopping: three documents in a row refused after four tries each; the cursor stays at ${settled ?? "its start"}, before them`)
        break
      }
    } else {
      // Settled: stored below or named as not a bill. The cursor may pass it.
      refusedInARow = 0
      if (++clean % 300 === 0 && pause > FLOOR_MS) pause = Math.max(FLOOR_MS, Math.round(pause * 0.9))
      if (r.verdict === "bill") {
        const text = r.text.replace(/ /g, "")
        batch.push({ document_id, bill_id, state: "VA", session_id, version: version || null, source: "state_link", mime: "text/html", text, error: null })
        bytes += text.length + 200
        counts.chars += text.length
      } else {
        counts.notBill++
        appendFileSync(FAILURES, JSON.stringify({ document_id, bill_id, session_id, url: r.url, status: r.status, verdict: r.verdict, head: (r.text ?? "").slice(0, 160) }) + "\n")
      }
      if (refusedInARow === 0) settled = document_id
    }

    if (batch.length >= 50 || bytes >= MAX_BATCH_BYTES || Date.now() - lastFlush >= 30_000) await flush()
    if (Date.now() - lastLog >= 60_000) {
      lastLog = Date.now()
      const rate = counts.tried / ((Date.now() - started) / 1000)
      const left = todo.length - counts.tried
      log(`tried ${counts.tried.toLocaleString()} of ${todo.length.toLocaleString()} · stored ${counts.stored.toLocaleString()} · not a bill ${counts.notBill} · refused ${counts.refused} (${counts.refusals} refusals) · pause ${pause} ms · ${rate.toFixed(2)}/s · ${(left / rate / 3600).toFixed(1)} h left`)
    }
    await sleep(pause)
  }
  await flush()
  log(`done: ${JSON.stringify({ ...counts, verdicts, pause })} in ${((Date.now() - started) / 3600000).toFixed(2)} h`)
}

if (has("--targets")) await targets()
else if (has("--rank")) await rank()
else if (has("--run")) await run()
else {
  console.error("usage: va-refetch.mjs --targets | --rank --sample file | --run [--pause-ms 750] [--limit N] [--retry-refused]")
  process.exit(2)
}
