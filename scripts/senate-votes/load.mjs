// Load the Senate's roll-call votes into Aurora through the RDS Data API.
//
// congress.gov's vote API is House-only — /v3/house-vote answers the 117th
// through the 119th and there is no Senate endpoint — so the Senate's own XML
// is the only machine-readable record of how a senator voted:
//
//   list:  https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_<c>_<s>.xml
//   vote:  https://www.senate.gov/legislative/LIS/roll_call_votes/vote<c><s>/vote_<c>_<s>_<nnnnn>.xml
//
// A vote names its measure as the Senate writes it — "H.R. 1", "S. 5271",
// "PN373" for a nomination — so the loader translates the bill ones into
// congress.gov's type and number and the congress_key that joins congress_bills
// and the re-keyed lobbying. A nomination or a procedural motion carries no
// bill and leaves those null.
//
// Idempotent: every row upserts on its key, so a re-run refreshes and a fresh
// session picks up where the last one stopped. Run from the repo root:
//
//   node scripts/senate-votes/load.mjs                 # every session it knows
//   node scripts/senate-votes/load.mjs 119 1           # one session
//   node scripts/senate-votes/load.mjs 119 2 --force   # re-fetch votes already held
//
// Reads POLICY_CLUSTER_ARN / POLICY_SECRET_ARN / POLICY_DATABASE / AWS_REGION
// from apps/web/.env.local, the same variables the app uses.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { RDSDataClient, BatchExecuteStatementCommand, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data")

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

const UA = "govblock/1.0 (+https://govblock.app; brendan@nysgpt.com)"
const BASE = "https://www.senate.gov/legislative/LIS"

const s = (v) => (v === null || v === undefined || v === "" ? { isNull: true } : { stringValue: String(v) })
const i = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? { isNull: true } : { longValue: Number(v) })

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
  withResume(() => client.send(new ExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameters, formatRecordsAs: "JSON", continueAfterTimeout: true })))

const rows = async (sql, parameters) => JSON.parse((await exec(sql, parameters)).formattedRecords ?? "[]")

async function batch(sql, sets, size = 100) {
  for (let at = 0; at < sets.length; at += size) {
    const parameterSets = sets.slice(at, at + size)
    await withResume(() => client.send(new BatchExecuteStatementCommand({ resourceArn, secretArn, database, sql, parameterSets })))
  }
}

/* ---- the XML ------------------------------------------------------------- */

// The Senate's documents are flat and small; a regex reader beats a dependency.
const ENTITY = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&nbsp;": " " }
const text = (v) =>
  String(v ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITY[e.toLowerCase()] ?? e)
    .replace(/\s+/g, " ")
    .trim() || null

const tag = (xml, name) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? text(m[1]) : null
}
const block = (xml, name) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? m[1] : ""
}

async function fetchXml(url, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.text()
    } catch (e) {
      if (attempt >= attempts) throw new Error(`${url}: ${e?.message ?? e}`)
      await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
}

/* ---- the two numbering schemes ------------------------------------------- */

// The Senate writes the measure the way congress.gov prints it — "H.R. 1",
// "S.J.Res. 12" — so the parse is congress.gov's own, and the same one
// lib/policy/congress.ts runs in the app. Kept here rather than imported
// because a loader script has no bundler.
const CITATION_TYPE = {
  HR: "HR", HRES: "HRES", HJRES: "HJRES", HCONRES: "HCONRES",
  S: "S", SRES: "SRES", SJRES: "SJRES", SCONRES: "SCONRES",
}

function citation(raw) {
  const m = String(raw ?? "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z.]+?)\.?0*(\d+)$/)
  if (!m) return null
  const type = CITATION_TYPE[m[1].replace(/\./g, "")]
  return type ? { type, number: String(Number(m[2])) } : null
}

/** "December 18, 2025,  09:42 PM" — the Senate's own format, in Eastern time. */
function when(raw) {
  const m = String(raw ?? "").match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}),?\s*(\d{1,2}):(\d{2})\s*([AP]M)?/)
  if (!m) return null
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
  const month = months.indexOf(m[1].toLowerCase()) + 1
  if (!month) return null
  let hour = Number(m[4])
  if (m[6] === "PM" && hour !== 12) hour += 12
  if (m[6] === "AM" && hour === 12) hour = 0
  const pad = (n) => String(n).padStart(2, "0")
  // The Senate votes in Washington; the offset is the Eastern one for the day.
  const offset = month > 3 && month < 11 ? "-04:00" : "-05:00"
  return `${m[3]}-${pad(month)}-${pad(Number(m[2]))}T${pad(hour)}:${m[5]}:00${offset}`
}

