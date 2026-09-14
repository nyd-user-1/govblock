// One compiler thread: a source document in, a stored USLM object out. The
// controller (run.mjs) reads sources and writes the index; this thread runs
// the front end, writes the document, hashes and gzips it, and PUTs it to S3,
// holding up to `inflight` PUTs open at once while it parses the next.
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"
import { parentPort, workerData } from "node:worker_threads"

import { BUCKET, expressionOf, keyOf } from "./lib/address.mjs"
import { first, textOf, wrap } from "./lib/emit.mjs"

const require = createRequire(import.meta.url)
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")

const { frontEndFor } = await import(pathToFileURL(workerData.bundle).href)
const { toXml } = await import(pathToFileURL(workerData.ir).href)
const s3 = new S3Client({ region: "us-east-1", maxAttempts: 8 })
const DRY = !!workerData.dry

/** "2019-00-12" is in GPO's own metadata; a date only counts if the calendar has it. */
function real(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return y >= 1789 && y <= 2100 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? iso : null
}

/** A printing's own date, where the document states one: Dublin Core first, then a dated action. */
function dateIn(doc) {
  const dc = first(doc, "dc:date")
  const iso = real(dc && /\d{4}-\d{2}-\d{2}/.exec(textOf(dc))?.[0])
  if (iso) return iso
  const created = first(doc, "dcterms:created")
  const iso2 = real(created && /\d{4}-\d{2}-\d{2}/.exec(textOf(created))?.[0])
  if (iso2) return iso2
  const attr = first(doc, "date")?.attrs?.date
  if (attr && /^\d{8}$/.test(attr)) return real(`${attr.slice(0, 4)}-${attr.slice(4, 6)}-${attr.slice(6, 8)}`)
  if (attr && /^\d{4}-\d{2}-\d{2}/.test(attr)) return real(attr.slice(0, 10))
  return null
}

async function handle(task) {
  const { info } = task
  let stage = "parse"
  // The controller's watchdog reads this: the document a thread is stuck on is the one it named last.
  parentPort.postMessage({ parsing: task.seq })
  try {
    const fe = frontEndFor(task.frontEnd)
    const { doc, report } = fe.parse(task.source)
    if (report.dialect === "unknown") return { seq: task.seq, ok: false, stage, reason: "unrecognised document", detail: report.notes.join("; ").slice(0, 300) }
    // A captured error page is not an Expression of the bill: stored, it would draw an empty
    // bill where the reader should fall back to the plain text. It falls out, asking for a re-fetch.
    if (report.dialect === "error-page") return { seq: task.seq, ok: false, stage: "source", reason: "error page captured instead of the bill; re-fetch", detail: `${info.work} ${report.notes.join("; ")}`.slice(0, 300) }

    let date = info.date
    let dateBasis = info.dateBasis
    if (!date || info.preferDocDate) {
      const own = dateIn(doc)
      if (own) {
        date = own
        dateBasis = info.docDateBasis ?? "printed"
      }
    }
    // A printing that states no date of its own (a star print, a calendar
    // placement) takes the date GPO issued its package, from the package's MODS.
    if (!date && info.modsUrl) {
      stage = "date"
      const mods = await fetch(info.modsUrl, { headers: { "user-agent": "govblock-xml/1.0 (+https://gov.nysgpt.com; brendan@nysgpt.com)" }, signal: AbortSignal.timeout(30_000) })
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "")
      const issued = real(/<dateIssued[^>]*>(\d{4}-\d{2}-\d{2})/.exec(mods)?.[1])
      if (issued) {
        date = issued
        dateBasis = "printed"
      }
    }
    if (!date) return { seq: task.seq, ok: false, stage, reason: "no date", detail: info.modsUrl ?? info.source ?? null }
    const expression = info.expression ?? expressionOf(date, info.stage)

    stage = "emit"
    const xml = wrap(doc, { ...info, date, dateBasis, coverage: report.coverage, dialect: report.dialect, frontEnd: fe.profile.jurisdiction === "*" ? "text" : task.frontEnd.toLowerCase() }, toXml)
    const body = Buffer.from(xml, "utf8")
    const contentHash = createHash("sha256").update(body).digest("hex")
    const gz = gzipSync(body, { level: 6 })
    const key = keyOf(info.work, expression)

    stage = "store"
    if (!DRY) await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: gz, ContentType: "application/xml", ContentEncoding: "gzip" }))

    const unknown = Object.entries(report.unknown).sort((a, b) => b[1] - a[1]).slice(0, 5)
    // The state front ends name no unknown elements; they say what did not parse in notes,
    // folded to a pattern as scripts/xml/coverage.mjs folds them ("subsection N after N").
    const notes = [...new Set(report.notes.map((note) => note.replace(/\d+/g, "N").replace(/:\s.*$/, "").slice(0, 60)))]
    return {
      seq: task.seq, ok: true, key, expression, date, dateBasis, contentHash,
      bytes: body.length, gzBytes: gz.length, coverage: report.coverage, dialect: report.dialect,
      frontEnd: fe.profile.jurisdiction === "*" ? "text" : task.frontEnd.toLowerCase(), unknown, notes,
    }
  } catch (error) {
    return { seq: task.seq, ok: false, stage, reason: String(error?.name ?? "Error"), detail: String(error?.message ?? error).slice(0, 300) }
  }
}

let open = 0
const queue = []
const pump = () => {
  while (open < workerData.inflight && queue.length) {
    const task = queue.shift()
    open++
    handle(task).then((result) => {
      open--
      parentPort.postMessage(result)
      pump()
    })
  }
}
parentPort.on("message", (task) => {
  queue.push(task)
  pump()
})
parentPort.postMessage({ ready: true })
