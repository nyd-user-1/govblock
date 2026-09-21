// The run log's ledger (Brendan, 2026-09-20: "a run log table that shows all the
// work you just did per state"). A throwaway box leaves two files in S3 — the
// steps it reported and its log — and the next run of the same name overwrites
// them. This reads every finished run's pair while they are there and writes
// what the run did for each jurisdiction it owned to "PipelineRunStates"
// (sql/037), one row a jurisdiction a run. Every figure is the loader's own
// line from the log; nothing here is estimated.
//
//   node scripts/pipeline/launch.mjs ledger
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const REGION = "us-east-1"
const BUCKET = "livingston-fec-bulk-638175140432"
const n = (x) => Number(String(x ?? "0").replace(/,/g, "")) || 0
const plural = (k, word) => `${k.toLocaleString("en-US")} ${word}${k === 1 ? "" : "s"}`

/** One run's stages and log → a row a jurisdiction. */
export function parseRun(name, stagesText, log) {
  const stages = stagesText.split("\n").filter(Boolean).map((l) => ({ stage: l.split(" ")[0], at: l.split(" ")[1] }))
  const done = stages.find((s) => s.stage.startsWith("done:"))
  if (!done || !stages[0]?.at) return []
  const found = stages.find((s) => s.stage.startsWith("discovered:"))
  const lines = log.split("\n")

  const states = new Set()
  for (const m of log.matchAll(/--only(?:-states)? ([A-Z]{2}(?:,[A-Z]{2})*)/g)) for (const s of m[1].split(",")) states.add(s)
  for (const m of log.matchAll(/--state ([A-Z]{2})\b/g)) states.add(m[1])
  const own = /^gb-(?:single|convert|load|fleet)-([a-z]{2})$/.exec(name)?.[1]?.toUpperCase()
  if (own) states.add(own)

  const swept = /lists: getSessionList/.test(log)
  const walked = /state_link/.test(log)
  const refused = new Map()
  for (const m of log.matchAll(/ ([A-Z]{2}) round \d+:.*DROPPED HOSTS (\S+)/g)) refused.set(m[1], m[2])
  const failure = done.stage === "done:0" ? "" : (lines.filter((l) => /\b429\b|Error: |gave up after|FAILED|REFUSING|is required/.test(l)).pop() ?? "").replace(/^\S+\s+/, "").slice(0, 160)

  return [...states].map((state) => {
    const row = { run: name, started: stages[0].at, state, mode: name.startsWith("gb-fleet-") ? "fleet" : "single", finished: done.at, exit: n(done.stage.split(":")[1]), discover_source: null, discover_result: null, discover_exit: found ? n(found.stage.split(":")[1]) : null, fetch_source: null, considered: 0, stored: 0, skipped: 0, note: "" }
    const notes = []

    // Discovery.
    if (found) {
      const imports = [...log.matchAll(new RegExp(`\\[\\d+/\\d+\\] ${state} \\d+ \\d+ [\\d.]+ MB \\d+s — HTTP 200 .*?"bills":(\\d+)`, "g"))]
      const sync = state === "NY" ? /"fetched":(\d+),"upserted":(\d+),"newIds":(\d+)/.exec(log) : null
      const zips = state === "US" ? /billstatus done: (\d+) bills/.exec(log) : null
      if (sync) {
        row.discover_source = "NY Senate API"
        row.discover_result = `${plural(n(sync[1]), "bill")} read, ${n(sync[3]).toLocaleString("en-US")} new`
      } else if (swept || zips) {
        row.discover_source = zips ? (swept ? "LegiScan index, govinfo" : "govinfo") : "LegiScan index"
        const parts = []
        if (swept) parts.push(imports.length ? `${plural(imports.length, "session")} imported, ${imports.reduce((k, m) => k + n(m[1]), 0).toLocaleString("en-US")} bills` : "checked, nothing moved")
        if (zips) parts.push(`govinfo's record of ${n(zips[1]).toLocaleString("en-US")} bills`)
        row.discover_result = parts.join("; ")
      } else if (row.discover_exit) {
        row.discover_source = "LegiScan index"
        row.discover_result = "did not run"
      }
    }

    // Fetch. A state can take its own feed and the walker both; their counts add.
    const sources = []
    const add = (source, considered, stored, skipped = 0) => { sources.push(source); row.considered += considered; row.stored += stored; row.skipped += skipped }
    if (state === "NY") {
      const m = /nysenate-bulk done: .*? (\d+) bills · (\d+) versions stored · .*? (\d+) unchanged · (\d+) unmatched/.exec(log)
      if (m) { add("NY Senate API", n(m[1]), n(m[2])); if (n(m[4])) notes.push(`${n(m[4])} of the Senate's bills not on file`) }
    }
    if (state === "CA") {
      const m = /session \d+: .*?(\d+) versions in dump .*? unmatched (\d+) · inserted (\d+) · updated (\d+)/.exec(log)
      if (m) { add("leginfo's weekly dump", n(m[1]), n(m[3]) + n(m[4])); if (n(m[2])) notes.push(`${n(m[2])} versions of bills not on file`) }
    }
    if (state === "MA") { const m = /ma-api done: (\d+) considered · (\d+) stored/.exec(log); if (m) add("malegislature.gov API", n(m[1]), n(m[2])) }
    if (state === "TX" && /--source tx-ftp/.test(log)) { const ms = [...log.matchAll(/── TX \S+ finished: (\d+) stored · (\d+) skipped/g)]; add("TLO's FTP", ms.reduce((k, m) => k + n(m[1]) + n(m[2]), 0), ms.reduce((k, m) => k + n(m[1]), 0), ms.reduce((k, m) => k + n(m[2]), 0)) }
    if (state === "US") {
      const m = /done: (\d+) bills · (\d+) versions seen · (\d+) inserted · (\d+) updated · .*? (\d+) kept .*? (\d+) unmatched/.exec(log)
      if (m) { add("api.congress.gov", n(m[2]), n(m[3]) + n(m[4])); notes.push(`${n(m[5]).toLocaleString("en-US")} left to govinfo's better copy`); if (n(m[6])) notes.push(`${n(m[6])} versions of bills not on file`) }
      const d = /bill-delta done: (\d+) bills/.exec(log)
      if (d) notes.push(`${n(d[1]).toLocaleString("en-US")} bills refreshed with actions and cosponsors`)
      if (!m && /congress\/sync\.mjs/.test(log)) sources.push("api.congress.gov")
    }
    const batch = /pdf-batch done: (\d+) considered · (\d+) converted/.exec(log)
    if (batch) add("PDFs relayed from outside AWS", n(batch[1]), n(batch[2]))
    if (walked) {
      const one = new RegExp(`${state} done: (\\d+) considered · (\\d+) stored · (\\d+) skipped`).exec(log)
      const many = new RegExp(`── ${state} finished: (\\d+) stored, (\\d+) skipped`).exec(log)
      const rounds = [...log.matchAll(new RegExp(` ${state} round \\d+: considered (\\d+)`, "g"))].reduce((k, m) => k + n(m[1]), 0)
      // The walker writes a row for a document it was refused, and counts it stored; a refusal is not a text.
      if (one) add("the legislature's site", n(one[1]), Math.max(0, n(one[2]) - n(one[3])), n(one[3]))
      else if (many) add("the legislature's site", rounds || n(many[1]), Math.max(0, n(many[1]) - n(many[2])), n(many[2]))
      else sources.push("the legislature's site")
    }
    row.fetch_source = [...new Set(sources)].join(", ") || null
    if (refused.has(state)) notes.push(`${refused.get(state)} dropped after repeated failures`)
    else if (row.fetch_source && !row.considered && !row.exit) notes.push("nothing new to fetch")
    if (failure) notes.push(failure)
    row.note = notes.join("; ")
    return row
  })
}

