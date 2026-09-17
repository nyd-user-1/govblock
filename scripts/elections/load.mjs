// Loads election results for the simulator (sql/028_elections.sql).
//
//   node --experimental-strip-types scripts/elections/load.mjs rcv [--only NewYorkCity_2025] [--dry]
//
// rcv: every ranked-choice ballot file in the lake (lake/v1/elections/rcv-ballots/,
// FairVote's CVRs, CC0) is read into its distinct rankings, counted with the
// simulator's own module (apps/web/lib/elections/tabulate.ts), published as a
// small public file the simulator fetches on a click, and written to
// rcv_contests. Run it on the dev box: it reads 5 GB from S3, and a running
// load.mjs keeps the box from idling out.
//
// Ballot rules applied here, once: a skipped or undervoted rank is passed
// over; an overvote ends the ballot at that rank; a candidate ranked twice
// counts at the higher rank; every spelling of a write-in is one candidate; a
// ballot ranking no one is not counted. A file with a Count column weighs
// each row by it.

import { createRequire } from "node:module"
import { gzipSync } from "node:zlib"

import { exec, q } from "../laws/lib/db.mjs"
import { clearReadCache } from "../laws/lib/revalidate.mjs"
import { condorcetWinner, headToHead, instantRunoff } from "../../apps/web/lib/elections/tabulate.ts"
import { rows } from "./csv.mjs"
import { describe } from "./describe.mjs"

const require = createRequire(import.meta.url)
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3")

const LAKE = "govblock-lake-638175140432"
const BALLOTS = "lake/v1/elections/rcv-ballots/"
const PUBLIC = "govblock-geo-638175140432"
const PUBLIC_BASE = `https://${PUBLIC}.s3.amazonaws.com`
const s3 = new S3Client({ region: "us-east-1" })

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i < 0 ? undefined : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true
}

const SKIP = /^(skipped|undervote|blank|)$/i
const OVERVOTE = /^overvote$/i
const WRITE_IN = /^(write[- ]?in|writein|uwi|undeclared write-?ins?)$/i

async function ballotKeys() {
  const keys = []
  for (let token; ; ) {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: LAKE, Prefix: BALLOTS, ContinuationToken: token }))
    for (const o of r.Contents ?? []) if (o.Key.endsWith(".csv")) keys.push(o.Key)
    if (!r.IsTruncated) return keys
    token = r.NextContinuationToken
  }
}

/** A ballot file → its candidates (most first choices first) and profiles by index. */
async function readBallots(key) {
  const body = (await s3.send(new GetObjectCommand({ Bucket: LAKE, Key: key }))).Body
  let rankCols = null
  let weightCol = -1
  let ranks = 0
  const tally = new Map()
  for await (const row of rows(body)) {
    if (!rankCols) {
      rankCols = row.map((h, i) => (/^(rank|x)\d+$/i.test(h.trim()) ? i : -1)).filter((i) => i >= 0)
      weightCol = row.findIndex((h) => /^count$/i.test(h.trim()))
      ranks = rankCols.length
      if (!ranks) throw new Error(`no rank columns in ${key}: ${row.join("|")}`)
      continue
    }
    if (row.length < rankCols.at(-1)) continue
    const weight = weightCol >= 0 ? Number(row[weightCol]) || 0 : 1
    if (!weight) continue
    const ranking = []
    for (const i of rankCols) {
      const value = (row[i] ?? "").trim()
      if (SKIP.test(value)) continue
      if (OVERVOTE.test(value)) break
      const name = WRITE_IN.test(value) ? "Write-in" : value
      if (!ranking.includes(name)) ranking.push(name)
    }
    if (!ranking.length) continue
    const k = ranking.join("\u0001")
    tally.set(k, (tally.get(k) ?? 0) + weight)
  }
  const first = new Map()
  for (const [k, n] of tally) {
    const top = k.split("\u0001")[0]
    first.set(top, (first.get(top) ?? 0) + n)
  }
  const names = new Set()
  for (const k of tally.keys()) for (const name of k.split("\u0001")) names.add(name)
  const candidates = [...names].sort((a, b) => (first.get(b) ?? 0) - (first.get(a) ?? 0) || a.localeCompare(b))
  const index = new Map(candidates.map((c, i) => [c, i]))
  const profiles = [...tally]
    .map(([k, n]) => [n, ...k.split("\u0001").map((name) => index.get(name))])
    .sort((a, b) => b[0] - a[0])
  return { candidates, profiles, ranks, ballots: profiles.reduce((s, p) => s + p[0], 0) }
}

async function loadRcv() {
  const only = flag("only")
  const dry = flag("dry")
  const loaded = flag("resume") ? new Set((await q(`select file from rcv_contests`)).map((r) => r.file)) : new Set()
  const keys = (await ballotKeys()).filter((k) => (!only || k.includes(only)) && !loaded.has(k.slice(BALLOTS.length)))
  console.log(`${keys.length} ballot files${loaded.size ? ` (${loaded.size} already loaded)` : ""}`)
  const done = []
  for (const key of keys) {
    const file = key.slice(BALLOTS.length)
    const meta = describe(file)
    const started = Date.now()
    const { candidates, profiles, ranks, ballots } = await readBallots(key)
    const count = instantRunoff(candidates.length, profiles)
    const condorcet = condorcetWinner(headToHead(candidates.length, profiles))
    const profileKey = `elections/rcv/${meta.id}.json`
    const payload = {
      id: meta.id,
      title: meta.title,
      jurisdiction: meta.jurisdiction,
      state: meta.state,
      date: meta.date,
      office: meta.office,
      party: meta.party,
      special: meta.special,
      ranks,
      ballots,
      candidates,
      profiles,
      source: { name: "Otis, Single winner ranked choice voting CVRs, Harvard Dataverse", doi: "10.7910/DVN/AMK8PJ", license: "CC0 1.0", file },
    }
    if (!dry) {
      await s3.send(
        new PutObjectCommand({
          Bucket: PUBLIC,
          Key: profileKey,
          Body: gzipSync(JSON.stringify(payload)),
          ContentType: "application/json",
          ContentEncoding: "gzip",
          CacheControl: "public, max-age=86400",
        })
      )
      await exec(
        `insert into rcv_contests (id, file, jurisdiction, state, level, election_date, office, party, special, title, candidates, ballots, ranks, rounds, winner, first_round_leader, comeback, condorcet_winner, profiles, profile_url, loaded_at)
         values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11::text[], $12, $13, $14::jsonb, $15, $16, $17, $18, $19, $20, now())
         on conflict (id) do update set file = excluded.file, jurisdiction = excluded.jurisdiction, state = excluded.state, level = excluded.level,
           election_date = excluded.election_date, office = excluded.office, party = excluded.party, special = excluded.special, title = excluded.title,
           candidates = excluded.candidates, ballots = excluded.ballots, ranks = excluded.ranks, rounds = excluded.rounds, winner = excluded.winner,
           first_round_leader = excluded.first_round_leader, comeback = excluded.comeback, condorcet_winner = excluded.condorcet_winner,
           profiles = excluded.profiles, profile_url = excluded.profile_url, loaded_at = now()`,
        [
          meta.id,
          file,
          meta.jurisdiction,
          meta.state,
          meta.level,
          meta.date,
          meta.office,
          meta.party,
          meta.special,
          meta.title,
          `{${candidates.map((c) => `"${c.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`,
          ballots,
          ranks,
          JSON.stringify(count.rounds),
          candidates[count.winner],
          candidates[count.leader],
          count.winner !== count.leader,
          condorcet >= 0 ? candidates[condorcet] : null,
          profiles.length,
          `${PUBLIC_BASE}/${profileKey}`,
        ]
      )
    }
    const line = `${meta.id}: ${ballots} ballots, ${candidates.length} candidates, ${profiles.length} rankings, ${count.rounds.length} rounds, winner ${candidates[count.winner]}${count.winner !== count.leader ? ` (came from behind ${candidates[count.leader]})` : ""}${condorcet >= 0 && condorcet !== count.winner ? `, head-to-head winner ${candidates[condorcet]}` : ""} — ${((Date.now() - started) / 1000).toFixed(1)}s`
    console.log(line)
    done.push(meta.id)
  }
  if (!dry) console.log(await clearReadCache(["rcv_contests"]))
  console.log(`${done.length} contests`)
}

// ---- returns: MIT Election Data + Science Lab ----------------------------
//
//   node --experimental-strip-types scripts/elections/load.mjs returns [--dir ~/Code/govblock-data/elections/medsl] [--dry]
//
// District returns for the House, Senate and President, and the state
// legislative seats out of MIT's precinct files, summed to the district. Where
// a precinct reports a TOTAL row beside its vote-mode rows (election day,
// early, absentee), the TOTAL stands and the modes are not added to it.
// Undervotes, overvotes and ballots-cast rows are not votes and are dropped;
// scattered write-ins and "other" count toward the race's total but cannot
// win it; blank and void lines (New York, Maine, Vermont publish them) stay in
// election_results as published but are left out of a race's total, as the
// states' own percentages leave them out.

