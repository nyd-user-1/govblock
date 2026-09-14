// The compiler's controller, on the box. Takes jobs from `xml_jobs` (one
// jurisdiction and one session, or one jurisdiction and one code), reads each
// job's sources, hands every document to a pool of worker threads that run
// the front end, write the USLM and PUT it to S3, and writes the index rows
// and fall-outs back to Aurora as the results return.
//
//   node scripts/xml/run.mjs                      drain the queue, then exit
//   node scripts/xml/run.mjs --watch              keep polling for jobs (the dashboard's run controls)
//   node scripts/xml/run.mjs --only us,us-ny      only these jurisdictions
//   node scripts/xml/run.mjs --kind bill          only bills (or statute)
//   node scripts/xml/run.mjs --run nightly-       only jobs of runs named so
//   node scripts/xml/run.mjs --slots 2            jobs at once (default 2)
//   node scripts/xml/run.mjs --workers 7          compiler threads (default: cores - 1)
//   node scripts/xml/run.mjs --job 12 --dry       one job, nothing written
//   node scripts/xml/run.mjs --rebuild            rebuild held Expressions in place (a front end improved)
//
// Long runs go under nohup with a log in ~/govblock-xml/logs/ (program brief).
import { createHash } from "node:crypto"
import { cpus } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"

import { one } from "../laws/lib/db.mjs"
import { load } from "./bundle.mjs"
import { claim, falloutLog, finish, heartbeat, holdings, indexWriter, reclaimStale, touch, WORKER } from "./lib/store.mjs"
import { sourceFor } from "./sources/index.mjs"

/** The build of this controller and its emitter. A bump rebuilds every Expression on its next run. */
export const BUILDER = 2

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback = null) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : fallback
}

const DRY = flag("dry")
const WATCH = flag("watch")
const SLOTS = Number(value("slots", 2))
const WORKERS = Number(value("workers", Math.max(1, cpus().length - 1)))
const INFLIGHT = Number(value("inflight", 24))
const ONLY = value("only")?.split(",").map((s) => s.trim().toLowerCase()) ?? null
const KIND = value("kind")
const JOB = value("job")
// A front end that improved without changing its name: build what is held again, in place.
const REBUILD = flag("rebuild")
// Only jobs whose run starts with this: the nightly run drains its own ("nightly-").
const RUN = value("run")

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19)
const log = (m) => console.log(`${stamp()} ${m}`)
// One failed write is a fall-out or a failed job, never the whole night's run.
process.on("unhandledRejection", (error) => log(`unhandled: ${error?.stack ?? error}`))

// ------------------------------------------------------------------- pool ---

// bundle.mjs writes the front ends to one module; the threads import that file.
const frontEnds = await load("lib/xml/frontends/index.ts")
await load("lib/xml/ir.ts")
const bundle = join(HERE, "..", "..", "node_modules/.cache/govblock-xml/lib__xml__frontends__index.mjs")
const ir = join(HERE, "..", "..", "node_modules/.cache/govblock-xml/lib__xml__ir.mjs")
/** What `expressions.front_end` records for a jurisdiction: its own grammar's code, or "text". */
const frontEndName = (code) => (frontEnds.frontEndFor(code).profile.jurisdiction === "*" ? "text" : code.toLowerCase())

const pool = await Promise.all(
  Array.from({ length: WORKERS }, () =>
    new Promise((resolve) => {
      const w = new Worker(join(HERE, "worker.mjs"), { workerData: { bundle, ir, inflight: INFLIGHT, dry: DRY } })
      w.pending = 0
      w.on("message", (msg) => {
        if (msg.ready) return resolve(w)
        w.pending--
        const cb = callbacks.get(msg.seq)
        callbacks.delete(msg.seq)
        cb?.(msg)
        wake()
      })
      w.on("error", (e) => log(`worker error: ${e?.stack ?? e}`))
    })
  )
)
const callbacks = new Map()
let seq = 0
let waiters = []
const wake = () => {
  const w = waiters
  waiters = []
  for (const fn of w) fn()
}
const CAPACITY = INFLIGHT * 2

