// The last good build's output, by part, for /routes's budget bar (Brendan,
// 2026-09-20): how much of Amplify's cap the app uses and which routes use it.
// Read off the build log, where amplify.yml prints the sizes, and written to
// lib/build-sizes.json. Run from apps/web after a deploy:
//   node scripts/routes/build-sizes.mjs
//
// The log's "output size" lines are du's whole megabytes of disk, which run a
// few percent over the bytes Amplify weighs (job 288: 236 by du, 227 by
// Amplify). The "output bytes" lines, printed since 2026-09-20, are exact;
// they are used when the log has them.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const APP = "d2a69zdzqun8m7"
const BRANCH = "main"
const CAP = 230686720
const aws = (...args) => JSON.parse(execFileSync("aws", ["amplify", ...args, "--output", "json"], { encoding: "utf8" }))

const jobs = aws("list-jobs", "--app-id", APP, "--branch-name", BRANCH, "--max-items", "15").jobSummaries
const good = jobs.find((j) => j.status === "SUCCEED")
if (!good) throw new Error("no successful build among the last 15")
const job = aws("get-job", "--app-id", APP, "--branch-name", BRANCH, "--job-id", good.jobId).job
const log = await (await fetch(job.steps.find((s) => s.stepName === "BUILD").logUrl)).text()

const MB = 1048576
const exact = [...log.matchAll(/output bytes: (\d+)\t(\S+)/g)].map((m) => [m[2], Number(m[1])])
const rough = [...log.matchAll(/output size: (\d+)\t(\S+)/g)].map((m) => [m[2], Number(m[1]) * MB])
const sizes = new Map(exact.length ? exact : rough)
const total = exact.length ? sizes.get(".next") : Number(/output size: (\d+)M \.next/.exec(log)?.[1] ?? 0) * MB
const get = (key) => sizes.get(key) ?? 0

const routes = [...sizes].filter(([key]) => key.startsWith(".next/server/app/") && !key.endsWith(".segments")).map(([key, bytes]) => ({ label: "/" + key.slice(".next/server/app/".length), bytes }))
const big = routes.filter((r) => r.bytes >= 2 * MB).sort((a, b) => b.bytes - a.bytes)
const app = get(".next/server/app")
const parts = [
  ...big,
  { label: "Every other route", bytes: Math.max(0, app - big.reduce((n, r) => n + r.bytes, 0)) },
  { label: "Shared server code", bytes: get(".next/server/chunks") },
  { label: "Browser code", bytes: get("static") || get(".next/static") },
]
parts.push({ label: "Everything else", bytes: Math.max(0, total - parts.reduce((n, p) => n + p.bytes, 0)) })

// The build before this one stays on file (Brendan, 2026-09-21: "so I can see the difference" after routes went to the
// lab): /routes draws it as a second bar under the first. Run twice on one job, the earlier build is kept.
const file = path.resolve("lib/build-sizes.json")
const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null
const previous = before && before.job !== Number(good.jobId) ? { job: before.job, commit: before.commit, built: before.built, exact: before.exact, total: before.total, parts: before.parts } : (before?.previous ?? null)

const out = { job: Number(good.jobId), commit: good.commitId.slice(0, 7), built: good.endTime, exact: exact.length > 0, cap: CAP, total, parts: parts.filter((p) => p.bytes > 0), previous }
fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n")
console.log(`job ${out.job}: ${(total / MB).toFixed(0)} of ${(CAP / MB).toFixed(0)} MiB, ${out.parts.length} parts, ${out.exact ? "exact bytes" : "du megabytes"}`)
