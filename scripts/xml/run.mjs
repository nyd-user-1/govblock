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
//   (or queue the jobs under a run named rebuild-…: enqueue.mjs --juris us-ny --kind statute --run rebuild-ny-789f535)
//
// Long runs go under nohup with a log in ~/govblock-xml/logs/ (program brief).
import { createHash } from "node:crypto"
import { cpus } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"

import { exec, one } from "../laws/lib/db.mjs"
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

// A task is kept here until its thread answers: `resolve` for the caller,
// `task` so it can go to another thread, `worker` to know whose it is.
const tasks = new Map()
let seq = 0
let waiters = []
const wake = () => {
  const w = waiters
  waiters = []
  for (const fn of w) fn()
}
const CAPACITY = INFLIGHT * 2
// A front end that has not returned from one document in a minute has met
// input its patterns cannot finish on (New York 2025, 2026-09-14): the thread
// is replaced, that document falls out, and the thread's other tasks go again.
const STALL_MS = 60_000

function spawnWorker() {
  return new Promise((resolve) => {
    const w = new Worker(join(HERE, "worker.mjs"), { workerData: { bundle, ir, inflight: INFLIGHT, dry: DRY } })
    w.pending = 0
    w.parsing = null
    w.lastWord = Date.now()
    w.on("message", (msg) => {
      w.lastWord = Date.now()
      if (msg.ready) return resolve(w)
      if (msg.parsing !== undefined) {
        w.parsing = msg.parsing
        return
      }
      w.pending--
      const t = tasks.get(msg.seq)
      tasks.delete(msg.seq)
      t?.resolve(msg)
      wake()
    })
    w.on("error", (e) => log(`worker error: ${e?.stack ?? e}`))
  })
}

const pool = await Promise.all(Array.from({ length: WORKERS }, spawnWorker))

setInterval(async () => {
  for (let i = 0; i < pool.length; i++) {
    const w = pool[i]
    if (!w.pending || w.parsing === null || Date.now() - w.lastWord < STALL_MS) continue
    const culprit = w.parsing
    const mine = [...tasks].filter(([, t]) => t.worker === w)
    log(`a thread has been on one document for ${Math.round((Date.now() - w.lastWord) / 1000)} s; replacing it and sending its ${mine.length - 1} other tasks again`)
    w.pending = Number.POSITIVE_INFINITY // nothing more goes to it while it is replaced
    void w.terminate()
    pool[i] = await spawnWorker()
    for (const [id, t] of mine) {
      tasks.delete(id)
      if (id === culprit || t.retried) t.resolve({ seq: id, ok: false, stage: "parse", reason: "front end did not finish", detail: `${t.task.info.work} ran past ${STALL_MS / 1000} s` })
      else submit(t.task, true).then(({ result }) => result.then(t.resolve))
    }
    wake()
  }
}, 10_000).unref()

/**
 * A document to the least busy thread, once one has room: resolves when it
 * is handed over, with `result` for its outcome. A job reads its next
 * document only after this resolves. (Handing every document over at once
 * left New York 2025's 34,216 printings waiting in memory, each woken on
 * every reply from every thread, and the controller did nothing else.)
 */
