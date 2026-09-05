// Load congressional committee assignments into Aurora through the RDS Data
// API. Neither congress.gov endpoint carries them — the member has no
// committees, the committee has no members — so they come from the
// unitedstates/congress-legislators project (public domain), which maintains
// committees-current.yaml (every committee and subcommittee, with the thomas
// id congress.gov's systemCode is built from) and
// committee-membership-current.yaml (every seat, with rank and title).
//
//   node scripts/directory/committees.mjs
//
// Idempotent: the table is rewritten from the two files each run. Reads the
// same variables as load.mjs from apps/web/.env.local.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, BatchExecuteStatementCommand, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")
const yaml = require("js-yaml")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const env = Object.fromEntries(
  readFileSync(join(ROOT, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
)
const resourceArn = env.POLICY_CLUSTER_ARN
const secretArn = env.POLICY_SECRET_ARN
const database = env.POLICY_DATABASE || "policy"
if (!resourceArn || !secretArn) throw new Error("POLICY_CLUSTER_ARN and POLICY_SECRET_ARN must be set in apps/web/.env.local")
const client = new RDSDataClient({ region: env.AWS_REGION || "us-east-1" })

const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })
const n = (v) => (v === null || v === undefined ? { isNull: true } : { longValue: Number(v) })

async function withResume(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (/resuming|DatabaseResuming|Throttl|timed? ?out|ECONNRESET|socket hang up/i.test(msg) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
}
const exec = (sql, parameters) =>
  withResume(() => client.send(new ExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameters, continueAfterTimeout: true })))
async function batch(sql, rows, size = 100) {
  for (let i = 0; i < rows.length; i += size) {
    const parameterSets = rows.slice(i, i + size)
    await withResume(() => client.send(new BatchExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameterSets })))
  }
}

const BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/"
const get = async (file) => yaml.load(await (await fetch(BASE + file, { headers: { "user-agent": "govblock/1.0 (committee refresh)" } })).text())

// congress.gov's systemCode is the thomas id, lowercased, with "00" for the
// full committee and the subcommittee's own two digits otherwise: HSAG →
// hsag00, HSAG03 → hsag03.
const systemCode = (thomasId) => (thomasId.length === 4 ? `${thomasId.toLowerCase()}00` : thomasId.toLowerCase())

const committees = await get("committees-current.yaml")
const membership = await get("committee-membership-current.yaml")

const names = new Map()
for (const c of committees) {
  names.set(c.thomas_id, { name: c.name, chamber: c.type, parent: null })
  for (const sub of c.subcommittees ?? []) {
    names.set(`${c.thomas_id}${sub.thomas_id}`, { name: sub.name, chamber: c.type, parent: c.thomas_id })
  }
}

const rows = []
for (const [thomasId, seats] of Object.entries(membership)) {
  const meta = names.get(thomasId)
  if (!meta) {
    console.warn(`no committee named for ${thomasId}; skipped ${seats.length} seats`)
    continue
  }
  for (const seat of seats) {
    if (!seat.bioguide) continue
    rows.push([
      { name: "system_code", value: s(systemCode(thomasId)) },
      { name: "thomas_id", value: s(thomasId) },
      { name: "name", value: s(meta.name) },
      { name: "chamber", value: s(meta.chamber) },
      { name: "parent_system_code", value: s(meta.parent ? systemCode(meta.parent) : null) },
      { name: "bioguide_id", value: s(seat.bioguide) },
      { name: "rank", value: n(seat.rank) },
      { name: "title", value: s(seat.title) },
      { name: "party", value: s(seat.party) },
    ])
  }
}
console.log(`${names.size} committees and subcommittees, ${rows.length} seats`)

await exec(`create table if not exists congress_committee_members (
  system_code text not null, thomas_id text not null, name text not null, chamber text, parent_system_code text,
  bioguide_id text not null, rank integer, title text, party text, fetched_at timestamptz not null default now(),
  primary key (system_code, bioguide_id))`)
await exec(`create index if not exists congress_committee_members_member_idx on congress_committee_members (bioguide_id)`)
const started = new Date().toISOString()
await batch(
  `insert into congress_committee_members (system_code, thomas_id, name, chamber, parent_system_code, bioguide_id, rank, title, party, fetched_at)
   values (:system_code, :thomas_id, :name, :chamber, :parent_system_code, :bioguide_id, :rank, :title, :party, now())
   on conflict (system_code, bioguide_id) do update set thomas_id = excluded.thomas_id, name = excluded.name, chamber = excluded.chamber,
     parent_system_code = excluded.parent_system_code, rank = excluded.rank, title = excluded.title, party = excluded.party, fetched_at = now()`,
  rows,
)
await exec(`delete from congress_committee_members where fetched_at < cast(:t as timestamptz)`, [{ name: "t", value: s(started) }])
console.log("loaded")