const NOT_VOTES = /^(UNDER ?VOTES?|OVER ?VOTES?|UNDERVOTES-VOIDS|BLANK BALLOTS|TOTAL (BALLOTS|VOTES) CAST|INVALID VOTES|CAST VOTES|BALLOTS CAST|REGISTERED VOTERS)$/i
const NOBODY = /^(|OTHERS?|ALL OTHERS|WRITE-?IN|WRITEINS?|SCATTER(ING)?|BLANKS?|BLANK VOTES?|VOID( VOTES?)?|BLANK VOTE\/.*|.*\/SCATTERING)$/i
const BLANK = /^(BLANKS?|BLANK VOTES?|VOID( VOTES?)?|BLANK VOTE\/.*)$/i

const district = (d) => {
  const v = String(d ?? "").trim()
  if (!v || /^(statewide|-|NA)$/i.test(v)) return ""
  return /^\d+(\.0)?$/.test(v) ? String(Number(v)) : v.toUpperCase()
}
const truthy = (v) => /^(true|t|1)$/i.test(String(v ?? "").trim())

async function* csvRecords(path) {
  const { createReadStream } = await import("node:fs")
  let header = null
  for await (const row of rows(createReadStream(path))) {
    if (!header) {
      header = row.map((h) => h.trim())
      continue
    }
    if (row.length < header.length - 2) continue
    yield Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""]))
  }
}

/**
 * Sums one file into candidate rows. `pick` maps a record to its race and
 * candidate or null to skip it.
 */
async function sumFile(path, source, pick) {
  const totals = new Map() // candidate key → { row, total: TOTAL-mode votes | null, modes: other modes }
  const seats = new Map()
  let read = 0
  for await (const rec of csvRecords(path)) {
    read++
    const p = pick(rec)
    if (!p || NOT_VOTES.test(p.candidate)) continue
    const votes = Number(p.votes) || 0
    const unit = p.unit ?? "" // the precinct, for TOTAL-over-modes
    const key = [p.year, p.state, p.office, p.district, p.stage, p.special, p.candidate, p.party, p.writein, unit].join("\u0001")
    const entry = totals.get(key) ?? { p, total: null, modes: 0 }
    if (/^total$/i.test(p.mode ?? "TOTAL")) entry.total = (entry.total ?? 0) + votes
    else entry.modes += votes
    totals.set(key, entry)
    const raceKey = [p.year, p.state, p.office, p.district, p.stage, p.special].join("\u0001")
    seats.set(raceKey, Math.max(seats.get(raceKey) ?? 1, Math.round(Number(p.seats) || 1)))
  }
  const candidates = new Map()
  for (const { p, total, modes } of totals.values()) {
    const key = [p.year, p.state, p.office, p.district, p.stage, p.special, p.candidate, p.party].join("\u0001")
    const row = candidates.get(key) ?? { source, year: p.year, state: p.state, office: p.office, district: p.district, stage: p.stage, special: p.special, candidate: p.candidate, party: p.party, writein: p.writein, votes: 0 }
    row.votes += total ?? modes
    candidates.set(key, row)
  }
  console.log(`${source}: ${read} rows read, ${candidates.size} candidate rows`)
  return { rows: [...candidates.values()], seats }
}

function races(results, seats, source) {
  const byRace = new Map()
  for (const r of results) {
    const key = [r.year, r.state, r.office, r.district, r.stage, r.special].join("\u0001")
    if (!byRace.has(key)) byRace.set(key, [])
    byRace.get(key).push(r)
  }
  const out = []
  for (const [key, list] of byRace) {
    const total = list.reduce((s, r) => s + (BLANK.test(r.candidate) ? 0 : r.votes), 0)
    // A fusion candidate runs on several lines; the race is between people.
    const people = new Map()
    for (const r of list) {
      if (NOBODY.test(r.candidate)) continue
      const person = people.get(r.candidate) ?? { name: r.candidate, votes: 0, parties: [] }
      person.votes += r.votes
      person.parties.push([r.party, r.votes])
      people.set(r.candidate, person)
    }
    const ranked = [...people.values()].sort((a, b) => b.votes - a.votes)
    if (!ranked.length) continue
    const n = seats.get(key) ?? 1
    const party = (person) => person && [...person.parties].sort((a, b) => b[1] - a[1])[0][0]
    const lastWon = ranked[Math.min(n, ranked.length) - 1]
    const firstLost = ranked[n]
    const [year, state, office, dist, stage, special] = key.split("\u0001")
    out.push({
      year: Number(year),
      state,
      office,
      district: dist,
      stage,
      special: special === "true",
      seats: n,
      candidates: ranked.length,
      total_votes: total,
      winners: ranked.slice(0, n).map((p) => p.name),
      winner_party: party(ranked[0]),
      winner_share: total ? Math.round((ranked[0].votes / total) * 1000) / 10 : null,
      runner_up: firstLost?.name ?? null,
      runner_up_party: party(firstLost),
      margin: firstLost && total ? Math.round(((lastWon.votes - firstLost.votes) / total) * 1000) / 10 : null,
      contested: ranked.length > n,
      source,
    })
  }
  return out
}