/* ---- the roster ---------------------------------------------------------- */

/**
 * The Senate names a voter by last name, party and state and gives an LIS id we
 * hold nowhere. `senate_contact` is the sitting hundred from senators_cfm.xml,
 * keyed by bioguide; `People` carries everyone who has ever sat, which is what
 * catches the four who left mid-congress. Matched on state and last name, and
 * left null rather than guessed when two of a state share one.
 */
async function roster() {
  const sitting = await rows(`select bioguide_id, upper(last_name) last_name, upper(state) state from senate_contact`)
  const past = await rows(
    `select people_id, bioguide_id, upper(last_name) last_name, upper(right(district, 2)) state
       from "People" where state = 'US' and role ilike '%sen%' and coalesce(last_name, '') <> ''`,
  )
  const byBioguide = new Map(past.filter((r) => r.bioguide_id).map((r) => [r.bioguide_id, r.people_id]))
  const map = new Map()
  const add = (key, value) => {
    if (!map.has(key)) map.set(key, value)
    else if (JSON.stringify(map.get(key)) !== JSON.stringify(value)) map.set(key, { ambiguous: true })
  }
  for (const r of past) add(`${r.state}|${r.last_name}`, { people_id: r.people_id, bioguide_id: r.bioguide_id ?? null })
  for (const r of sitting) map.set(`${r.state}|${r.last_name}`, { bioguide_id: r.bioguide_id, people_id: byBioguide.get(r.bioguide_id) ?? null })
  return map
}

/* ---- one vote ------------------------------------------------------------ */

function parseVote(xml, congress, session, number, url) {
  const doc = block(xml, "document")
  const amendment = block(xml, "amendment")
  const count = block(xml, "count")
  const docType = tag(doc, "document_type")
  const docNumber = tag(doc, "document_number")
  // A nomination (PN) or a treaty is not a bill; only a bill citation gets a key.
  const cite = docType && docType.toUpperCase() !== "PN" ? citation(`${docType}${docNumber ?? ""}`) : null
  const members = [...block(xml, "members").matchAll(/<member>([\s\S]*?)<\/member>/g)].map((m) => m[1])
  return {
    key: `${congress}-${session}-${Number(number)}`,
    congress,
    session_number: String(session),
    roll_call_number: String(Number(number)),
    vote_date: when(tag(xml, "vote_date")),
    modify_date: when(tag(xml, "modify_date")),
    question: tag(xml, "question"),
    vote_question_text: tag(xml, "vote_question_text"),
    vote_title: tag(xml, "vote_title"),
    vote_document_text: tag(xml, "vote_document_text"),
    vote_result: tag(xml, "vote_result"),
    vote_result_text: tag(xml, "vote_result_text"),
    majority_requirement: tag(xml, "majority_requirement"),
    document_type: docType,
    document_number: docNumber,
    document_name: tag(doc, "document_name"),
    document_title: tag(doc, "document_title"),
    amendment_number: tag(amendment, "amendment_number"),
    amendment_purpose: tag(amendment, "amendment_purpose"),
    legislation_type: cite?.type ?? null,
    legislation_number: cite?.number ?? null,
    congress_key: cite ? `${congress}-${cite.type}-${cite.number}` : null,
    yea: tag(count, "yeas"),
    nay: tag(count, "nays"),
    present: tag(count, "present"),
    absent: tag(count, "absent"),
    positions: members.length,
    tie_breaker: tag(block(xml, "tie_breaker"), "by_whom"),
    source_url: url,
    members: members.map((m) => ({
      lis_member_id: tag(m, "lis_member_id"),
      member_full: tag(m, "member_full"),
      first_name: tag(m, "first_name"),
      last_name: tag(m, "last_name"),
      vote_party: tag(m, "party"),
      vote_state: tag(m, "state"),
      vote_cast: tag(m, "vote_cast"),
    })),
  }
}