/** A document to the least busy thread; resolves with its result. Waits while every thread is full. */
async function compile(task) {
  for (;;) {
    const w = pool.reduce((a, b) => (b.pending < a.pending ? b : a))
    if (w.pending < CAPACITY) {
      w.pending++
      const id = ++seq
      return new Promise((resolve) => {
        callbacks.set(id, resolve)
        w.postMessage({ seq: id, frontEnd: task.frontEnd, source: task.source, info: task.info })
      })
    }
    await new Promise((r) => waiters.push(r))
  }
}

// -------------------------------------------------------------------- job ---

async function runJob(job) {
  const t0 = Date.now()
  const counts = { total: 0, built: 0, unchanged: 0, fellOut: 0, bytes: 0, coverage: null }
  let coverageSum = 0
  const label = `#${job.id} ${job.jurisdiction} ${job.kind} ${job.unit}`
  const jlog = (m) => log(`${label}  ${m}`)
  const source = sourceFor(job)
  if (!source) {
    await finish(job, counts, "waiting", `no source reader for ${job.jurisdiction} ${job.kind}`)
    jlog("no source reader; set waiting")
    return
  }
  jlog(`start (${source.name})`)

  const fallouts = falloutLog(job)
  const index = indexWriter({
    onBad: (row, error) => {
      counts.built--
      counts.fellOut++
      fallouts.add({ work: row.work, sourceRef: row.source_ref, stage: "index", reason: String(error?.name ?? "index write refused"), detail: String(error?.message ?? error).slice(0, 300) })
    },
  })
  const prefixes = source.prefixes(job)
  const held = DRY ? new Map() : await holdings({ jurisdiction: job.jurisdiction, kind: job.kind, prefixes })
  if (held.size) jlog(`${held.size.toLocaleString()} works already indexed under ${prefixes.join(", ")}`)
  const seen = []
  const inflight = new Set()
  let lastBeat = Date.now()

  const beat = async () => {
    counts.coverage = counts.built ? coverageSum / counts.built : null
    if (!DRY) await heartbeat(job, counts)
    const secs = (Date.now() - t0) / 1000
    jlog(`${counts.built.toLocaleString()} built · ${counts.unchanged.toLocaleString()} unchanged · ${counts.fellOut.toLocaleString()} fell out · ${(counts.built / secs).toFixed(0)}/s`)
  }

  try {
    for await (const item of source.read(job, { log: jlog })) {
      if (item.count !== undefined) {
        counts.total += item.count
        continue
      }
      if (item.fallout) {
        counts.fellOut++
        fallouts.add(item.fallout)
        continue
      }
      if (item.countOnly) {
        counts.total++
        continue
      }

      const sourceHash = createHash("sha256").update(item.source.body).digest("hex")
      const prior = held.get(item.work)?.find((p) => p.unit === (item.unit ?? ""))
      if (!REBUILD && prior && prior.source_hash === sourceHash && Number(prior.builder) === BUILDER && prior.front_end === frontEndName(item.frontEnd)) {
        counts.unchanged++
        seen.push([item.work, prior.expression])
        continue
      }
      // Same source under a new build: the same Expression, rebuilt in place.
      // A changed statute whose date did not move: a new Expression, dated the day it was read.
      const info = { ...item.info, work: item.work, title: item.info.title ?? null, builder: BUILDER, source: item.sourceUrl ?? null }
      if (prior && prior.source_hash === sourceHash) {
        info.expression = prior.expression
        info.date = prior.date
        info.preferDocDate = false
      } else if (prior && item.info.kind !== "bill" && info.date && prior.date === info.date) {
        info.date = new Date().toISOString().slice(0, 10)
        info.dateBasis = "fetched"
      }

      const p = compile({ frontEnd: item.frontEnd, source: item.source, info }).then(async (r) => {
        inflight.delete(p)
        if (!r.ok) {
          counts.fellOut++
          const w = fallouts.add({ work: item.work, sourceRef: item.sourceRef, stage: r.stage, reason: r.reason, detail: r.detail })
          if (w && !DRY) await w
          return
        }
        counts.built++
        counts.bytes += r.bytes
        coverageSum += r.coverage
        if (!DRY)
          await index.add({
            work: item.work, expression: r.expression, expression_date: r.date, date_basis: r.dateBasis, kind: item.info.kind,
            jurisdiction: job.jurisdiction, session: item.session ?? null, unit: item.unit ?? "", label: item.label ?? null,
            fidelity: item.info.fidelity, coverage: Number(r.coverage.toFixed(4)), dialect: r.dialect, front_end: r.frontEnd, builder: BUILDER,
            source_url: item.sourceUrl ?? null, source_ref: item.sourceRef ?? null, s3_key: r.key, source_hash: sourceHash,
            content_hash: r.contentHash, bytes: r.bytes, gz_bytes: r.gzBytes, job_id: job.id,
          })
      })
      inflight.add(p)
      if (Date.now() - lastBeat > 30_000) {
        lastBeat = Date.now()
        await beat()
      }
    }
    await Promise.all(inflight)
    if (!DRY) {
      await index.flush()
      await fallouts.flush()
      await touch(seen)
    }
    counts.coverage = counts.built ? coverageSum / counts.built : null
    if (!DRY) await finish(job, counts, "done")
    const secs = (Date.now() - t0) / 1000
    jlog(`done in ${(secs / 60).toFixed(1)} min: ${counts.built.toLocaleString()} built, ${counts.unchanged.toLocaleString()} unchanged, ${counts.fellOut.toLocaleString()} fell out, ${(counts.bytes / 1e6).toFixed(0)} MB, ${(counts.built / secs).toFixed(0)}/s, coverage ${counts.coverage === null ? "—" : (counts.coverage * 100).toFixed(2) + "%"}`)
    for (const [reason, n] of fallouts.reasons) jlog(`  fell out: ${reason} ×${n}`)
  } catch (error) {
    await Promise.allSettled([...inflight])
    await index.flush().catch(() => {})
    await fallouts.flush().catch(() => {})
    const status = error?.blocked ? "blocked" : "failed"
    if (!DRY) await finish(job, counts, status, String(error?.message ?? error).slice(0, 500))
    jlog(`${status}: ${error?.stack ?? error}`)
  }
}