async function writeJson(table, columns, conflict, list) {
  const casts = { year: "smallint", special: "boolean", writein: "boolean", votes: "bigint", seats: "smallint", candidates: "smallint", total_votes: "bigint", winner_share: "real", margin: "real", contested: "boolean", winners: "text[]" }
  const spec = columns.map((c) => `${c} ${casts[c] === "text[]" ? "jsonb" : (casts[c] ?? "text")}`).join(", ")
  const select = columns.map((c) => (casts[c] === "text[]" ? `array(select jsonb_array_elements_text(r.${c}))` : `r.${c}`)).join(", ")
  const updates = columns.filter((c) => !conflict.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ")
  for (let i = 0; i < list.length; i += 1500) {
    const chunk = list.slice(i, i + 1500)
    await exec(`insert into ${table} (${columns.join(", ")}) select ${select} from jsonb_to_recordset($1::jsonb) as r(${spec}) on conflict (${conflict.join(", ")}) do update set ${updates}`, [JSON.stringify(chunk)])
  }
}

async function loadReturns() {
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = typeof flag("dir") === "string" ? flag("dir") : join(homedir(), "Code/govblock-data/elections/medsl")
  const dry = flag("dry")
  const stage = (rec) => (truthy(rec.runoff) ? "RUNOFF" : String(rec.stage).toUpperCase())
  const plan = [
    ["medsl-house", "house-1976-2024.csv", (r) => ({ year: r.year, state: r.state_po, office: "US HOUSE", district: district(r.district), stage: stage(r), special: truthy(r.special), candidate: r.candidate.trim(), party: r.party.trim(), writein: truthy(r.writein), votes: r.candidatevotes, mode: r.mode })],
    ["medsl-senate", "senate-1976-2024.csv", (r) => ({ year: r.year, state: r.state_po, office: "US SENATE", district: "", stage: stage(r), special: truthy(r.special), candidate: r.candidate.trim(), party: r.party_detailed.trim(), writein: truthy(r.writein), votes: r.candidatevotes, mode: r.mode })],
    ["medsl-president", "president-1976-2024.csv", (r) => ({ year: r.year, state: r.state_po, office: "US PRESIDENT", district: "", stage: "GEN", special: false, candidate: r.candidate.trim(), party: r.party_detailed.trim(), writein: truthy(r.writein), votes: r.candidatevotes })],
    ...["2022", "2024"].map((y) => [
      `medsl-state-${y}`,
      `state-precinct-general-${y}.csv`,
      (r) =>
        /^STATE (HOUSE|SENATE)$/.test(r.office) && String(r.stage).toUpperCase() === "GEN"
          ? { year: r.year, state: r.state_po, office: r.office, district: district(r.district), stage: "GEN", special: truthy(r.special), candidate: r.candidate.trim(), party: r.party_detailed.trim(), writein: truthy(r.writein), votes: r.votes, mode: r.mode, seats: r.magnitude, unit: [r.county_fips, r.jurisdiction_fips, r.precinct].join("|") }
          : null,
    ]),
  ]
  const tables = ["election_results", "election_races"]
  for (const [source, file, pick] of plan) {
    const { rows: results, seats } = await sumFile(join(dir, file), source, pick)
    for (const r of results) r.year = Number(r.year)
    const raceRows = races(results, seats, source)
    console.log(`${source}: ${raceRows.length} races, ${raceRows.filter((r) => !r.contested).length} uncontested`)
    if (dry) continue
    await exec(`delete from election_results where source = $1`, [source])
    await writeJson("election_results", ["source", "year", "state", "office", "district", "stage", "special", "candidate", "party", "writein", "votes"], ["source", "year", "state", "office", "district", "stage", "special", "candidate", "party"], results)
    await writeJson("election_races", ["year", "state", "office", "district", "stage", "special", "seats", "candidates", "total_votes", "winners", "winner_party", "winner_share", "runner_up", "runner_up_party", "margin", "contested", "source"], ["year", "state", "office", "district", "stage", "special"], raceRows)
    console.log(`${source}: written`)
  }
  if (!dry) console.log(await clearReadCache(tables))
}

// ---- top-two: FEC primaries ----------------------------------------------
//
//   python3 scripts/elections/fec_primaries.py ~/Code/govblock-data/elections/fec
//   node --experimental-strip-types scripts/elections/load.mjs top-two [--dir …/fec] [--dry]
//
// For each House and Senate race, 2008–2022: every candidate from every
// party's primary in one pool, the two with the most primary votes, and the
// two who met in November. A race is complete only when each major-party
// November nominee had primary votes counted; a nominee who ran unopposed or
// was named at a convention has no count to rank, so the race says so rather
// than guessing. Fusion lines (New York, Connecticut) are one candidate.

// California's top-two began in 2012 (Proposition 14), Washington's in 2008;
// Louisiana held closed party primaries for Congress only in 2008 and 2010.
const SYSTEMS = (state, year) =>
  (state === "CA" && year >= 2012) || state === "WA"
    ? "top-two"
    : state === "AK" && year >= 2022
      ? "top-four"
      : state === "LA" && !(year === 2008 || year === 2010)
        ? "Louisiana open primary"
        : "party primaries"
const MAJOR = /^(D|R|DEM|REP)$/

async function loadTopTwo() {
  const { readFileSync, existsSync } = await import("node:fs")
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = typeof flag("dir") === "string" ? flag("dir") : join(homedir(), "Code/govblock-data/elections/fec")
  const dry = flag("dry")
  const years = []
  for (const year of [2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022]) {
    const file = join(dir, `fec-candidates-${year}.json`)
    if (!existsSync(file)) continue
    const races = new Map()
    for (const row of JSON.parse(readFileSync(file, "utf8"))) {
      const key = [row.office, row.state, row.district, row.label].join("\u0001")
      if (!races.has(key)) races.set(key, [])
      races.get(key).push(row)
    }
    const out = []
    for (const [key, rows] of races) {
      const [office, state, district, label] = key.split("\u0001")
      const people = new Map()
      for (const r of rows) {
        const id = r.fec_id ?? r.name
        const p = people.get(id) ?? { name: r.name, party: null, primary: null, mark: null, general: null, winner: false, incumbent: false, lines: [] }
        if (r.primary !== null) {
          p.primary = (p.primary ?? 0) + r.primary
          if (!p.party || !MAJOR.test(p.party)) p.party = r.party
        }
        if (r.primary === null && r.primary_mark && !p.mark) p.mark = r.primary_mark
        if (r.general !== null) p.general = (p.general ?? 0) + r.general
        p.winner ||= r.winner
        p.incumbent ||= r.incumbent
        p.lines.push(r.party)
        people.set(id, p)
      }
      for (const p of people.values()) {
        p.party ??= p.lines.find((l) => MAJOR.test(l)) ?? p.lines[0] ?? ""
        p.party = p.party.replace(/^W\((.+)\)$/, "$1")
        if (p.primary !== null) p.mark = null
        delete p.lines
      }
      const list = [...people.values()].sort((a, b) => (b.primary ?? -1) - (a.primary ?? -1) || (b.general ?? -1) - (a.general ?? -1))
      const nominees = list.filter((p) => p.general !== null).sort((a, b) => b.general - a.general)
      if (!nominees.length) continue
      const system = SYSTEMS(state, year)
      const uncounted = nominees.filter((p) => MAJOR.test(p.party) && p.primary === null)
      const pool = list.filter((p) => (p.primary ?? 0) > 0)
      const complete = system !== "Louisiana open primary" && !uncounted.length && pool.length >= 2
      const missing =
        system === "Louisiana open primary"
          ? "Louisiana puts every candidate on the November ballot, so no party primary was counted."
          : uncounted.length
            ? uncounted.map((p) => `${p.name} (${p.party}) ${p.mark === "Unopposed" ? "ran unopposed" : p.mark === "*" ? "was named at a party convention" : "had no primary count"}`).join("; ")
            : pool.length < 2
              ? "Fewer than two candidates had primary votes counted."
              : null
      const topTwo = complete ? pool.slice(0, 2) : null
      const generalTwo = nominees.slice(0, 2)
      out.push({
        year,
        state,
        office,
        district,
        label,
        system,
        complete,
        missing,
        candidates: list,
        top_two: topTwo?.map((p) => p.name) ?? null,
        top_two_parties: topTwo?.map((p) => p.party) ?? null,
        general_two: generalTwo.map((p) => p.name),
        general_winner: nominees.find((p) => p.winner)?.name ?? nominees[0].name,
        same_party: topTwo ? topTwo[0].party === topTwo[1].party : null,
        differs: topTwo ? topTwo.map((p) => p.name).sort().join("|") !== generalTwo.map((p) => p.name).sort().join("|") : null,
      })
    }
    const house = out.filter((r) => r.office === "US HOUSE")
    const complete = house.filter((r) => r.complete)
    console.log(`${year}: ${out.length} races; House ${house.length}, ${complete.length} with every nominee's primary counted, ${complete.filter((r) => r.same_party).length} same-party top two, ${complete.filter((r) => r.differs).length} different matchup`)
    years.push({ year, races: out })
    if (dry) continue
    await exec(`delete from top_two_races where year = $1`, [year])
    for (let i = 0; i < out.length; i += 200) {
      const chunk = out.slice(i, i + 200)
      await exec(
        `insert into top_two_races (year, state, office, district, label, system, complete, missing, candidates, top_two, top_two_parties, general_two, general_winner, same_party, differs)
         select r.year, r.state, r.office, r.district, r.label, r.system, r.complete, r.missing, r.candidates,
                case when r.top_two is null then null else array(select jsonb_array_elements_text(r.top_two)) end,
                case when r.top_two_parties is null then null else array(select jsonb_array_elements_text(r.top_two_parties)) end,
                array(select jsonb_array_elements_text(r.general_two)), r.general_winner, r.same_party, r.differs
           from jsonb_to_recordset($1::jsonb) as r(year smallint, state text, office text, district text, label text, system text, complete boolean, missing text, candidates jsonb, top_two jsonb, top_two_parties jsonb, general_two jsonb, general_winner text, same_party boolean, differs boolean)`,
        [JSON.stringify(chunk)]
      )
    }
    const key = `elections/top-two/${year}.json`
    await s3.send(
      new PutObjectCommand({
        Bucket: PUBLIC,
        Key: key,
        Body: gzipSync(JSON.stringify({ year, source: { name: "Federal Election Commission, Federal Elections " + year, url: "https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/" }, races: out })),
        ContentType: "application/json",
        ContentEncoding: "gzip",
        CacheControl: "public, max-age=86400",
      })
    )
  }
  if (!dry) {
    const { writeFileSync, mkdirSync } = await import("node:fs")
    const { WEB } = await import("../laws/lib/db.mjs")
    mkdirSync(join(WEB, "lib/data/elections"), { recursive: true })
    const index = years
      .map(({ year, races }) => ({ year, url: `${PUBLIC_BASE}/elections/top-two/${year}.json`, races: races.length }))
      .sort((a, b) => b.year - a.year)
    writeFileSync(join(WEB, "lib/data/elections/top-two-years.json"), JSON.stringify(index) + "\n")
    console.log(`${index.length} years → apps/web/lib/data/elections/top-two-years.json`)
  }
}

// ---- klarner: state legislative returns, 2008–2022 ------------------------
//
//   node --experimental-strip-types scripts/elections/load.mjs klarner [--file …/127_slers_1967to2022.tab] [--dry]
//
// Carl Klarner, "State Legislative Election Returns, 1967-2022", Harvard
// Dataverse doi:10.7910/DVN/FJOGJB, CC0. General elections for every cycle
// since 2008 go to election_results and election_races (source klarner, which
// replaces MIT's 2022 state rows so a year has one source); the 2014 and 2015
// primaries, the only state legislative primaries it holds for these years, go
// to top_two_races. Rows split by county (2013–2016) are summed; a candidate on
// several party lines is one person in the race. A district's key is its number,
// its letter, or its county name and number ("Barnstable 1"); a seat in a
// district elected by post adds the post ("1/2").

const KLARNER_PARTY = { d: "DEMOCRAT", r: "REPUBLICAN", w: "WRITE-IN", np: "NONPARTISAN" }
const title = (s) => s.replace(/\b\p{L}/gu, (m) => m.toUpperCase())
const klarnerName = (s) => title(s.replace(/\s+\d+$/, "").trim())

// A subdistrict (Klarner's geopost) is a lettered district of its own in
// Maryland, Minnesota and the Dakotas (12A, 12B) and a numbered one in
// Vermont (Bennington 2-1).
function klarnerDistrict(x) {
  const name = (x.dname ?? "").trim()
  const number = (x.dno ?? "").trim()
  const geo = (x.geopost ?? "").trim()
  let base
  if (name && number) base = `${title(name)} ${Number(number) || number}`
  else if (number) base = /^\d+$/.test(number) ? String(Number(number)) : number.toUpperCase()
  else base = /^[a-z]{1,3}$/i.test(name) ? name.toUpperCase() : title(name)
  if (geo) base = /^\d+$/.test(geo) && x.sab !== "VT" ? `${base}${String.fromCharCode(64 + Number(geo))}` : `${base}-${geo}`
  const post = (x.mmdpost ?? "").trim()
  return { base, post: post || null, key: post ? `${base}/${post}` : base }
}

async function* tsv(path) {
  const { createReadStream } = await import("node:fs")
  const { createInterface } = await import("node:readline")
  let header = null
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    const cells = line.split("\t").map((c) => c.replace(/^"(.*)"$/, "$1"))
    if (!header) header = cells
    else yield Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
  }
}