async function submit(task, retried = false) {
  for (;;) {
    const w = pool.reduce((a, b) => (b.pending < a.pending ? b : a))
    if (w.pending < CAPACITY) {
      w.pending++
      const id = ++seq
      const result = new Promise((resolve) => {
        tasks.set(id, { resolve, task, worker: w, retried })
        w.postMessage({ seq: id, frontEnd: task.frontEnd, source: task.source, info: task.info })
      })
      return { result }
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

  // A job queued under a "rebuild-" run rebuilds what it holds, whichever controller takes it.
  const rebuild = REBUILD || String(job.run ?? "").startsWith("rebuild-")
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
  // Element names the front end did not know, summed over the job: what holds its coverage down.
  const unknown = new Map()
  // What the state front ends said did not parse, by pattern: the count of documents and the first one.
  const notes = new Map()
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
      if (!rebuild && prior && prior.source_hash === sourceHash && Number(prior.builder) === BUILDER && prior.front_end === frontEndName(item.frontEnd)) {
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

      // What the index row needs, taken off the item now, so a result waiting
      // on a slow index write does not keep the document's whole text alive.
      const row = {
        work: item.work, kind: item.info.kind, jurisdiction: job.jurisdiction, session: item.session ?? null, unit: item.unit ?? "",
        label: item.label ?? null, fidelity: item.info.fidelity, source_url: item.sourceUrl ?? null, source_ref: item.sourceRef ?? null,
        source_hash: sourceHash, builder: BUILDER, job_id: job.id,
      }
      const { result } = await submit({ frontEnd: item.frontEnd, source: item.source, info })
      const p = result.then(async (r) => {
        inflight.delete(p)
        if (!r.ok) {
          counts.fellOut++
          const w = fallouts.add({ work: row.work, sourceRef: row.source_ref, stage: r.stage, reason: r.reason, detail: r.detail })
          if (w && !DRY) await w
          return
        }
        counts.built++
        counts.bytes += r.bytes
        coverageSum += r.coverage
        for (const [tag, n] of r.unknown) unknown.set(tag, (unknown.get(tag) ?? 0) + n)
        for (const note of r.notes ?? []) {
          const seenNote = notes.get(note)
          if (seenNote) seenNote.n++
          else notes.set(note, { n: 1, work: row.work, ref: row.source_ref })
        }
        if (!DRY)
          await index.add({
            ...row, expression: r.expression, expression_date: r.date, date_basis: r.dateBasis, coverage: Number(r.coverage.toFixed(4)),
            dialect: r.dialect, front_end: r.frontEnd, s3_key: r.key, content_hash: r.contentHash, bytes: r.bytes, gz_bytes: r.gzBytes,
          })
      })
      inflight.add(p)
      // When the cluster is slow the index falls behind the compiler; reading on would only pile rows up in memory.
      while (!DRY && index.backlog > 3) await new Promise((r) => setTimeout(r, 250))
      if (Date.now() - lastBeat > 30_000) {
        lastBeat = Date.now()
        await beat()
      }
    }
    await Promise.all(inflight)
    // The job's twenty most frequent unknown elements, as coverage fall-outs, for the grammar work (window 3).
    for (const [tag, n] of [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 20)) fallouts.add({ work: null, sourceRef: null, stage: "coverage", reason: `<${tag}>`, detail: `${n} in ${job.jurisdiction} ${job.kind} ${job.unit}` })
    // And the twenty most frequent notes, the same way, each with the first document that raised it (window 8).
    for (const [note, { n, work, ref }] of [...notes].sort((a, b) => b[1].n - a[1].n).slice(0, 20)) fallouts.add({ work, sourceRef: ref, stage: "coverage", reason: note, detail: `${n} documents in ${job.jurisdiction} ${job.kind} ${job.unit}` })
    if (!DRY) {
      await index.flush()
      await fallouts.flush()
      await touch(seen)
      // A rebuild re-addresses what moved (a printing dropped as a duplicate,
      // a stage renumbered): rows an earlier job of this unit wrote and this
      // one did not rewrite are no longer in the corpus. Their objects stay.
      if (rebuild && counts.fellOut === 0) {
        const pruned = await exec(
          `delete from expressions where jurisdiction = $1 and kind = $2 and built_at < $3::timestamptz
             and job_id in (select id from xml_jobs where jurisdiction = $1 and kind = $2 and unit = $4 and id <> $5)`,
          [job.jurisdiction, job.kind, new Date(t0).toISOString(), job.unit, job.id]
        )
        if (pruned.numberOfRecordsUpdated) jlog(`${pruned.numberOfRecordsUpdated.toLocaleString()} expressions an earlier build addressed differently, removed from the index`)
      }
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