// ------------------------------------------------------------------- loop ---

log(`controller ${WORKER} · ${WORKERS} threads × ${INFLIGHT} in flight · ${SLOTS} job slots${DRY ? " · dry" : ""}${ONLY ? ` · only ${ONLY.join(",")}` : ""}${KIND ? ` · ${KIND}` : ""}`)

if (JOB) {
  const job = DRY ? await one(`select * from xml_jobs where id = $1`, [Number(JOB)]) : await one(`update xml_jobs set status = 'running', worker = $2, started_at = now(), heartbeat_at = now() where id = $1 returning *`, [Number(JOB), WORKER])
  if (!job) throw new Error(`no job ${JOB}`)
  await runJob(job)
} else {
  const reclaimed = await reclaimStale()
  if (reclaimed) log(`${reclaimed} stale jobs back in the queue`)
  let idle = 0
  const slot = async () => {
    for (;;) {
      const job = await claim({ jurisdictions: ONLY, kind: KIND, run: RUN })
      if (job) {
        idle = 0
        await runJob(job)
        continue
      }
      if (!WATCH) return
      if (++idle % 20 === 1) log("queue empty; watching")
      await new Promise((r) => setTimeout(r, 15_000))
    }
  }
  await Promise.all(Array.from({ length: SLOTS }, slot))
}

log("controller exits")
await Promise.all(pool.map((w) => w.terminate()))
process.exit(0)