const PRIMARY_ROUND = (etype) => !/^s|runoff/.test(etype) && (etype === "ttp" || /^laf(un)?settled$/.test(etype) || /p(f(un)?settled)?$/.test(etype))

async function loadKlarner() {
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const file = typeof flag("file") === "string" ? flag("file") : join(homedir(), "Code/govblock-data/elections/klarner/127_slers_1967to2022.tab")
  const dry = flag("dry")
  const generals = new Map() // candidate line key → row
  const raceInfo = new Map() // race key → { seats, regime, post, incumbents }
  const primaries = new Map() // race key → Map(candid → { name, party, votes, lines })
  const nominees = new Map() // race key → Map(candid → { name, party, votes, won })
  let read = 0
  for await (const x of tsv(file)) {
    const year = Number(x.year)
    if (!(year >= 2008 && year <= 2022)) continue
    read++
    const office = x.sen === "1" ? "STATE SENATE" : "STATE HOUSE"
    const d = klarnerDistrict(x)
    const votes = x.vote === "" ? null : Number(x.vote)
    const party = KLARNER_PARTY[x.partyt] ?? (x.party ? x.party.toUpperCase() : "")
    const name = klarnerName(x.cand)
    const general = x.etype === "g" || x.etype === "gs" || x.etype === "s"
    const special = x.etype !== "g"
    const raceKey = [year, x.sab, office, d.key, general ? "GEN" : "PRI", special].join("")
    if (general) {
      const line = x.party ? x.party.toUpperCase() : party
      const key = [raceKey, x.candid, line].join("")
      const row = generals.get(key) ?? { source: "klarner", year, state: x.sab, office, district: d.key, stage: "GEN", special, candidate: name, party: line === party ? party : line, candidate_id: x.candid, incumbent: x.exper === "inc", won: x.outcome === "w", writein: x.partyt === "w", votes: 0, trueParty: party }
      row.votes += votes ?? 0
      generals.set(key, row)
      const info = raceInfo.get(raceKey) ?? { seats: Number(x.eseats) || 1, regime: x.regime || null, post: d.post, incumbents: 0 }
      if (x.exper === "inc") info.incumbents++
      raceInfo.set(raceKey, info)
      if (x.etype === "g") {
        const nk = [year, x.sab, office, d.key].join("")
        if (!nominees.has(nk)) nominees.set(nk, new Map())
        const p = nominees.get(nk).get(x.candid) ?? { name, party, votes: 0, won: false }
        p.votes += votes ?? 0
        p.won ||= x.outcome === "w"
        if (party === "DEMOCRAT" || party === "REPUBLICAN") p.party = party
        nominees.get(nk).set(x.candid, p)
      }
    } else if ((year === 2014 || year === 2015) && PRIMARY_ROUND(x.etype)) {
      const nk = [year, x.sab, office, d.key].join("")
      if (!primaries.has(nk)) primaries.set(nk, { system: x.etype === "ttp" ? (x.sab === "NE" ? "top-two" : "top-two") : /^laf/.test(x.etype) ? "Louisiana open primary" : "party primaries", people: new Map() })
      const entry = primaries.get(nk)
      const p = entry.people.get(x.candid) ?? { name, party, primary: null, mark: null, general: null, winner: false, incumbent: x.exper === "inc" }
      if (votes !== null) p.primary = (p.primary ?? 0) + votes
      else if (p.primary === null) p.mark = "No count"
      if (party === "DEMOCRAT" || party === "REPUBLICAN") p.party = party
      entry.people.set(x.candid, p)
    }
  }

  // Two candidates can share a name and a party line in one race ("Scattering"
  // on two ballots, or names Klarner tells apart only by a trailing number);
  // election_results keys on the name, so those lines are one row there.
  const merged = new Map()
  for (const r of generals.values()) {
    const key = [r.year, r.state, r.office, r.district, r.stage, r.special, r.candidate, r.party].join("")
    const m = merged.get(key)
    if (m) {
      m.votes += r.votes
      m.won ||= r.won
      m.incumbent ||= r.incumbent
    } else merged.set(key, { ...r })
  }
  const results = [...generals.values()]
  const byRace = new Map()
  for (const r of results) {
    const key = [r.year, r.state, r.office, r.district, r.stage, r.special].join("")
    if (!byRace.has(key)) byRace.set(key, [])
    byRace.get(key).push(r)
  }
  const raceRows = []
  for (const [key, list] of byRace) {
    const info = raceInfo.get(key)
    const total = list.reduce((s, r) => s + (BLANK.test(r.candidate) ? 0 : r.votes), 0)
    const people = new Map()
    for (const r of list) {
      if (NOBODY.test(r.candidate) || /^scattering$/i.test(r.candidate)) continue
      const p = people.get(r.candidate_id) ?? { name: r.candidate, party: r.trueParty, votes: 0, won: false }
      p.votes += r.votes
      p.won ||= r.won
      people.set(r.candidate_id, p)
    }
    const ranked = [...people.values()].sort((a, b) => Number(b.won) - Number(a.won) || b.votes - a.votes)
    if (!ranked.length) continue
    const winners = ranked.filter((p) => p.won)
    const n = Math.max(1, winners.length || info.seats)
    const lastWon = ranked[n - 1]
    const firstLost = ranked[n]
    const [year, state, office, district, stage, special] = key.split("")
    raceRows.push({
      year: Number(year),
      state,
      office,
      district,
      stage,
      special: special === "true",
      seats: n,
      candidates: ranked.length,
      total_votes: total,
      winners: (winners.length ? winners : ranked.slice(0, n)).map((p) => p.name),
      winner_party: ranked[0].party,
      winner_share: total ? Math.round((ranked[0].votes / total) * 1000) / 10 : null,
      runner_up: firstLost?.name ?? null,
      runner_up_party: firstLost?.party ?? null,
      margin: firstLost && total && lastWon ? Math.round(((lastWon.votes - firstLost.votes) / total) * 1000) / 10 : null,
      contested: ranked.length > n,
      source: "klarner",
      regime: info.regime,
      open_seat: info.incumbents === 0,
      post: info.post,
    })
  }

  const topTwo = []
  for (const [nk, entry] of primaries) {
    const [year, state, office, district] = nk.split("")
    const general = nominees.get(nk)
    if (!general) continue
    const people = entry.people
    for (const [candid, g] of general) {
      const p = people.get(candid) ?? { name: g.name, party: g.party, primary: null, mark: "No primary on record", general: null, winner: false, incumbent: false }
      p.general = g.votes
      p.winner = g.won
      people.set(candid, p)
    }
    const list = [...people.values()].filter((p) => !/^scattering$/i.test(p.name)).sort((a, b) => (b.primary ?? -1) - (a.primary ?? -1) || (b.general ?? -1) - (a.general ?? -1))
    const nomineesList = list.filter((p) => p.general !== null).sort((a, b) => b.general - a.general)
    if (!nomineesList.length) continue
    const uncounted = nomineesList.filter((p) => (p.party === "DEMOCRAT" || p.party === "REPUBLICAN") && !(p.primary > 0))
    const pool = list.filter((p) => (p.primary ?? 0) > 0)
    const system = entry.system
    const complete = system !== "Louisiana open primary" && !uncounted.length && pool.length >= 2
    const top = complete ? pool.slice(0, 2) : null
    const two = nomineesList.slice(0, 2)
    const short = (party) => (party === "DEMOCRAT" ? "D" : party === "REPUBLICAN" ? "R" : party)
    topTwo.push({
      year: Number(year),
      state,
      office,
      district,
      label: district,
      system,
      complete,
      missing: system === "Louisiana open primary" ? "Louisiana puts every candidate on one first-round ballot." : uncounted.length ? uncounted.map((p) => `${p.name} (${short(p.party)}) has no primary count`).join("; ") : pool.length < 2 ? "Fewer than two candidates had primary votes counted." : null,
      candidates: list.map((p) => ({ ...p, party: short(p.party) })),
      top_two: top?.map((p) => p.name) ?? null,
      top_two_parties: top?.map((p) => short(p.party)) ?? null,
      general_two: two.map((p) => p.name),
      general_winner: nomineesList.find((p) => p.winner)?.name ?? nomineesList[0].name,
      same_party: top ? top[0].party === top[1].party : null,
      differs: top ? top.map((p) => p.name).sort().join("|") !== two.map((p) => p.name).sort().join("|") : null,
    })
  }

  const byYear = (rows) => Object.entries(rows.reduce((m, r) => ((m[r.year] = (m[r.year] ?? 0) + 1), m), {}))
  console.log(`klarner: ${read} rows 2008–2022; ${results.length} candidate lines; ${raceRows.length} races ${JSON.stringify(byYear(raceRows))}; ${raceRows.filter((r) => !r.contested).length} uncontested`)
  console.log(`klarner primaries: ${topTwo.length} races, ${topTwo.filter((r) => r.complete).length} with every nominee's primary counted, ${topTwo.filter((r) => r.same_party).length} same-party top two ${JSON.stringify(byYear(topTwo))}`)
  if (dry) return

  await exec(`delete from election_results where source in ('klarner', 'medsl-state-2022')`)
  await exec(`delete from election_races where source in ('klarner', 'medsl-state-2022')`)
  const rows = [...merged.values()]
  for (let i = 0; i < rows.length; i += 1500) {
    const chunk = rows.slice(i, i + 1500).map(({ trueParty, ...r }) => r)
    await exec(
      `insert into election_results (source, year, state, office, district, stage, special, candidate, party, writein, votes, candidate_id, incumbent, won)
       select r.source, r.year, r.state, r.office, r.district, r.stage, r.special, r.candidate, r.party, r.writein, r.votes, r.candidate_id, r.incumbent, r.won
         from jsonb_to_recordset($1::jsonb) as r(source text, year smallint, state text, office text, district text, stage text, special boolean, candidate text, party text, writein boolean, votes bigint, candidate_id text, incumbent boolean, won boolean)
       on conflict (source, year, state, office, district, stage, special, candidate, party) do update set votes = excluded.votes, candidate_id = excluded.candidate_id, incumbent = excluded.incumbent, won = excluded.won`,
      [JSON.stringify(chunk)]
    )
  }
  for (let i = 0; i < raceRows.length; i += 1500) {
    await exec(
      `insert into election_races (year, state, office, district, stage, special, seats, candidates, total_votes, winners, winner_party, winner_share, runner_up, runner_up_party, margin, contested, source, regime, open_seat, post)
       select r.year, r.state, r.office, r.district, r.stage, r.special, r.seats, r.candidates, r.total_votes, array(select jsonb_array_elements_text(r.winners)), r.winner_party, r.winner_share, r.runner_up, r.runner_up_party, r.margin, r.contested, r.source, r.regime, r.open_seat, r.post
         from jsonb_to_recordset($1::jsonb) as r(year smallint, state text, office text, district text, stage text, special boolean, seats smallint, candidates smallint, total_votes bigint, winners jsonb, winner_party text, winner_share real, runner_up text, runner_up_party text, margin real, contested boolean, source text, regime text, open_seat boolean, post text)
       on conflict (year, state, office, district, stage, special) do update set seats = excluded.seats, candidates = excluded.candidates, total_votes = excluded.total_votes, winners = excluded.winners,
         winner_party = excluded.winner_party, winner_share = excluded.winner_share, runner_up = excluded.runner_up, runner_up_party = excluded.runner_up_party, margin = excluded.margin,
         contested = excluded.contested, source = excluded.source, regime = excluded.regime, open_seat = excluded.open_seat, post = excluded.post`,
      [JSON.stringify(raceRows.slice(i, i + 1500))]
    )
  }
  await exec(`delete from top_two_races where year in (2014, 2015) and office in ('STATE HOUSE', 'STATE SENATE')`)
  await insertTopTwo(topTwo)
  console.log("klarner: written")
}