/** Every finished run in S3 → the table. Returns how many rows it wrote. */
export function ledger(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gb-ledger-"))
  try {
    execFileSync("aws", ["s3", "cp", `s3://${BUCKET}/_fleet/govblock/`, dir, "--recursive", "--exclude", "*", "--include", "gb-*.stages", "--include", "gb-*.log", "--region", REGION, "--quiet"])
    const rows = fs.readdirSync(dir).filter((f) => f.endsWith(".stages")).flatMap((f) => {
      const name = f.replace(/\.stages$/, "")
      const log = fs.existsSync(path.join(dir, `${name}.log`)) ? fs.readFileSync(path.join(dir, `${name}.log`), "utf8") : ""
      return parseRun(name, fs.readFileSync(path.join(dir, f), "utf8"), log)
    })
    if (!rows.length) return { rows: 0 }
    const text = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`)
    const values = rows.map((r) => `(${text(r.run)}, ${text(r.started)}::timestamptz, ${text(r.state)}, ${text(r.mode)}, ${text(r.finished)}::timestamptz, ${r.exit}, ${text(r.discover_source)}, ${text(r.discover_result)}, ${r.discover_exit ?? "null"}, ${text(r.fetch_source)}, ${r.considered}, ${r.stored}, ${r.skipped}, ${text(r.note)})`)
    execFileSync("aws", ["rds-data", "execute-statement", "--region", REGION, "--resource-arn", env.POLICY_CLUSTER_ARN, "--secret-arn", env.POLICY_SECRET_ARN, "--database", "policy", "--sql",
      `insert into "PipelineRunStates" (run, started, state, mode, finished, exit, discover_source, discover_result, discover_exit, fetch_source, considered, stored, skipped, note) values ${values.join(", ")}
       on conflict (run, started, state) do update set finished = excluded.finished, exit = excluded.exit, discover_source = excluded.discover_source, discover_result = excluded.discover_result, discover_exit = excluded.discover_exit, fetch_source = excluded.fetch_source, considered = excluded.considered, stored = excluded.stored, skipped = excluded.skipped, note = excluded.note`], { stdio: ["ignore", "ignore", "pipe"], timeout: 90_000 })
    return { rows: rows.length, runs: new Set(rows.map((r) => r.run)).size }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
