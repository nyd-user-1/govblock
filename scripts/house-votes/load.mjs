// Load the House's roll-call votes from congress.gov into Aurora: the 116th
// through the 118th, which congress.gov publishes and the table did not hold
// (apps/web/docs/federal-sources.md). The 119th is the nightly harvest's; this
// backfills beside it, into the same two tables and the same shape.
//
//   node scripts/house-votes/load.mjs              # 116, 117, 118
//   node scripts/house-votes/load.mjs 117          # one congress
//   node scripts/house-votes/load.mjs 117 2        # one session
//   node scripts/house-votes/load.mjs 117 --force  # re-fetch votes already held
//
// One request per page of the list and one per vote (its members); the party
// totals are counted from the members rather than fetched a second time, in
// the shape the harvest stores. congress.gov allows 5,000 requests an hour, so
// a congress takes about half an hour. Idempotent: rows upsert on their keys.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { exec, q } from "../laws/lib/db.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const KEY = readFileSync(join(ROOT, "apps/web/.env.local"), "utf8").match(/^CONGRESS_API_KEY="?([^"\n]+)"?/m)?.[1]
if (!KEY) throw new Error("CONGRESS_API_KEY is not set in apps/web/.env.local")

const API = "https://api.congress.gov/v3/house-vote"
const PARTY = { R: "Republican", D: "Democrat", I: "Independent", L: "Libertarian" }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// About 0.8 s a request keeps well inside 5,000 an hour; a 429 waits a minute.
let last = 0
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const wait = 750 - (Date.now() - last)
    if (wait > 0) await sleep(wait)
    last = Date.now()
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}format=json&api_key=${KEY}`)
    if (response.ok) return response.json()
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await sleep(response.status === 429 ? 60_000 : 5_000 * (attempt + 1))
      continue
    }
    throw new Error(`${response.status} ${url}`)
  }
}

async function list(congress, session) {
  const items = []
  for (let offset = 0; ; offset += 250) {
    const page = await get(`${API}/${congress}/${session}?limit=250&offset=${offset}`)
    items.push(...(page.houseRollCallVotes ?? []))
    if (!page.pagination?.next) break
  }
  return items
}

function totals(members) {
  const casts = {}
  const parties = new Map()
  for (const m of members) {
    casts[m.voteCast] = (casts[m.voteCast] ?? 0) + 1
    const p = parties.get(m.voteParty) ?? { yeaTotal: 0, nayTotal: 0, presentTotal: 0, notVotingTotal: 0 }
    if (m.voteCast === "Yea" || m.voteCast === "Aye") p.yeaTotal++
    else if (m.voteCast === "Nay" || m.voteCast === "No") p.nayTotal++
    else if (m.voteCast === "Present") p.presentTotal++
    else if (m.voteCast === "Not Voting") p.notVotingTotal++
    parties.set(m.voteParty, p)
  }
  const partyTotal = [...parties].map(([type, t]) => ({ ...t, party: { name: PARTY[type] ?? type, type }, voteParty: type }))
  const count = (...names) => names.reduce((sum, n) => sum + (casts[n] ?? 0), 0)
  return { casts, partyTotal, yea: count("Yea", "Aye"), nay: count("Nay", "No"), present: count("Present"), notVoting: count("Not Voting") }
}

const people = new Map((await q(`select bioguide_id, people_id from "People" where bioguide_id is not null`)).map((r) => [r.bioguide_id, Number(r.people_id)]))
console.log(`people: ${people.size} with a bioguide id`)

async function loadVote(item) {
  const { congress, sessionNumber: session, rollCallNumber: roll } = item
  const detail = (await get(`${API}/${congress}/${session}/${roll}/members`)).houseRollCallVoteMemberVotes
  const members = detail.results ?? []
  const t = totals(members)
  const identifier = String(item.identifier)
  const payload = { ...item, voteQuestion: detail.voteQuestion ?? null, votePartyTotal: t.partyTotal }
  await exec(
    `insert into congress_house_votes (key, identifier, congress, session_number, roll_call_number, legislation_type, legislation_number, legislation_url,
       result, vote_type, start_date, update_date, vote_question, vote_party_total, casts, yea, nay, present, not_voting, positions,
       payload, list_payload, updated_at, positions_fetched_at, detail_fetched_at)
     values ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12, $13, $14::jsonb, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, now(), now(), now())
     on conflict (key) do update set result = excluded.result, vote_question = excluded.vote_question, vote_party_total = excluded.vote_party_total,
       casts = excluded.casts, yea = excluded.yea, nay = excluded.nay, present = excluded.present, not_voting = excluded.not_voting,
       positions = excluded.positions, payload = excluded.payload, list_payload = excluded.list_payload, updated_at = now(), positions_fetched_at = now()`,
    [
      identifier, congress, String(session), String(roll), item.legislationType ?? null, item.legislationNumber ?? null, item.legislationUrl ?? null,
      item.result ?? null, item.voteType ?? null, item.startDate ?? null, item.updateDate ?? null, detail.voteQuestion ?? null,
      JSON.stringify(t.partyTotal), JSON.stringify(t.casts), t.yea, t.nay, t.present, t.notVoting, members.length,
      JSON.stringify(payload), JSON.stringify(item),
    ]
  )
  // The positions a statement at a time, 120 rows each: the Data API caps a statement's size.
  for (let i = 0; i < members.length; i += 120) {
    const chunk = members.slice(i, i + 120)
    const values = []
    const params = []
    chunk.forEach((m, j) => {
      const b = j * 8
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}::bigint, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, now())`)
      params.push(identifier, m.bioguideID, people.get(m.bioguideID) ?? null, m.voteCast, m.voteParty, m.voteState, m.firstName, m.lastName)
    })
    await exec(
      `insert into congress_house_vote_positions (vote_identifier, bioguide_id, people_id, vote_cast, vote_party, vote_state, first_name, last_name, updated_at)
       values ${values.join(", ")}
       on conflict (vote_identifier, bioguide_id) do update set people_id = excluded.people_id, vote_cast = excluded.vote_cast, vote_party = excluded.vote_party,
         vote_state = excluded.vote_state, first_name = excluded.first_name, last_name = excluded.last_name, updated_at = now()`,
      params
    )
  }
  return members.length
}

const args = process.argv.slice(2)
const force = args.includes("--force")
const numeric = args.filter((a) => /^\d+$/.test(a)).map(Number)
const congresses = numeric.length ? [numeric[0]] : [118, 117, 116]
const sessions = numeric.length >= 2 ? [numeric[1]] : [1, 2]

let votes = 0
let positions = 0
for (const congress of congresses) {
  for (const session of sessions) {
    const items = await list(congress, session)
    const held = force ? new Set() : new Set((await q(`select key from congress_house_votes where congress = $1 and session_number = $2 and positions > 0`, [congress, String(session)])).map((r) => r.key))
    const todo = items.filter((item) => !held.has(String(item.identifier)))
    console.log(`${congress}-${session}: ${items.length} votes listed, ${todo.length} to load`)
    for (const [i, item] of todo.entries()) {
      try {
        positions += await loadVote(item)
        votes++
      } catch (error) {
        console.error(`  roll ${item.rollCallNumber}: ${error.message}`)
      }
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${todo.length}`)
    }
  }
}
console.log(`done: ${votes} votes, ${positions} positions`)