async function insertTopTwo(rows) {
  for (let i = 0; i < rows.length; i += 200) {
    await exec(
      `insert into top_two_races (year, state, office, district, label, system, complete, missing, candidates, top_two, top_two_parties, general_two, general_winner, same_party, differs)
       select r.year, r.state, r.office, r.district, r.label, r.system, r.complete, r.missing, r.candidates,
              case when r.top_two is null then null else array(select jsonb_array_elements_text(r.top_two)) end,
              case when r.top_two_parties is null then null else array(select jsonb_array_elements_text(r.top_two_parties)) end,
              array(select jsonb_array_elements_text(r.general_two)), r.general_winner, r.same_party, r.differs
         from jsonb_to_recordset($1::jsonb) as r(year smallint, state text, office text, district text, label text, system text, complete boolean, missing text, candidates jsonb, top_two jsonb, top_two_parties jsonb, general_two jsonb, general_winner text, same_party boolean, differs boolean)
       on conflict (year, state, office, district, label) do update set system = excluded.system, complete = excluded.complete, missing = excluded.missing, candidates = excluded.candidates,
         top_two = excluded.top_two, top_two_parties = excluded.top_two_parties, general_two = excluded.general_two, general_winner = excluded.general_winner, same_party = excluded.same_party, differs = excluded.differs`,
      [JSON.stringify(rows.slice(i, i + 200))]
    )
  }
}

// ---- fec-results: every House and Senate candidate's votes, with the FEC id ----
//
//   node --experimental-strip-types scripts/elections/load.mjs fec-results [--dir …/fec]
//
// The rows fec_primaries.py extracted, into election_results as source
// fec-<year>: a PRI row for counted primary votes, a GEN row for general
// votes, each keyed to the FEC candidate id so a member's page can find them.

async function loadFecResults() {
  const { readFileSync, existsSync } = await import("node:fs")
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = typeof flag("dir") === "string" ? flag("dir") : join(homedir(), "Code/govblock-data/elections/fec")
  for (const year of [2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022]) {
    const file = join(dir, `fec-candidates-${year}.json`)
    if (!existsSync(file)) continue
    const rows = new Map()
    for (const c of JSON.parse(readFileSync(file, "utf8"))) {
      const special = /unexpired|special/i.test(c.label)
      for (const [stage, votes] of [["PRI", c.primary], ["GEN", c.general]]) {
        if (votes === null || votes === undefined) continue
        const district = c.office === "US SENATE" ? (special ? "unexpired" : "") : c.district
        const key = [c.office, c.state, district, stage, special, c.name, c.party].join("")
        const row = rows.get(key) ?? { source: `fec-${year}`, year, state: c.state, office: c.office, district, stage, special, candidate: c.name, party: c.party, writein: /^W(\(|$)/.test(c.party), votes: 0, candidate_id: c.fec_id, incumbent: c.incumbent, won: stage === "GEN" ? c.winner : null }
        row.votes += votes
        rows.set(key, row)
      }
    }
    const list = [...rows.values()]
    await exec(`delete from election_results where source = $1`, [`fec-${year}`])
    for (let i = 0; i < list.length; i += 1500) {
      await exec(
        `insert into election_results (source, year, state, office, district, stage, special, candidate, party, writein, votes, candidate_id, incumbent, won)
         select r.source, r.year, r.state, r.office, r.district, r.stage, r.special, r.candidate, r.party, r.writein, r.votes, r.candidate_id, r.incumbent, r.won
           from jsonb_to_recordset($1::jsonb) as r(source text, year smallint, state text, office text, district text, stage text, special boolean, candidate text, party text, writein boolean, votes bigint, candidate_id text, incumbent boolean, won boolean)`,
        [JSON.stringify(list.slice(i, i + 1500))]
      )
    }
    console.log(`fec-${year}: ${list.length} rows`)
  }
}

// ---- medsl-primaries: state legislative primaries, 2016 and 2018 ----------
//
//   node --experimental-strip-types scripts/elections/load.mjs medsl-primaries [--dir …/medsl-primaries] [--dry]
//
// MIT's official precinct primary returns (github.com/MEDSL/primary-precinct-
// returns; 14 states in 2016, 18 in 2018) summed to the district, paired with
// Klarner's November results for the same district. A pairing stands only when
// the November nominees' surnames are found among that primary's candidates;
// a state where fewer than four in five of its districts pass is left out,
// since its district numbers do not line up with Klarner's.

// A district as a plain code both sources can agree on: 12, 12A, B. Named
// districts ("1st Barnstable", "Addison 1") return null and are not paired.
const districtCode = (raw) => {
  const v = String(raw ?? "").trim().toUpperCase()
  const m = v.match(/^0*(\d+)([A-Z]?)$/)
  if (m) return `${Number(m[1])}${m[2]}`
  return /^[A-Z]{1,2}$/.test(v) ? v : null
}

const surnameOf = (name) => {
  const n = String(name).toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "").trim()
  const last = n.includes(",") ? n.split(",")[0] : n.split(/\s+/).at(-1)
  return last.replace(/[^a-z]/g, "")
}