const VOTE_SQL = `
insert into congress_senate_votes (
  key, congress, session_number, roll_call_number, vote_date, modify_date, question, vote_question_text,
  vote_title, vote_document_text, vote_result, vote_result_text, majority_requirement,
  document_type, document_number, document_name, document_title, amendment_number, amendment_purpose,
  legislation_type, legislation_number, congress_key, bill_id, yea, nay, present, absent, positions,
  tie_breaker, source_url, updated_at)
values (
  :key, :congress, :session_number, :roll_call_number, :vote_date::timestamptz, :modify_date::timestamptz,
  :question, :vote_question_text, :vote_title, :vote_document_text, :vote_result, :vote_result_text,
  :majority_requirement, :document_type, :document_number, :document_name, :document_title,
  :amendment_number, :amendment_purpose, :legislation_type, :legislation_number, :congress_key,
  (select bill_id from congress_bills where key = :congress_key),
  :yea, :nay, :present, :absent, :positions, :tie_breaker, :source_url, now())
on conflict (key) do update set
  vote_date = excluded.vote_date, modify_date = excluded.modify_date, question = excluded.question,
  vote_question_text = excluded.vote_question_text, vote_title = excluded.vote_title,
  vote_document_text = excluded.vote_document_text, vote_result = excluded.vote_result,
  vote_result_text = excluded.vote_result_text, majority_requirement = excluded.majority_requirement,
  document_type = excluded.document_type, document_number = excluded.document_number,
  document_name = excluded.document_name, document_title = excluded.document_title,
  amendment_number = excluded.amendment_number, amendment_purpose = excluded.amendment_purpose,
  legislation_type = excluded.legislation_type, legislation_number = excluded.legislation_number,
  congress_key = excluded.congress_key, bill_id = excluded.bill_id,
  yea = excluded.yea, nay = excluded.nay, present = excluded.present, absent = excluded.absent,
  positions = excluded.positions, tie_breaker = excluded.tie_breaker, source_url = excluded.source_url,
  updated_at = now()`

const POSITION_SQL = `
insert into congress_senate_vote_positions (
  vote_key, lis_member_id, bioguide_id, people_id, member_full, first_name, last_name, vote_party, vote_state, vote_cast, updated_at)
values (:vote_key, :lis_member_id, :bioguide_id, :people_id, :member_full, :first_name, :last_name, :vote_party, :vote_state, :vote_cast, now())
on conflict (vote_key, lis_member_id) do update set
  bioguide_id = excluded.bioguide_id, people_id = excluded.people_id, member_full = excluded.member_full,
  first_name = excluded.first_name, last_name = excluded.last_name, vote_party = excluded.vote_party,
  vote_state = excluded.vote_state, vote_cast = excluded.vote_cast, updated_at = now()`

/* ---- one session --------------------------------------------------------- */