async function loadMedslPrimaries() {
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const { execFileSync } = await import("node:child_process")
  const { createReadStream } = await import("node:fs")
  const dir = typeof flag("dir") === "string" ? flag("dir") : join(homedir(), "Code/govblock-data/elections/medsl-primaries")
  const dry = flag("dry")
  const all = []
  for (const year of [2016, 2018]) {
    const csv = join(dir, `${year}_precinct_primary.csv`)
    execFileSync("unzip", ["-o", "-q", join(dir, `${year}_precinct_primary.csv.zip`), "-d", dir])
    const lines = new Map() // precinct-candidate key → { p, total, modes }
    for await (const rec of csvRecords(csv)) {
      const office = String(rec.office).toUpperCase()
      if (office !== "STATE HOUSE" && office !== "STATE SENATE") continue
      if (!/^pri$/i.test(String(rec.stage).trim()) || truthy(rec.special)) continue
      const candidate = String(rec.candidate ?? "").trim()
      if (!candidate || NOT_VOTES.test(candidate) || NOBODY.test(candidate)) continue
      const raw = String(rec.district ?? "").toUpperCase()
      const post = raw.match(/(?:POSITION|POS\.?|SEAT)\s*([A-Z0-9]+)/)?.[1] ?? null
      const district = districtCode(raw.replace(/(?:POSITION|POS\.?|SEAT)\s*[A-Z0-9]+/, "").replace(/DISTRICT/, ""))
      if (!district) continue
      const key = [rec.state_po, office, district, post ?? "", candidate, rec.party_simplified, rec.county_fips, rec.jurisdiction_fips, rec.precinct].join("")
      const entry = lines.get(key) ?? { state: rec.state_po, office, district, post, candidate, party: partyOf(rec.party_simplified), total: null, modes: 0 }
      const votes = Number(rec.votes) || 0
      if (/^total$/i.test(String(rec.mode ?? "total"))) entry.total = (entry.total ?? 0) + votes
      else entry.modes += votes
      lines.set(key, entry)
    }
    const races = new Map()
    for (const e of lines.values()) {
      const rk = [e.state, e.office, e.district, e.post ?? ""].join("")
      if (!races.has(rk)) races.set(rk, new Map())
      const people = races.get(rk)
      const p = people.get(e.candidate) ?? { name: e.candidate, party: e.party, primary: 0 }
      p.primary += e.total ?? e.modes
      people.set(e.candidate, p)
    }
    const states = [...new Set([...races.keys()].map((k) => k.split("")[0]))]
    for (const state of states) {
      const general = await q(
        `select office, district, candidate, party, votes, won from election_results where source = 'klarner' and year = $1 and state = $2 and stage = 'GEN' and not special`,
        [year, state]
      )
      const generalByRace = new Map()
      for (const g of general) {
        if (NOBODY.test(g.candidate) || /^scattering$/i.test(g.candidate)) continue
        const [base, post] = String(g.district).split("/")
        const baseKey = districtCode(base)
        if (!baseKey) continue
        const rk = [state, g.office, baseKey, post ?? ""].join("")
        if (!generalByRace.has(rk)) generalByRace.set(rk, new Map())
        const people = generalByRace.get(rk)
        const p = people.get(g.candidate) ?? { name: g.candidate, party: "O", votes: 0, won: false, district: g.district }
        p.votes += Number(g.votes) || 0
        p.won ||= g.won === true || g.won === "true"
        if (partyOf(g.party) !== "O") p.party = partyOf(g.party)
        people.set(g.candidate, p)
      }
      const built = []
      let paired = 0
      let checked = 0
      for (const [rk, primaryPeople] of races) {
        if (!rk.startsWith(state + "")) continue
        let gen = generalByRace.get(rk)
        // MIT files Washington's and Idaho's posts inside the district; Klarner by post.
        if (!gen && !rk.endsWith("")) gen = generalByRace.get(rk.replace(/[^]*$/, ""))
        if (!gen) continue
        checked++
        const surnames = new Set([...primaryPeople.values()].map((p) => surnameOf(p.name)))
        const nominees = [...gen.values()].sort((a, b) => b.votes - a.votes)
        const found = nominees.filter((n) => surnames.has(surnameOf(n.name)))
        if (!found.length) continue
        paired++
        const [, office, district, post] = rk.split("")
        const people = [...primaryPeople.values()].map((p) => ({ name: p.name, party: p.party, primary: p.primary, mark: null, general: null, winner: false, incumbent: false }))
        for (const n of nominees) {
          const match = people.find((p) => surnameOf(p.name) === surnameOf(n.name))
          if (match) {
            match.general = n.votes
            match.winner = n.won
            match.name = n.name
          } else people.push({ name: n.name, party: n.party, primary: null, mark: "No primary count", general: n.votes, winner: n.won, incumbent: false })
        }
        const list = people.sort((a, b) => (b.primary ?? -1) - (a.primary ?? -1))
        const nomineesList = list.filter((p) => p.general !== null).sort((a, b) => b.general - a.general)
        const uncounted = nomineesList.filter((p) => (p.party === "D" || p.party === "R") && !(p.primary > 0))
        const pool = list.filter((p) => (p.primary ?? 0) > 0)
        const system = state === "WA" ? "top-two" : "party primaries"
        const complete = !uncounted.length && pool.length >= 2
        const top = complete ? pool.slice(0, 2) : null
        const two = nomineesList.slice(0, 2)
        const label = nominees[0].district
        built.push({
          year,
          state,
          office,
          district: label,
          label,
          system,
          complete,
          missing: uncounted.length ? uncounted.map((p) => `${p.name} (${p.party}) has no primary count`).join("; ") : pool.length < 2 ? "Fewer than two candidates had primary votes counted." : null,
          candidates: list,
          top_two: top?.map((p) => p.name) ?? null,
          top_two_parties: top?.map((p) => p.party) ?? null,
          general_two: two.map((p) => p.name),
          general_winner: nomineesList.find((p) => p.winner)?.name ?? nomineesList[0]?.name ?? null,
          same_party: top ? top[0].party === top[1].party : null,
          differs: top ? top.map((p) => surnameOf(p.name)).sort().join("|") !== two.map((p) => surnameOf(p.name)).sort().join("|") : null,
        })
      }
      const share = checked ? paired / checked : 0
      if (share < 0.8) {
        console.log(`${year} ${state}: left out — ${paired} of ${checked} districts matched`)
        continue
      }
      console.log(`${year} ${state}: ${built.length} races, ${built.filter((r) => r.complete).length} complete, ${built.filter((r) => r.same_party).length} same-party top two (${paired}/${checked} matched)`)
      all.push(...built)
    }
  }
  if (dry) return
  await exec(`delete from top_two_races where year in (2016, 2018) and office in ('STATE HOUSE', 'STATE SENATE')`)
  // One row per district key: a post-less primary matched to several posts keeps the first.
  const unique = [...new Map(all.map((r) => [[r.year, r.state, r.office, r.district, r.label].join("|"), r])).values()]
  await insertTopTwo(unique)
  console.log(`medsl-primaries: ${unique.length} races written`)
}

// ---- members: each member's elections, for their page ----------------------
//
//   node --experimental-strip-types scripts/elections/load.mjs members [--dry]
//
// State legislators: a member is matched to Klarner's candidate id by state,
// chamber, district and surname in any cycle, and then every race run under
// that id is theirs, in whatever district redistricting put them. A surname
// that points at two different candidate ids in the same district is not
// matched. Congress: the FEC candidate ids on People, or for a member without
// them, the FEC's winner of their state and district with their surname.

async function loadMembers() {
  const { homedir } = await import("node:os")
  const { join } = await import("node:path")
  const { readFileSync, existsSync } = await import("node:fs")
  const dry = flag("dry")

  const people = []
  for (const state of [...Object.keys(STATE_FIPS), "US"]) {
    const rows = await q(`select people_id, last_name, name, chamber, district, state, fec_candidate_ids::text as fec from "People" where state = $1`, [state])
    people.push(...rows)
  }
  console.log(`${people.length} people`)

  // Every Klarner race, 2008–2022, general and primary, by candidate id.
  const races = new Map() // race key → [{ candid, name, party, votes, won, incumbent }]
  const byCandid = new Map() // candid → Set(race key)
  const index = new Map() // state|office|code → Map(surname → Set(candid))
  const file = join(homedir(), "Code/govblock-data/elections/klarner/127_slers_1967to2022.tab")
  for await (const x of tsv(file)) {
    const year = Number(x.year)
    if (!(year >= 2008 && year <= 2022)) continue
    const general = x.etype === "g"
    const primary = (year === 2014 || year === 2015) && PRIMARY_ROUND(x.etype)
    if (!general && !primary) continue
    const office = x.sen === "1" ? "STATE SENATE" : "STATE HOUSE"
    const d = klarnerDistrict(x)
    const stage = general ? "GEN" : "PRI"
    const key = [year, x.sab, office, d.key, stage].join("")
    if (!races.has(key)) races.set(key, new Map())
    const race = races.get(key)
    const name = klarnerName(x.cand)
    const p = race.get(x.candid) ?? { candid: x.candid, name, party: KLARNER_PARTY[x.partyt] ?? (x.party || "").toUpperCase(), votes: null, won: false, incumbent: false }
    if (x.vote !== "") p.votes = (p.votes ?? 0) + Number(x.vote)
    p.won ||= x.outcome === "w"
    p.incumbent ||= x.exper === "inc"
    race.set(x.candid, p)
    if (/^scattering$/i.test(name)) continue
    if (!byCandid.has(x.candid)) byCandid.set(x.candid, new Set())
    byCandid.get(x.candid).add(key)
    const codes = new Set([districtCode(d.base), townCode(d.base)].filter(Boolean))
    for (const code of codes) {
      const ik = [x.sab, office, code].join("|")
      if (!index.has(ik)) index.set(ik, new Map())
      const bySurname = index.get(ik)
      const s = surnameOf(name)
      if (!bySurname.has(s)) bySurname.set(s, new Set())
      bySurname.get(s).add(x.candid)
    }
  }

  const out = []
  const push = (people_id, state, office, district, year, stage, race, mine, source) => {
    const named = [...race.values()].filter((p) => !/^scattering$/i.test(p.name) && !NOBODY.test(p.name))
    const total = named.reduce((s, p) => s + (p.votes ?? 0), 0)
    out.push({
      people_id,
      year,
      state,
      office,
      district,
      stage,
      party: mine.party || null,
      votes: mine.votes,
      share: total && mine.votes !== null ? Math.round((mine.votes / total) * 1000) / 10 : null,
      won: stage === "GEN" ? mine.won : null,
      incumbent: mine.incumbent,
      unopposed: named.length <= 1,
      opponents: named.filter((p) => p !== mine).sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).slice(0, 6).map((p) => ({ name: p.name, party: p.party, votes: p.votes })),
      source,
    })
  }

  let matchedState = 0
  for (const person of people.filter((p) => p.state !== "US")) {
    const office = /senate|legislature/i.test(person.chamber ?? "") ? "STATE SENATE" : "STATE HOUSE"
    const raw = String(person.district ?? "").replace(/^(HD|SD)-/, "")
    const code = districtCode(raw) ?? raw.toUpperCase()
    const bySurname = index.get([person.state, office, code].join("|"))
    const candids = bySurname?.get(surnameOf(person.last_name || person.name))
    if (!candids || candids.size !== 1) continue
    const [candid] = candids
    matchedState++
    for (const key of byCandid.get(candid) ?? []) {
      const [year, state, raceOffice, district, stage] = key.split("")
      const race = races.get(key)
      push(person.people_id, state, raceOffice, district, Number(year), stage, race, race.get(candid), "klarner")
    }
  }

  // Congress, from the FEC's workbooks.
  const fec = new Map() // race key → Map(id → person)
  const fecById = new Map()
  const fecWinners = new Map() // state|district|office|surname → id
  for (const year of [2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022]) {
    const f = join(homedir(), `Code/govblock-data/elections/fec/fec-candidates-${year}.json`)
    if (!existsSync(f)) continue
    for (const c of JSON.parse(readFileSync(f, "utf8"))) {
      // Write-in lines are stray votes in other parties' primaries, not a race the member ran.
      if (/^W(\(|$)/.test(c.party)) continue
      const id = c.fec_id ?? `${year}|${c.state}|${c.name}`
      for (const [stage, votes] of [["PRI", c.primary], ["GEN", c.general]]) {
        if (votes === null) continue
        const key = [year, c.state, c.office, c.district || c.label, stage].join("")
        if (!fec.has(key)) fec.set(key, new Map())
        const race = fec.get(key)
        const p = race.get(id) ?? { name: c.name, party: c.party, votes: 0, won: false, incumbent: c.incumbent }
        p.votes += votes
        if (/^(D|R|DEM|REP)$/.test(c.party)) p.party = c.party
        p.won ||= stage === "GEN" && c.winner
        race.set(id, p)
        if (!fecById.has(id)) fecById.set(id, new Set())
        fecById.get(id).add(key)
      }
      if (c.winner && c.fec_id) fecWinners.set([c.state, c.office === "US SENATE" ? "S" : c.district, surnameOf(c.name)].join("|"), c.fec_id)
    }
  }
  let matchedCongress = 0
  for (const person of people.filter((p) => p.state === "US")) {
    let ids = String(person.fec ?? "").replace(/^\{|\}$/g, "").split(",").filter(Boolean)
    if (!ids.length) {
      const m = String(person.district ?? "").match(/^(HD|SD)-([A-Z]{2})(?:-(\d+|AL))?/)
      if (m) {
        const found = fecWinners.get([m[2], m[1] === "SD" ? "S" : m[3] === "AL" || !m[3] ? "0" : String(Number(m[3])), surnameOf(person.last_name || person.name)].join("|"))
        if (found) ids = [found]
      }
    }
    const keys = ids.flatMap((id) => [...(fecById.get(id) ?? [])])
    if (!keys.length) continue
    matchedCongress++
    for (const key of keys) {
      const [year, state, office, district, stage] = key.split("")
      const race = fec.get(key)
      const mine = ids.map((id) => race.get(id)).find(Boolean)
      if (mine) push(person.people_id, state, office, office === "US SENATE" ? "" : district, Number(year), stage, race, mine, `fec-${year}`)
    }
  }
  const unique = [...new Map(out.map((r) => [[r.people_id, r.year, r.office, r.district, r.stage].join("|"), r])).values()]
  console.log(`members: ${matchedState} state legislators and ${matchedCongress} members of Congress matched; ${unique.length} elections`)
  if (dry) return
  await exec(`delete from member_elections`)
  for (let i = 0; i < unique.length; i += 1000) {
    await exec(
      `insert into member_elections (people_id, year, state, office, district, stage, party, votes, share, won, incumbent, unopposed, opponents, source)
       select r.people_id, r.year, r.state, r.office, r.district, r.stage, r.party, r.votes, r.share, r.won, r.incumbent, r.unopposed, r.opponents, r.source
         from jsonb_to_recordset($1::jsonb) as r(people_id bigint, year smallint, state text, office text, district text, stage text, party text, votes bigint, share real, won boolean, incumbent boolean, unopposed boolean, opponents jsonb, source text)`,
      [JSON.stringify(unique.slice(i, i + 1000))]
    )
  }
  console.log("members: written")
}

const STATE_FIPS = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" }

/** "Addison 1" → "ADD1", the town-and-number code People keeps for New England districts. */
const townCode = (base) => {
  const m = String(base).match(/^([A-Za-z]+)\s+(\d+)(?:-(\d+))?$/)
  return m ? `${m[1].slice(0, 3).toUpperCase()}${m[2]}${m[3] ? `-${m[3]}` : ""}` : null
}

// ---- chambers: competition, and seats against votes -----------------------
//
//   node --experimental-strip-types scripts/elections/load.mjs chambers [--dry]
//
// One row per chamber and cycle (state legislatures from klarner 2008–2022 and
// MIT 2024; each state's U.S. House delegation from MIT, and the whole House
// as state 'US'), from November's regular races:
//   uncontested — no more candidates than seats; safe — uncontested or won by
//   20 points or more; close — won by less than 5.
//   Seats against votes — the efficiency gap over single-seat races: each
//   party's wasted votes (every losing vote, and a winner's votes past half),
//   Democrats' less Republicans', over all votes, so a positive gap favours
//   Republicans. A seat nobody contested counts at 75–25 of its own turnout,
//   or of the chamber's median contested turnout where the state printed no
//   votes. Free-for-all multi-member seats cannot be split into wasted votes
//   and are left out, and counted in excluded_seats.

const partyOf = (party) => (/^DEM/i.test(party ?? "") ? "D" : /^REP/i.test(party ?? "") ? "R" : "O")