async function loadSession(congress, session, people, force) {
  const listUrl = `${BASE}/roll_call_lists/vote_menu_${congress}_${session}.xml`
  const list = await fetchXml(listUrl)
  if (!list) {
    console.log(`${congress}-${session}: no list published`)
    return { votes: 0, positions: 0 }
  }
  const numbers = [...list.matchAll(/<vote_number>(\d+)<\/vote_number>/g)].map((m) => Number(m[1])).sort((a, b) => a - b)
  const held = new Set(
    force ? [] : (await rows(`select roll_call_number from congress_senate_votes where congress = :c and session_number = :s`, [{ name: "c", value: i(congress) }, { name: "s", value: s(session) }])).map((r) => Number(r.roll_call_number)),
  )
  const wanted = numbers.filter((v) => !held.has(v))
  console.log(`${congress}-${session}: ${numbers.length} on the Senate's list, ${held.size} already held, ${wanted.length} to fetch`)

  let votes = 0
  let positions = 0
  let unmatched = 0
  // Four at a time: the Senate's server is not a CDN and this is one session.
  for (let at = 0; at < wanted.length; at += 4) {
    const slice = wanted.slice(at, at + 4)
    const parsed = await Promise.all(
      slice.map(async (number) => {
        const url = `${BASE}/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${String(number).padStart(5, "0")}.xml`
        const xml = await fetchXml(url)
        return xml ? parseVote(xml, congress, session, number, url) : null
      }),
    )
    for (const vote of parsed) {
      if (!vote) continue
      await exec(
        VOTE_SQL,
        [
          ["key", s(vote.key)], ["congress", i(vote.congress)], ["session_number", s(vote.session_number)],
          ["roll_call_number", s(vote.roll_call_number)], ["vote_date", s(vote.vote_date)], ["modify_date", s(vote.modify_date)],
          ["question", s(vote.question)], ["vote_question_text", s(vote.vote_question_text)], ["vote_title", s(vote.vote_title)],
          ["vote_document_text", s(vote.vote_document_text)], ["vote_result", s(vote.vote_result)],
          ["vote_result_text", s(vote.vote_result_text)], ["majority_requirement", s(vote.majority_requirement)],
          ["document_type", s(vote.document_type)], ["document_number", s(vote.document_number)],
          ["document_name", s(vote.document_name)], ["document_title", s(vote.document_title)],
          ["amendment_number", s(vote.amendment_number)], ["amendment_purpose", s(vote.amendment_purpose)],
          ["legislation_type", s(vote.legislation_type)], ["legislation_number", s(vote.legislation_number)],
          ["congress_key", s(vote.congress_key)], ["yea", i(vote.yea)], ["nay", i(vote.nay)],
          ["present", i(vote.present)], ["absent", i(vote.absent)], ["positions", i(vote.positions)],
          ["tie_breaker", s(vote.tie_breaker)], ["source_url", s(vote.source_url)],
        ].map(([name, value]) => ({ name, value })),
      )
      const sets = vote.members.map((m) => {
        const found = people.get(`${String(m.vote_state ?? "").toUpperCase()}|${String(m.last_name ?? "").toUpperCase()}`)
        const matched = found && !found.ambiguous ? found : null
        if (!matched) unmatched++
        return [
          ["vote_key", s(vote.key)], ["lis_member_id", s(m.lis_member_id ?? `${m.vote_state}-${m.last_name}`)],
          ["bioguide_id", s(matched?.bioguide_id)], ["people_id", i(matched?.people_id)],
          ["member_full", s(m.member_full)], ["first_name", s(m.first_name)], ["last_name", s(m.last_name)],
          ["vote_party", s(m.vote_party)], ["vote_state", s(m.vote_state)], ["vote_cast", s(m.vote_cast)],
        ].map(([name, value]) => ({ name, value }))
      })
      await batch(POSITION_SQL, sets, 100)
      votes++
      positions += sets.length
      if (votes % 25 === 0) console.log(`  ${votes}/${wanted.length} votes, ${positions} positions`)
    }
  }
  console.log(`${congress}-${session}: ${votes} votes, ${positions} positions, ${unmatched} unmatched senators`)
  return { votes, positions }
}

/* ---- run ----------------------------------------------------------------- */

const args = process.argv.slice(2)
const force = args.includes("--force")
const numeric = args.filter((a) => /^\d+$/.test(a)).map(Number)
// congress.gov's vote API starts at the 117th; the Senate's XML goes back to
// the 101st. Default to the congresses the House side already holds so the two
// chambers line up on the page.
const SESSIONS = numeric.length >= 2 ? [[numeric[0], numeric[1]]] : numeric.length === 1 ? [[numeric[0], 1], [numeric[0], 2]] : [[119, 1], [119, 2]]

const people = await roster()
console.log(`roster: ${people.size} senators by state and last name`)
let votes = 0
let positions = 0
for (const [congress, session] of SESSIONS) {
  const done = await loadSession(congress, session, people, force)
  votes += done.votes
  positions += done.positions
}
console.log(`done: ${votes} votes, ${positions} positions`)