async function loadChambers() {
  const dry = flag("dry")
  const slices = []
  for (let year = 2008; year <= 2022; year++) for (const office of ["STATE HOUSE", "STATE SENATE"]) slices.push({ source: "klarner", year, office })
  for (const office of ["STATE HOUSE", "STATE SENATE"]) slices.push({ source: "medsl-state-2024", year: 2024, office })
  for (let year = 2008; year <= 2024; year += 2) slices.push({ source: "medsl-house", year, office: "US HOUSE" })
  const out = []
  const national = new Map()
  for (const s of slices) {
    const races = await q(
      `select state, district, seats, contested, margin, open_seat, winners::text as winners from election_races
        where source = $1 and year = $2 and office = $3 and stage = 'GEN' and not special`,
      [s.source, s.year, s.office]
    )
    if (!races.length) continue
    const results = await q(
      `select state, district, candidate, party, votes from election_results
        where source = $1 and year = $2 and office = $3 and stage = 'GEN' and not special`,
      [s.source, s.year, s.office]
    )
    const byRace = new Map()
    for (const r of results) {
      const key = `${r.state}${r.district}`
      if (!byRace.has(key)) byRace.set(key, new Map())
      if (NOBODY.test(r.candidate) || /^scattering$/i.test(r.candidate)) continue
      const people = byRace.get(key)
      const p = people.get(r.candidate) ?? { votes: 0, party: "O" }
      p.votes += Number(r.votes) || 0
      const major = partyOf(r.party)
      if (major !== "O") p.party = major
      people.set(r.candidate, p)
    }
    const states = new Map()
    for (const race of races) {
      const st = states.get(race.state) ?? { rows: [], contestedTotals: [] }
      const people = byRace.get(`${race.state}${race.district}`) ?? new Map()
      const winners = String(race.winners ?? "").replace(/^\{|\}$/g, "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((w) => w.replace(/^"|"$/g, "").replace(/\\"/g, '"')).filter(Boolean)
      st.rows.push({ race, people, winners })
      const two = [...people.values()].filter((p) => p.party !== "O")
      if (race.contested === true || race.contested === "true") {
        const total = two.reduce((sum, p) => sum + p.votes, 0)
        if (total > 0 && Number(race.seats) === 1) st.contestedTotals.push(total)
      }
      states.set(race.state, st)
    }
    for (const [state, st] of states) {
      const median = st.contestedTotals.length ? [...st.contestedTotals].sort((a, b) => a - b)[Math.floor(st.contestedTotals.length / 2)] : 0
      const row = { year: s.year, state, office: s.office, seats_up: 0, uncontested: 0, safe: 0, close: 0, open_seats: s.source === "klarner" ? 0 : null, dem_seats: 0, rep_seats: 0, other_seats: 0, dem_votes: 0, rep_votes: 0, wasted_d: 0, wasted_r: 0, gap_votes: 0, gap_seat_count: 0, excluded_seats: 0, source: s.source }
      for (const { race, people, winners } of st.rows) {
        const seats = Number(race.seats) || 1
        const contested = race.contested === true || race.contested === "true"
        const margin = race.margin === null ? null : Number(race.margin)
        row.seats_up += seats
        if (!contested) row.uncontested += seats
        if (!contested || (margin !== null && margin >= 20)) row.safe += seats
        if (contested && margin !== null && margin < 5) row.close += seats
        if (row.open_seats !== null && (race.open_seat === true || race.open_seat === "true")) row.open_seats += seats
        for (const w of winners) {
          const party = people.get(w)?.party ?? "O"
          if (party === "D") row.dem_seats++
          else if (party === "R") row.rep_seats++
          else row.other_seats++
        }
        if (seats > 1) {
          row.excluded_seats += seats
          continue
        }
        let d = [...people.values()].filter((p) => p.party === "D").reduce((sum, p) => sum + p.votes, 0)
        let r = [...people.values()].filter((p) => p.party === "R").reduce((sum, p) => sum + p.votes, 0)
        const winnerParty = people.get(winners[0])?.party
        if (winnerParty !== "D" && winnerParty !== "R") continue
        if (!(d > 0 && r > 0)) {
          const turnout = d + r > 0 ? d + r : median
          if (!turnout) continue
          d = winnerParty === "D" ? turnout * 0.75 : turnout * 0.25
          r = turnout - d
        }
        const total = d + r
        row.dem_votes += d
        row.rep_votes += r
        row.gap_votes += total
        row.gap_seat_count++
        if (d > r) {
          row.wasted_d += d - total / 2
          row.wasted_r += r
        } else {
          row.wasted_r += r - total / 2
          row.wasted_d += d
        }
      }
      out.push(row)
      if (s.office === "US HOUSE") {
        const n = national.get(s.year) ?? { ...row, state: "US", seats_up: 0, uncontested: 0, safe: 0, close: 0, dem_seats: 0, rep_seats: 0, other_seats: 0, dem_votes: 0, rep_votes: 0, wasted_d: 0, wasted_r: 0, gap_votes: 0, gap_seat_count: 0, excluded_seats: 0 }
        for (const k of ["seats_up", "uncontested", "safe", "close", "dem_seats", "rep_seats", "other_seats", "dem_votes", "rep_votes", "wasted_d", "wasted_r", "gap_votes", "gap_seat_count", "excluded_seats"]) n[k] += row[k]
        national.set(s.year, n)
      }
    }
    console.log(`${s.source} ${s.year} ${s.office}: ${states.size} states`)
  }
  out.push(...national.values())
  const rows = out.map((r) => {
    const twoParty = r.dem_votes + r.rep_votes
    const seatsTwo = r.dem_seats + r.rep_seats
    const gap = r.gap_votes ? (r.wasted_d - r.wasted_r) / r.gap_votes : null
    return {
      year: r.year,
      state: r.state,
      office: r.office,
      seats_up: r.seats_up,
      uncontested: r.uncontested,
      safe: r.safe,
      close: r.close,
      open_seats: r.open_seats,
      dem_seats: r.dem_seats,
      rep_seats: r.rep_seats,
      other_seats: r.other_seats,
      dem_votes: Math.round(r.dem_votes),
      rep_votes: Math.round(r.rep_votes),
      dem_vote_share: twoParty ? Math.round((r.dem_votes / twoParty) * 1000) / 10 : null,
      dem_seat_share: seatsTwo ? Math.round((r.dem_seats / seatsTwo) * 1000) / 10 : null,
      efficiency_gap: gap === null ? null : Math.round(gap * 1000) / 10,
      gap_seats: gap === null ? null : Math.round(gap * r.gap_seat_count * 10) / 10,
      excluded_seats: r.excluded_seats,
      source: r.source,
    }
  })
  const us = rows.filter((r) => r.state === "US")
  console.log(`${rows.length} chamber rows; House: ${us.map((r) => `${r.year} D ${r.dem_vote_share}% votes / ${r.dem_seat_share}% seats, gap ${r.efficiency_gap}`).join("; ")}`)
  if (dry) return
  await exec(`delete from chamber_results`)
  for (let i = 0; i < rows.length; i += 500) {
    await exec(
      `insert into chamber_results (year, state, office, seats_up, uncontested, safe, close, open_seats, dem_seats, rep_seats, other_seats, dem_votes, rep_votes, dem_vote_share, dem_seat_share, efficiency_gap, gap_seats, excluded_seats, source)
       select r.year, r.state, r.office, r.seats_up, r.uncontested, r.safe, r.close, r.open_seats, r.dem_seats, r.rep_seats, r.other_seats, r.dem_votes, r.rep_votes, r.dem_vote_share, r.dem_seat_share, r.efficiency_gap, r.gap_seats, r.excluded_seats, r.source
         from jsonb_to_recordset($1::jsonb) as r(year smallint, state text, office text, seats_up smallint, uncontested smallint, safe smallint, close smallint, open_seats smallint, dem_seats smallint, rep_seats smallint, other_seats smallint, dem_votes bigint, rep_votes bigint, dem_vote_share real, dem_seat_share real, efficiency_gap real, gap_seats real, excluded_seats smallint, source text)`,
      [JSON.stringify(rows.slice(i, i + 500))]
    )
  }
  await s3.send(new PutObjectCommand({ Bucket: PUBLIC, Key: "elections/chambers.json", Body: gzipSync(JSON.stringify({ method: "sql/030_elections_detail.sql; scripts/elections/load.mjs chambers", rows })), ContentType: "application/json", ContentEncoding: "gzip", CacheControl: "public, max-age=86400" }))
  console.log(`chambers: written, elections/chambers.json published`)
}

// ---- top-two-publish: the public files the top-two mode reads -------------
//
//   node --experimental-strip-types scripts/elections/load.mjs top-two-publish
//
// Everything in top_two_races, a file per year (Congress and whichever state
// legislatures that year has primaries for), and the index the page carries.

async function publishTopTwo() {
  const { writeFileSync, mkdirSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { WEB } = await import("../laws/lib/db.mjs")
  const groups = await q(`select year, office, state, count(*)::int as n from top_two_races group by 1, 2, 3 order by 1, 2, 3`)
  const years = [...new Set(groups.map((g) => Number(g.year)))].sort((a, b) => b - a)
  const index = []
  for (const year of years) {
    const races = []
    for (const g of groups.filter((g) => Number(g.year) === year)) {
      const rows = await q(
        `select year, state, office, district, label, system, complete, missing, candidates::text as candidates, top_two::text as top_two, top_two_parties::text as top_two_parties,
                general_two::text as general_two, general_winner, same_party, differs
           from top_two_races where year = $1 and office = $2 and state = $3`,
        [year, g.office, g.state]
      )
      const arr = (v) => (v === null ? null : String(v).replace(/^\{|\}$/g, "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).filter((x) => x !== "").map((x) => x.replace(/^"|"$/g, "").replace(/\\"/g, '"')))
      for (const r of rows)
        races.push({
          ...r,
          year: Number(r.year),
          complete: r.complete === true || r.complete === "true",
          same_party: r.same_party === null ? null : r.same_party === true || r.same_party === "true",
          differs: r.differs === null ? null : r.differs === true || r.differs === "true",
          candidates: JSON.parse(r.candidates),
          top_two: arr(r.top_two),
          top_two_parties: arr(r.top_two_parties),
          general_two: arr(r.general_two) ?? [],
        })
    }
    const key = `elections/top-two/${year}.json`
    await s3.send(new PutObjectCommand({ Bucket: PUBLIC, Key: key, Body: gzipSync(JSON.stringify({ year, races })), ContentType: "application/json", ContentEncoding: "gzip", CacheControl: "public, max-age=86400" }))
    const offices = [...new Set(races.map((r) => r.office))]
    index.push({ year, url: `${PUBLIC_BASE}/${key}`, races: races.length, offices })
    console.log(`${year}: ${races.length} races (${offices.join(", ")})`)
  }
  mkdirSync(join(WEB, "lib/data/elections"), { recursive: true })
  writeFileSync(join(WEB, "lib/data/elections/top-two-years.json"), JSON.stringify(index) + "\n")
}

// ---- snapshot: the simulator's list of contests ---------------------------
//
//   node --experimental-strip-types scripts/elections/load.mjs snapshot
//
// The page reads no database: it carries this file, newest contest first, and
// fetches a contest's ballots only when a reader opens it.
async function snapshot() {
  const { writeFileSync, mkdirSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { WEB } = await import("../laws/lib/db.mjs")
  const list = await q(
    `select id, title, state, election_date::text as date, ballots, winner, first_round_leader as leader, comeback, condorcet_winner as condorcet, profile_url as url
       from rcv_contests order by election_date desc, title`
  )
  const dir = join(WEB, "lib/data/elections")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "rcv-contests.json"), JSON.stringify(list.map((c) => ({ ...c, ballots: Number(c.ballots), comeback: c.comeback === true || c.comeback === "true" })), null, 0) + "\n")
  console.log(`${list.length} contests → apps/web/lib/data/elections/rcv-contests.json`)
}

const command = argv[0]
if (command === "rcv") await loadRcv()
else if (command === "returns") await loadReturns()
else if (command === "snapshot") await snapshot()
else if (command === "top-two") await loadTopTwo()
else if (command === "klarner") await loadKlarner()
else if (command === "chambers") await loadChambers()
else if (command === "fec-results") await loadFecResults()
else if (command === "medsl-primaries") await loadMedslPrimaries()
else if (command === "members") await loadMembers()
else if (command === "top-two-publish") await publishTopTwo()
else {
  console.error("usage: node --experimental-strip-types scripts/elections/load.mjs rcv [--only text] [--dry] | returns [--dir path] [--dry]")
  process.exit(2)
}
