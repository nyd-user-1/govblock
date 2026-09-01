// Ported from livingston-v3 lib/policy/queries.ts — the same schema, so the SQL
// carries over unchanged. This is the raw database layer: it throws rather than
// falling back, because the caller decides what an empty jurisdiction means
// (see the route, and §0.2 of the lane J prompt). The snapshot fallbacks live in
// lib/policy/queries.ts and in use-policy.
//
// Reached over the RDS Data API through db.ts's q()/one(). Three limits that
// Neon did not have and that this file was not written against: results cap at
// 1 MB, an INTERVAL column cannot be returned at all, and a JS integer binds as
// bigint (so left(text, $1) needs $1::int).

import "server-only"

import { n, one, q } from "@/lib/policy/db"
import { DEFAULT_STATE, type Filters } from "@/lib/filters"

// Calendar rows carry a few impossible dates (2106-…); cap at a year out.
export const DATE_CAP = "to_char(now() + interval '1 year', 'YYYY-MM-DD')"

// govblock's Filters types every key as a string, so a plain intersection
// collapses `session` to never. Override the two keys instead.
export type Resolved = Omit<Filters, "state" | "session"> & { state: string; session: number }

// ---------------------------------------------------------------------------
// Jurisdictions and sessions

export async function getStates() {
  return q<{
    state: string
    bills: number
    latest_year: number
    sessions: number
  }>(
    `select state, sum(bills)::int bills, max(year)::int latest_year, count(*)::int sessions
     from "LegiscanDatasets" group by 1 order by 1`
  )
}

// Bills.session_id is the session's first year (2025 for New York's
// 2025-2026), which is LegiscanDatasets.year — so the session list comes from
// the 998-row dataset ledger alone: ~100 ms for every jurisdiction.
//
// LegiScan's real `session_title` lives in "Bills", where a cold read costs
// 0.2–15 s depending on the state (Texas was the 15 s case, and the header's
// scope hook waited on it). Titles are therefore fetched only where one is
// actually shown — `getSessionTitles`, behind `?titles=1`.
export async function getSessions(state: string) {
  const years = await q<{
    session_id: number
    bills: number
    datasets: number
  }>(
    `select year::int as session_id, sum(bills)::int as bills, count(*)::int as datasets
     from "LegiscanDatasets" where state = $1 group by 1 order by 1 desc`,
    [state]
  )
  const titleOf = sessionTitleCache.get(state)?.value
  return years.map((y) => ({
    session_id: n(y.session_id),
    bills: n(y.bills),
    // Never guessed into a span: Texas's 2025 session is one year and New
    // York's is two, and the ledger cannot tell them apart. The real title
    // replaces this once it has been fetched.
    title: titleOf?.get(n(y.session_id)) ?? `${y.session_id} Session`,
  }))
}

// Session titles change once a year; memoised per function instance so a warm
// lambda serves them free, and only ever paid for by a surface that shows one.
const sessionTitleCache = new Map<
  string,
  { value: Map<number, string>; at: number }
>()

export async function getSessionTitles(state: string) {
  const cached = sessionTitleCache.get(state)
  if (cached && Date.now() - cached.at < 3_600_000) return cached.value
  // The lowest bill numbers of a state exist in every session, so the first
  // rows of the (state, bill_number, session_id) index name them all.
  const rows = await q<{ session_id: number; title: string }>(
    `select session_id, session_title as title from "Bills"
     where state = $1 and coalesce(session_title, '') <> '' order by bill_number limit 60`,
    [state]
  )
  const value = new Map<number, string>()
  for (const row of rows) {
    if (!value.has(n(row.session_id))) value.set(n(row.session_id), row.title)
  }
  sessionTitleCache.set(state, { value, at: Date.now() })
  return value
}

// The list with LegiScan's own titles — for the pickers that show them.
export async function getSessionsWithTitles(state: string) {
  const titles = await getSessionTitles(state)
  const sessions = await getSessions(state)
  return sessions.map((row) => ({
    ...row,
    title: titles.get(row.session_id) ?? row.title,
  }))
}

// Memoised per function instance: the latest session for a state changes
// once a year, and `resolve` runs on every request.
const latestSessionCache = new Map<string, { value: number; at: number }>()

export async function latestSession(state: string) {
  const cached = latestSessionCache.get(state)
  if (cached && Date.now() - cached.at < 3_600_000) return cached.value
  // The newest session that actually has bills, so a state sitting between
  // sessions lands on its most recent one instead of an empty shell. The
  // filter falls back to the plain maximum for a state whose ledger rows
  // carry no counts yet.
  const row = await one<{ year: number }>(
    `select coalesce(max(year) filter (where bills > 0), max(year))::int as year
     from "LegiscanDatasets" where state = $1`,
    [state]
  )
  const value = n(row?.year) || new Date().getFullYear()
  latestSessionCache.set(state, { value, at: Date.now() })
  return value
}

export async function resolve(filters: Filters): Promise<Resolved> {
  const state = filters.state || DEFAULT_STATE
  const session = filters.session
    ? Number(filters.session)
    : await latestSession(state)
  return { ...filters, state, session }
}

// The filter → SQL translation, shared by every bills query. `params` is
// mutated; `$n` placeholders index into it. `withSession = false` spans the
// state's sessions (the component charts' session grain).
export function billWhere(
  f: Resolved,
  params: unknown[],
  b = "b",
  withSession = true
) {
  const where = [`${b}.state = $${params.push(f.state)}`]
  if (withSession) where.push(`${b}.session_id = $${params.push(f.session)}`)
  if (f.chamber) where.push(`${b}.body = $${params.push(f.chamber)}`)
  if (f.committee) where.push(`${b}.committee = $${params.push(f.committee)}`)
  if (f.status) where.push(`${b}.status_desc = $${params.push(f.status)}`)
  if (f.party) {
    // Per bill: one probe of the sponsors index against the (hashed, ~300
    // row) set of the party's people. No People lookups per bill.
    where.push(
      `exists (select 1 from "Sponsors" s where s.bill_id = ${b}.bill_id and s.sponsor_type_id = 1
               and s.people_id in (select p.people_id from "People" p
                                   where p.state = $${params.push(f.state)} and coalesce(nullif(p.party, ''), 'I') = $${params.push(f.party)}))`
    )
  }
  if (f.member && f.vote) {
    // A member plus a vote position: the bills they voted that way on. Walks
    // the member's votes (people index) once, then the roll calls by key.
    where.push(
      `${b}.bill_id in (select r.bill_id from "Votes" v join "Roll Call" r using (roll_call_id)
               where v.people_id = $${params.push(Number(f.member))} and v.vote_desc = $${params.push(f.vote)})`
    )
  } else if (f.member) {
    where.push(
      `exists (select 1 from "Sponsors" s where s.bill_id = ${b}.bill_id and s.people_id = $${params.push(Number(f.member))})`
    )
  }
  if (f.subject) {
    where.push(
      `exists (select 1 from "Subjects" sj where sj.bill_id = ${b}.bill_id and sj.subject = $${params.push(f.subject)})`
    )
  }
  return where.join(" and ")
}

// ---------------------------------------------------------------------------
// Options for the rail

// Subjects are three million rows; their own resource, fetched lazily.
export async function getSubjects(f: Resolved) {
  return q<{ value: string; count: number }>(
    `select sj.subject value, count(*)::int count
     from "Subjects" sj join "Bills" b using (bill_id)
     where b.state = $1 and b.session_id = $2 group by 1 order by 2 desc limit 80`,
    [f.state, f.session]
  )
}

export async function getOptions(f: Resolved) {
  const [chambers, committees, statuses, parties, sessions] = await Promise.all(
    [
      q<{ value: string; count: number }>(
        `select body value, count(*)::int count from "Bills"
         where state = $1 and session_id = $2 and coalesce(body, '') <> '' group by 1 order by 2 desc`,
        [f.state, f.session]
      ),
      q<{ value: string; count: number }>(
        `select committee value, count(*)::int count from "Bills"
         where state = $1 and session_id = $2 and coalesce(committee, '') <> '' group by 1 order by 1`,
        [f.state, f.session]
      ),
      q<{ value: string; count: number }>(
        `select status_desc value, count(*)::int count from "Bills"
         where state = $1 and session_id = $2 and coalesce(status_desc, '') <> '' group by 1 order by 2 desc`,
        [f.state, f.session]
      ),
      q<{ value: string; count: number }>(
        `select coalesce(nullif(party, ''), 'I') value, count(*)::int count from "People"
         where state = $1 and not coalesce(archived, false) group by 1 order by 2 desc`,
        [f.state]
      ),
      getSessions(f.state),
    ]
  )
  return {
    chambers,
    committees,
    statuses,
    parties,
    subjects: [] as { value: string; count: number }[],
    sessions,
  }
}

// ---------------------------------------------------------------------------
// Bills

export type BillRow = {
  bill_id: number
  bill_number: string
  title: string
  description: string | null
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  committee: string | null
  body: string | null
  url: string | null
  state_link: string | null
  text_chars: number | null
  sponsor: string | null
  sponsor_party: string | null
  sponsor_id: number | null
}

const BILL_COLUMNS = `b.bill_id, b.bill_number, b.title, b.description, b.status_desc, b.last_action, b.last_action_date,
  b.committee, b.body, b.url, b.state_link, b.text_chars,
  sp.name sponsor, sp.party sponsor_party, sp.people_id sponsor_id`

const PRIME_SPONSOR = `left join lateral (
  select p.name, p.party, p.people_id from "Sponsors" s join "People" p using (people_id)
  where s.bill_id = b.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) sp on true`

export async function getBills(f: Resolved, limit = 40, offset = 0) {
  const params: unknown[] = []
  const where = billWhere(f, params)
  const [rows, count] = await Promise.all([
    q<BillRow>(
      `select ${BILL_COLUMNS} from "Bills" b ${PRIME_SPONSOR}
       where ${where}
       order by b.last_action_date desc nulls last, b.bill_id desc
       limit $${params.push(limit)} offset $${params.push(offset)}`,
      params
    ),
    one<{ total: number }>(
      `select count(*)::int total from "Bills" b where ${where}`,
      params.slice(0, -2)
    ),
  ])
  return {
    rows: rows.map((r) => ({ ...r, bill_id: n(r.bill_id) })),
    total: n(count?.total),
  }
}

export async function getBillByNumber(
  state: string,
  session: number,
  number: string
) {
  return one<{ bill_id: number }>(
    `select bill_id from "Bills" where state = $1 and session_id = $2 and bill_number = $3 order by special limit 1`,
    [state, session, number]
  )
}

export async function getBill(billId: number) {
  const bill = await one<
    BillRow & {
      state: string
      session_id: number
      session_title: string | null
      status_date: string | null
      bill_type: string | null
      created_at: string
    }
  >(
    `select ${BILL_COLUMNS}, b.state, b.session_id, b.session_title, b.status_date, b.bill_type, b.created_at
     from "Bills" b ${PRIME_SPONSOR} where b.bill_id = $1`,
    [billId]
  )
  if (!bill) return null
  const [
    sponsors,
    history,
    rollCalls,
    referrals,
    progress,
    sameAs,
    documents,
    subjects,
    texts,
    hearings,
  ] = await Promise.all([
    q<{
      people_id: number
      name: string
      party: string
      role: string
      district: string
      chamber: string
      type: number
      photo_url: string | null
    }>(
      `select p.people_id, p.name, p.party, p.role, p.district, p.chamber, s.sponsor_type_id type, p.photo_url
         from "Sponsors" s join "People" p using (people_id) where s.bill_id = $1 order by s.sponsor_type_id, s.position`,
      [billId]
    ),
    q<{ date: string; chamber: string; action: string; sequence: number }>(
      `select date, chamber, action, sequence from "History Table" where bill_id = $1 order by date, sequence`,
      [billId]
    ),
    q<{
      roll_call_id: number
      date: string
      chamber: string
      description: string
      yea: number
      nay: number
      nv: number
      absent: number
      total: number
    }>(
      `select roll_call_id, date, chamber, description, yea::int yea, nullif(nay, '')::int nay, nullif(nv, '')::int nv,
                nullif(absent, '')::int absent, total::int total
         from "Roll Call" where bill_id = $1 order by date`,
      [billId]
    ),
    q<{ date: string; chamber: string; name: string }>(
      `select date, chamber, name from "Referrals" where bill_id = $1 order by seq`,
      [billId]
    ),
    q<{ date: string; event: string }>(
      `select date, event from "Progress" where bill_id = $1 order by seq`,
      [billId]
    ),
    q<{ sast_type: string; sast_bill_id: number; sast_bill_number: string }>(
      `select sast_type, sast_bill_id, sast_bill_number from "SameAs" where bill_id = $1 order by sast_type_id`,
      [billId]
    ),
    q<{
      document_id: number
      document_type: string
      document_desc: string
      url: string | null
      state_link: string | null
      document_size: number | null
    }>(
      `select document_id, document_type, document_desc, url, state_link, document_size
         from "Documents" where bill_id = $1 order by document_type, document_id`,
      [billId]
    ),
    q<{ subject: string }>(
      `select subject from "Subjects" where bill_id = $1 order by subject`,
      [billId]
    ),
    q<{
      document_id: number
      version: string | null
      chars: number
      fetched_at: string | null
      source: string | null
    }>(
      `select document_id, version, chars, fetched_at, source from "BillTexts"
         where bill_id = $1 and text is not null order by document_id desc`,
      [billId]
    ),
    q<{
      date: string
      time: string
      type: string
      description: string
      location: string
    }>(
      `select date, time, type, description, location from "Calendar" where bill_id = $1 and date <= ${DATE_CAP} order by date desc, seq`,
      [billId]
    ),
  ])
  return {
    ...bill,
    bill_id: n(bill.bill_id),
    sponsors: sponsors.map((s) => ({ ...s, people_id: n(s.people_id) })),
    history,
    rollCalls: rollCalls.map((r) => ({
      ...r,
      roll_call_id: n(r.roll_call_id),
    })),
    referrals,
    progress,
    sameAs,
    documents,
    subjects: subjects.map((s) => s.subject),
    texts: texts.map((t) => ({ ...t, document_id: n(t.document_id) })),
    hearings,
  }
}

// Assembly texts arrive as a scrape of the whole assembly.state.ny.us page
// (nav, votes …) ahead of an "<bill> Text:" marker, and end with "Go to top".
// Same rule as scripts/build-policy-content.mts — keep the bill only.
export function cleanBillText(raw: string) {
  let text = String(raw ?? "").replace(/\r/g, "")
  const marker = text.match(/^\s*[A-Z]\d+[A-Z]? Text:[ \t]*$/m)
  if (marker?.index !== undefined) {
    text = text.slice(marker.index + marker[0].length)
  }
  return text
    .replace(/^\s*Go to top\s*$/gm, "")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "")
}

export async function getBillText(billId: number, documentId?: number) {
  const params: unknown[] = [billId]
  const doc = documentId
    ? `and t.document_id = $${params.push(documentId)}`
    : ""
  const row = await one<{
    document_id: number
    version: string | null
    chars: number
    fetched_at: string | null
    text: string
    document_desc: string | null
  }>(
    `select t.document_id, t.version, t.chars, t.fetched_at, t.text, d.document_desc
     from "BillTexts" t left join "Documents" d on d.document_id = t.document_id and d.document_type = 'text'
     where t.bill_id = $1 and t.text is not null ${doc} order by t.document_id desc limit 1`,
    params
  )
  if (!row) return null
  const text = cleanBillText(row.text)
  return { ...row, document_id: n(row.document_id), text, chars: text.length }
}

export async function getBillVotes(billId: number) {
  const rollCalls = await q<{
    roll_call_id: number
    date: string
    chamber: string
    description: string
    yea: number
    nay: number
    nv: number
    absent: number
    total: number
  }>(
    `select roll_call_id, date, chamber, description, yea::int yea, nullif(nay, '')::int nay, nullif(nv, '')::int nv,
            nullif(absent, '')::int absent, total::int total
     from "Roll Call" where bill_id = $1 order by date`,
    [billId]
  )
  if (!rollCalls.length) return { rollCalls: [], votes: [] }
  const votes = await q<{
    roll_call_id: number
    vote_desc: string
    people_id: number
    name: string
    party: string
    district: string
    chamber: string
  }>(
    `select v.roll_call_id, v.vote_desc, p.people_id, p.name, p.party, p.district, p.chamber
     from "Votes" v join "People" p using (people_id)
     where v.roll_call_id = any($1::bigint[]) order by v.roll_call_id, p.last_name, p.first_name`,
    [rollCalls.map((r) => n(r.roll_call_id))]
  )
  return {
    rollCalls: rollCalls.map((r) => ({
      ...r,
      roll_call_id: n(r.roll_call_id),
    })),
    votes: votes.map((v) => ({
      ...v,
      roll_call_id: n(v.roll_call_id),
      people_id: n(v.people_id),
    })),
  }
}

// ---------------------------------------------------------------------------
// Members

// `active` = sponsored something this session. The People table keeps former
// members (518 for New York against 213 seats), so the rail lists actives
// first and the widgets default to them.
export async function getMembers(f: Resolved) {
  // The people actually sitting this session, from `"SessionPeople"` —
  // LegiScan's `getSessionPeople` roster, 8,064 rows across all 52
  // jurisdictions, `year` matching `Bills.session_id`.
  //
  // What this replaces, and why it mattered: `active` used to mean "on
  // `member_vote_tallies`", which only exists for New York, so every other
  // jurisdiction showed *everyone* as sitting — 205 for Alaska against 62
  // seats, 1,273 for Congress against 553. Worse, LegiScan models a sponsor
  // committee as a row in `"People"`, so Alaska's directory opened on
  // "Fisheries", "Labor & Commerce" and "State Affairs" instead of
  // legislators. Those rows carry `committee_id`, and they are excluded here.
  //
  // Former members are kept, after the roster: they sponsored the bills the
  // rest of the app links to, and a grey dot is a better answer than a dead
  // name. `active` is now exactly "on this session's roster".
  const params: unknown[] = [f.state, f.session]
  let filters = ""
  if (f.chamber) filters += ` and p.chamber = $${params.push(f.chamber)}`
  if (f.party)
    filters += ` and coalesce(nullif(p.party, ''), 'I') = $${params.push(f.party)}`

  const rows = await q<{
    people_id: number
    name: string
    first_name: string
    last_name: string
    party: string
    role: string
    chamber: string
    district: string
    photo_url: string | null
    leadership_title: string | null
    active: boolean
  }>(
    `select p.people_id, p.name, p.first_name, p.last_name, p.party, p.role,
            p.chamber, p.district, p.photo_url, p.leadership_title, p.bioguide_id,
            (sp.people_id is not null) as active
     from "People" p
     left join "SessionPeople" sp
       on sp.people_id = p.people_id and sp.state = $1 and sp.year = $2
     where p.state = $1
       and p.committee_id is null
       and not coalesce(p.archived, false)
       and p.role in ('Rep', 'Sen')
       ${filters}
     order by active desc, p.last_name, p.first_name`,
    params
  )
  return rows.map((r) => ({ ...r, people_id: n(r.people_id) }))
}

/** How many people are sitting this session — the number a roster prints. */
export async function getSeatCount(f: Resolved) {
  const row = await one<{ seats: number }>(
    `select count(*)::int as seats
     from "SessionPeople" sp join "People" p using (people_id)
     where sp.state = $1 and sp.year = $2 and p.committee_id is null`,
    [f.state, f.session]
  )
  return n(row?.seats)
}

// A member's jurisdiction, on its own. The member page is keyed by
// `people_id` alone (they are globally unique), so it has to learn the state
// before it can resolve a session.
export async function getMemberState(peopleId: number) {
  const row = await one<{ state: string }>(
    `select state from "People" where people_id = $1`,
    [peopleId]
  )
  return row?.state ?? null
}

export async function getMember(peopleId: number, session: number) {
  const person = await one<
    Record<string, unknown> & { people_id: number; name: string; state: string }
  >(
    `select people_id, name, first_name, last_name, party, role, chamber, district, bio_long, photo_url, email,
            phone_capitol, phone_district, address, leadership_title, state, legiscan_legislation_url, nys_bio_url, bio_url,
            votesmart_id, opensecrets_id, ballotpedia, bioguide_id, fec_candidate_ids, committee_ids
     from "People" where people_id = $1`,
    [peopleId]
  )
  if (!person) return null
  const [counts, votes, bills, fec] = await Promise.all([
    one<{ prime: number; cosponsor: number }>(
      `select count(*) filter (where s.sponsor_type_id = 1)::int prime,
              count(*) filter (where s.sponsor_type_id <> 1)::int cosponsor
       from "Sponsors" s join "Bills" b using (bill_id) where s.people_id = $1 and b.session_id = $2`,
      [peopleId, session]
    ),
    // Career tallies from the precomputed table (the live count over a
    // member's 30k votes takes seconds on this compute).
    one<{ yea: number; nay: number; updated_at: string }>(
      `select yea_count::int as yea, no_count::int as nay, updated_at from member_vote_tallies where people_id = $1`,
      [peopleId]
    ),
    q<BillRow & { type: number }>(
      `select ${BILL_COLUMNS}, s.sponsor_type_id type from "Sponsors" s join "Bills" b using (bill_id) ${PRIME_SPONSOR}
       where s.people_id = $1 and b.session_id = $2 order by b.last_action_date desc nulls last limit 12`,
      [peopleId, session]
    ),
    one<{
      cycle: number
      receipts: number
      disbursements: number
      cash_on_hand_end: number
      individual_contributions: number
      coverage_end: string | null
    }>(
      `select cycle, receipts, disbursements, cash_on_hand_end, individual_contributions, coverage_end
       from "FecTotals" where people_id = $1 order by cycle desc, receipts desc nulls last limit 1`,
      [peopleId]
    ),
  ])
  return {
    ...person,
    people_id: n(person.people_id),
    prime: n(counts?.prime),
    cosponsor: n(counts?.cosponsor),
    votes: votes
      ? { yea: n(votes.yea), nay: n(votes.nay), updated_at: votes.updated_at }
      : null,
    bills: bills.map((b) => ({ ...b, bill_id: n(b.bill_id) })),
    fec,
  }
}

export async function getTopSponsors(f: Resolved, limit = 8) {
  // `role` rides along so the widgets can title a member correctly outside
  // New York (Sen. / Asm. / Rep.) instead of assuming an Assembly.
  return q<{
    people_id: number
    name: string
    party: string
    role: string
    chamber: string
    district: string
    photo_url: string | null
    prime: number
  }>(
    `select p.people_id, p.name, p.party, p.role, p.chamber, p.district, p.photo_url, count(*)::int prime
     from "Sponsors" s join "Bills" b using (bill_id) join "People" p using (people_id)
     where b.state = $1 and b.session_id = $2 and s.sponsor_type_id = 1 ${f.chamber ? "and b.body = $4" : ""}
     group by 1, 2, 3, 4, 5, 6, 7 order by 8 desc limit $3`,
    f.chamber
      ? [f.state, f.session, limit, f.chamber]
      : [f.state, f.session, limit]
  ).then((rows) => rows.map((r) => ({ ...r, people_id: n(r.people_id) })))
}

// Precomputed career vote tallies (New York's current members).
export async function getTallies(state: string) {
  return q<{
    people_id: number
    name: string
    party: string
    chamber: string
    district: string
    photo_url: string | null
    yea: number
    nay: number
  }>(
    `select p.people_id, p.name, p.party, p.chamber, p.district, p.photo_url, t.yea_count::int as yea, t.no_count::int as nay
     from member_vote_tallies t join "People" p using (people_id)
     where p.state = $1 order by (t.yea_count + t.no_count) desc, p.last_name`,
    [state]
  ).then((rows) => rows.map((r) => ({ ...r, people_id: n(r.people_id) })))
}

export async function getPartySeats(state: string) {
  return q<{ chamber: string; party: string; seats: number }>(
    `select chamber, coalesce(nullif(party, ''), 'I') party, count(*)::int seats from "People"
     where state = $1 and not coalesce(archived, false) and role in ('Rep', 'Sen') group by 1, 2 order by 1, 3 desc`,
    [state]
  )
}

// A member's record in one session: the bills they put their name to, and the
// bills they voted for and against.
//
// `distinct on (bill_id)` is the point. A bill gets several roll calls — a
// committee vote, a floor vote, a re-passage — so joining Votes → Roll Call →
// Bills without it lists the same bill once per vote (the directory showed
// A08932 six times). One row per bill, carrying its most recent vote.
//
// Limited in SQL, not in the caller. A long-serving senator's full record is
// 4,273 bills and 2.2 MB of JSON; rendering that into one page produced a
// 2.9 MB response and a 500. The counts come from their own cheap aggregate,
// so the page can say "the latest 50 of 2,844" honestly.
export async function getMemberRecord(
  f: Resolved,
  peopleId: number,
  limit = 50
) {
  const scope = [peopleId, f.state, f.session]
  const recent = (inner: string) =>
    `select * from (${inner}) t
     order by t.last_action_date desc nulls last, t.bill_id desc
     limit ${Number(limit) || 50}`

  const [counts, sponsored, votes] = await Promise.all([
    one<{ sponsored: number; aye: number; nay: number }>(
      `select
         (select count(distinct s.bill_id) from "Sponsors" s join "Bills" b using (bill_id)
           where s.people_id = $1 and b.state = $2 and b.session_id = $3)::int as sponsored,
         (select count(distinct r.bill_id) from "Votes" v join "Roll Call" r using (roll_call_id)
           join "Bills" b on b.bill_id = r.bill_id
           where v.people_id = $1 and b.state = $2 and b.session_id = $3 and v.vote_desc = 'Yea')::int as aye,
         (select count(distinct r.bill_id) from "Votes" v join "Roll Call" r using (roll_call_id)
           join "Bills" b on b.bill_id = r.bill_id
           where v.people_id = $1 and b.state = $2 and b.session_id = $3 and v.vote_desc = 'Nay')::int as nay`,
      scope
    ),
    q<BillRow & { role: number }>(
      recent(`select distinct on (b.bill_id)
              b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date,
              b.committee, b.body, b.url, b.state_link, s.sponsor_type_id as role
       from "Sponsors" s join "Bills" b using (bill_id)
       where s.people_id = $1 and b.state = $2 and b.session_id = $3
       order by b.bill_id, s.sponsor_type_id`),
      scope
    ),
    q<BillRow & { vote_desc: string; vote_date: string }>(
      // Both directions in one pass, then split — the join is the expensive
      // part and doing it twice doubles it.
      `select * from (
         select distinct on (b.bill_id, v.vote_desc)
                b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date,
                b.committee, b.body, b.url, b.state_link,
                v.vote_desc, r.date as vote_date
         from "Votes" v
         join "Roll Call" r using (roll_call_id)
         join "Bills" b on b.bill_id = r.bill_id
         where v.people_id = $1 and b.state = $2 and b.session_id = $3
           and v.vote_desc in ('Yea', 'Nay')
         order by b.bill_id, v.vote_desc, r.date desc
       ) t order by t.last_action_date desc nulls last, t.bill_id desc`,
      scope
    ),
  ])

  const clean = <T extends { bill_id: number }>(rows: T[]) =>
    rows.map((row) => ({ ...row, bill_id: n(row.bill_id) }))
  const aye = clean(votes.filter((v) => v.vote_desc === "Yea")).slice(0, limit)
  const nay = clean(votes.filter((v) => v.vote_desc === "Nay")).slice(0, limit)

  return {
    sponsored: clean(sponsored),
    aye,
    nay,
    counts: {
      sponsored: n(counts?.sponsored),
      aye: n(counts?.aye),
      nay: n(counts?.nay),
    },
    limit,
  }
}

// ---------------------------------------------------------------------------
// Committees

export async function getCommittees(f: Resolved) {
  const counts = await q<{ committee: string; bills: number; chamber: string }>(
    `select committee, count(*)::int bills, min(body) chamber from "Bills"
     where state = $1 and session_id = $2 and coalesce(committee, '') <> '' group by 1 order by 1`,
    [f.state, f.session]
  )
  if (f.state !== "NY") {
    return counts.map((c) => ({
      committee_name: c.committee,
      chamber: c.chamber,
      bills: c.bills,
    }))
  }
  const rows = await q<{
    committee_id: number
    committee_name: string
    slug: string
    chamber: string
    chair_name: string | null
    member_count: string | null
    meeting_schedule: string | null
    committee_url: string | null
    description: string | null
  }>(
    `select committee_id, committee_name, slug, chamber, chair_name, member_count, meeting_schedule, committee_url, description
     from "Committees" order by chamber, committee_name`
  )
  const byName = new Map(counts.map((c) => [c.committee, c.bills]))
  return rows.map((r) => ({
    ...r,
    committee_id: n(r.committee_id),
    bills: byName.get(r.committee_name) ?? 0,
  }))
}

export async function getCommittee(f: Resolved, name: string) {
  const [meta, statuses, bills, hearings] = await Promise.all([
    f.state === "NY"
      ? one<Record<string, unknown>>(
          `select committee_id, committee_name, slug, chamber, description, meeting_schedule, chair_name, chair_email,
                  member_count, committee_members, committee_url, committee_type, address
           from "Committees" where committee_name = $1 limit 1`,
          [name]
        )
      : Promise.resolve(null),
    q<{ status: string; bills: number }>(
      `select coalesce(nullif(status_desc, ''), 'Unknown') status, count(*)::int bills from "Bills"
       where state = $1 and session_id = $2 and committee = $3 group by 1 order by 2 desc`,
      [f.state, f.session, name]
    ),
    q<BillRow>(
      `select ${BILL_COLUMNS} from "Bills" b ${PRIME_SPONSOR}
       where b.state = $1 and b.session_id = $2 and b.committee = $3
       order by b.last_action_date desc nulls last, b.bill_id desc limit 25`,
      [f.state, f.session, name]
    ),
    q<{
      date: string
      time: string
      description: string
      bill_id: number
      bill_number: string
      title: string
    }>(
      `select c.date, c.time, c.description, b.bill_id, b.bill_number, b.title
       from "Calendar" c join "Bills" b using (bill_id)
       where b.state = $1 and c.description ilike $2 and c.date <= ${DATE_CAP}
       order by c.date desc, c.time limit 60`,
      [f.state, `%${name} Committee%`]
    ),
  ])
  return {
    meta,
    statuses,
    bills: bills.map((b) => ({ ...b, bill_id: n(b.bill_id) })),
    hearings: hearings.map((h) => ({ ...h, bill_id: n(h.bill_id) })),
  }
}

// The text versions we hold, newest fetch first — the Documents tree and its
// "Changes" list. A bill collects versions as it moves (Original, Amended A,
// Amended B, Enrolled), which is exactly what a file tree with a changes
// panel is for.
export async function getRecentTexts(f: Resolved, limit = 60) {
  const rows = await q<{
    document_id: number
    version: string | null
    chars: number
    fetched_at: string | null
    bill_id: number
    bill_number: string
    title: string
    body: string | null
    status_desc: string | null
    last_action_date: string | null
  }>(
    `select t.document_id, t.version, t.chars, t.fetched_at,
            b.bill_id, b.bill_number, b.title, b.body, b.status_desc, b.last_action_date
     from "BillTexts" t join "Bills" b using (bill_id)
     where b.state = $1 and b.session_id = $2 and t.text is not null
     order by t.fetched_at desc nulls last, t.document_id desc
     limit $3`,
    [f.state, f.session, limit]
  )
  return rows.map((row) => ({
    ...row,
    document_id: n(row.document_id),
    bill_id: n(row.bill_id),
    chars: n(row.chars),
  }))
}

// ---------------------------------------------------------------------------
// Hearings (the committee calendars)

const HEARING_RE =
  /^(Senate|Assembly|House|Joint)\s+(.+?)\s+Committee(?:\s+Hearing)?$/i

export function parseHearing(description: string) {
  const match = description?.match(HEARING_RE)
  if (!match)
    return { chamber: null as string | null, committee: description ?? "" }
  return { chamber: match[1], committee: match[2] }
}

// Hearings are scoped to a session so the planner hashes the (small) bill set
// instead of probing Bills for every calendar row in the date window.
export async function getHearings(
  state: string,
  session: number,
  from: string,
  to: string,
  committee?: string,
  limit = 3000
) {
  const params: unknown[] = [from, to, state, session]
  const filter = committee
    ? `and c.description ilike $${params.push(`%${committee} Committee%`)}`
    : ""
  const rows = await q<{
    date: string
    time: string
    type: string
    description: string
    location: string
    bill_id: number
    bill_number: string
    title: string
    committee: string | null
    body: string | null
    status_desc: string | null
  }>(
    `select c.date, c.time, c.type, c.description, c.location, b.bill_id, b.bill_number, b.title, b.committee, b.body, b.status_desc
     from "Calendar" c join "Bills" b using (bill_id)
     where c.date >= $1 and c.date <= $2 and b.state = $3 and b.session_id = $4 ${filter}
     order by c.date, c.time, c.description, b.bill_number limit $${params.push(limit)}`,
    params
  )
  return rows.map((r) => ({
    ...r,
    bill_id: n(r.bill_id),
    ...parseHearing(r.description),
  }))
}

export async function getHearingDays(
  state: string,
  session: number,
  from: string,
  to: string
) {
  return q<{ date: string; hearings: number; committees: number }>(
    `select c.date, count(*)::int as hearings, count(distinct c.description)::int as committees
     from "Calendar" c join "Bills" b using (bill_id)
     where c.date >= $1 and c.date <= $2 and b.state = $3 and b.session_id = $4 group by 1 order by 1`,
    [from, to, state, session]
  )
}

// The default window is [today-30, today+60], and between sessions every
// jurisdiction is honestly empty in it — on 2026-09-01 Texas returns nothing
// there and 3,000 rows over 2025-2026. For the surfaces that mean "what the
// committees have been doing" rather than "this month", fall back to the 60 days
// before the jurisdiction's last hearing and say which date that runs through,
// so it reads as most recent rather than as upcoming. /calendar keeps its own
// URL date: an empty September is the truth for September.
export async function getRecentHearings(
  state: string,
  session: number,
  from: string,
  to: string,
  limit = 200
) {
  const rows = await getHearings(state, session, from, to, undefined, limit)
  if (rows.length) return { rows, through: null as string | null }

  const latest = await latestHearingDate(state, session)
  if (!latest) return { rows: [], through: null as string | null }
  const start = new Date(`${latest}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 60)
  return {
    rows: await getHearings(state, session, start.toISOString().slice(0, 10), latest, undefined, limit),
    through: latest,
  }
}

export async function latestHearingDate(state: string, session: number) {
  const row = await one<{ date: string }>(
    `select max(c.date) as date from "Calendar" c join "Bills" b using (bill_id)
     where b.state = $1 and b.session_id = $2 and c.date <= to_char(now(), 'YYYY-MM-DD')`,
    [state, session]
  )
  return row?.date ?? null
}

// The roll calls of a session, newest first — the Votes board, and anything
// else that wants the votes themselves rather than a count of them.
export async function getRollCalls(f: Resolved, limit = 120) {
  const rows = await q<{
    roll_call_id: number
    date: string
    chamber: string
    description: string
    yea: number
    nay: number
    total: number
    bill_id: number
    bill_number: string
    title: string
  }>(
    `select r.roll_call_id, r.date, r.chamber, r.description,
            r.yea::int as yea, coalesce(nullif(r.nay, '')::int, 0) as nay,
            r.total::int as total, b.bill_id, b.bill_number, b.title
     from "Roll Call" r join "Bills" b using (bill_id)
     where b.state = $1 and b.session_id = $2 and r.date <= ${DATE_CAP}
     order by r.date desc, r.roll_call_id desc limit $3`,
    [f.state, f.session, limit]
  )
  return rows.map((row) => ({
    ...row,
    roll_call_id: n(row.roll_call_id),
    bill_id: n(row.bill_id),
  }))
}

// The News Room: one round trip for the whole front page.
//
// Sera's placeholder concepts map onto what a legislature actually produces —
// a lead story, sections, a sidebar of other desks. Here the lead is the most
// recent bill to become law (or to be vetoed), the sections are what moved
// this week, and the sidebar is the other jurisdictions.
export async function getNewsroom(f: Resolved, days = 14) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
  const params: unknown[] = []
  const where = billWhere(f, params)
  // Filter first, order second, and never join back to "Bills" for the ordering.
  //
  // Left to itself the planner walks bills_last_action_idx backwards and stops at
  // the limit — right where matches are dense, catastrophic where they are not.
  // Congress's 2025 session holds two enacted bills, so it scanned the whole
  // index looking for six: 2.9 s, against 3 ms for New York. Two rewrites that
  // did *not* fix it, because both let the ordered index scan back in: putting
  // order by/limit inside the CTE, and materialising only bill_id and joining
  // "Bills" again (the planner then sorted 886k rows and looped against a CTE it
  // estimated at 1036 rows when it holds 2). Carrying the columns through the CTE
  // and ordering the matched set alone is what works.
  //
  // Measured: US 2.9 s -> 28 ms, NY 400 ms, TX 69 ms, CA 117 ms — bounded by the
  // match count rather than open-ended.
  const withSince = (extra: string) =>
    `with matched as materialized (
       select b.bill_id, b.bill_number, b.title, b.description, b.status_desc, b.last_action,
              b.last_action_date, b.committee, b.body, b.url, b.state_link, b.text_chars
       from "Bills" b
       where ${where} and coalesce(b.last_action_date, '') <> '' ${extra}
     )
     select m.*, sp.name sponsor, sp.party sponsor_party, sp.people_id sponsor_id
     from matched m
     left join lateral (
       select p.name, p.party, p.people_id from "Sponsors" s join "People" p using (people_id)
       where s.bill_id = m.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) sp on true
     order by m.last_action_date desc, m.bill_id desc limit $${params.length + 1}`

  const [enacted, passed, committee, introduced, rollCalls, hearings] =
    await Promise.all([
      // Signed, vetoed or delivered — the things that finish.
      q<BillRow>(
        withSince(`and b.status_desc ~* '(signed|veto|chaptered|enacted)'`),
        [...params, 6]
      ),
      q<BillRow>(
        withSince(
          `and b.status_desc ~* '(passed|delivered|adopted)' and b.last_action_date >= '${since}'`
        ),
        [...params, 8]
      ),
      q<BillRow>(
        withSince(
          `and coalesce(b.committee, '') <> '' and b.last_action_date >= '${since}'`
        ),
        [...params, 8]
      ),
      q<BillRow>(
        withSince(
          `and b.status_desc ~* 'introduc' and b.last_action_date >= '${since}'`
        ),
        [...params, 8]
      ),
      q<{
        roll_call_id: number
        date: string
        chamber: string
        description: string
        yea: number
        nay: number
        bill_id: number
        bill_number: string
        title: string
      }>(
        `select r.roll_call_id, r.date, r.chamber, r.description,
                r.yea::int as yea, coalesce(nullif(r.nay, '')::int, 0) as nay,
                b.bill_id, b.bill_number, b.title
         from "Roll Call" r join "Bills" b using (bill_id)
         where b.state = $1 and b.session_id = $2 and r.date <= ${DATE_CAP}
         order by r.date desc, r.roll_call_id desc limit 6`,
        [f.state, f.session]
      ),
      getHearings(
        f.state,
        f.session,
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10),
        undefined,
        200
      ),
    ])

  const clean = (rows: BillRow[]) =>
    rows.map((row) => ({ ...row, bill_id: n(row.bill_id) }))

  return {
    lead: clean(enacted)[0] ?? clean(passed)[0] ?? null,
    enacted: clean(enacted),
    passed: clean(passed),
    committee: clean(committee),
    introduced: clean(introduced),
    rollCalls: rollCalls.map((r) => ({
      ...r,
      bill_id: n(r.bill_id),
      roll_call_id: n(r.roll_call_id),
    })),
    hearings: hearings.slice(0, 6),
    since,
  }
}

// ---------------------------------------------------------------------------
// Aggregates for the charts and stat cards

export async function getActivity(f: Resolved) {
  const params: unknown[] = []
  const where = billWhere(f, params)
  const [monthly, daily, rollCalls, statuses, committees] = await Promise.all([
    q<{ ym: string; bills: number; senate: number; assembly: number }>(
      `select substr(b.last_action_date, 1, 7) ym, count(*)::int bills,
              count(*) filter (where b.body = 'Senate')::int senate,
              count(*) filter (where b.body <> 'Senate')::int assembly
       from "Bills" b where ${where} and coalesce(b.last_action_date, '') <> '' group by 1 order by 1`,
      params
    ),
    q<{ date: string; bills: number }>(
      `select b.last_action_date as date, count(*)::int as bills
       from "Bills" b where ${where} and b.last_action_date >= to_char(now() - interval '21 days', 'YYYY-MM-DD')
       group by 1 order by 1`,
      params
    ),
    q<{ ym: string; roll_calls: number; yea: number; nay: number }>(
      `select substr(r.date, 1, 7) ym, count(*)::int roll_calls, sum(r.yea)::int yea, sum(nullif(r.nay, '')::int)::int nay
       from "Roll Call" r where r.state = $1 and r.date >= $2 and r.date <= ${DATE_CAP} group by 1 order by 1`,
      [f.state, `${f.session}-01-01`]
    ),
    q<{ status: string; bills: number }>(
      `select coalesce(nullif(b.status_desc, ''), 'Unknown') status, count(*)::int bills
       from "Bills" b where ${where} group by 1 order by 2 desc`,
      params
    ),
    q<{ committee: string; bills: number }>(
      `select b.committee, count(*)::int bills from "Bills" b where ${where} and coalesce(b.committee, '') <> ''
       group by 1 order by 2 desc limit 10`,
      params
    ),
  ])
  const total = statuses.reduce((sum, s) => sum + s.bills, 0)
  return { monthly, daily, rollCalls, statuses, committees, total }
}

// The bills that landed most recently, per jurisdiction — the stream.
export async function getStream(states: string[], limit = 12) {
  const groups = await Promise.all(
    states.map(async (state) => {
      const session = await latestSession(state)
      const rows = await q<BillRow>(
        `select ${BILL_COLUMNS} from "Bills" b ${PRIME_SPONSOR}
         where b.state = $1 and b.session_id = $2 and coalesce(b.last_action_date, '') <> '' and b.title <> ''
         order by b.last_action_date desc, b.bill_id desc limit $3`,
        [state, session, limit]
      )
      return {
        state,
        session,
        bills: rows.map((r) => ({ ...r, bill_id: n(r.bill_id) })),
      }
    })
  )
  return groups
}

// ---------------------------------------------------------------------------
// Money: member items, contracts, capital appropriations, school aid, FEC,
// federal lobbying. New York holds the first four; FEC and LDA are federal.
//
// The first four are New York's own tables — scraped from the state budget,
// with no state column to filter on. `NY_ONLY` names them so a caller under
// another jurisdiction gets nothing rather than New York's rows under that
// state's name; the API route turns that into an empty payload with the
// scope on it.
export const NY_ONLY = [
  // member_vote_tallies exists for New York alone. Audited 2026-09-01 against
  // every resource this route serves: seats, activity, sponsors, committees and
  // the rest all scope through "Bills" and were verified to return different
  // rows per jurisdiction. This is the only one that does not.
  "tallies",
  "discretionary",
  "contracts",
  "capital",
  "counties",
  "school-funding",
] as const

const MONEY = (col: string) =>
  `nullif(regexp_replace(${col}, '[^0-9.]', '', 'g'), '')::numeric`

export async function getDiscretionary() {
  const years = await q<{ year: number; grants: number; total: number }>(
    `select year::int as year, count(*)::int as grants, coalesce(sum(${MONEY('"Grant Amount"')}), 0)::float as total
     from "Discretionary" group by 1 order by 1 desc`
  )
  const latest = years[0]?.year
  const grants = latest
    ? await q<{
        grantee: string
        sponsor: string
        amount: number
        description: string
        approved: string
      }>(
        `select "Grantee" grantee, "Sponsor" sponsor, ${MONEY('"Grant Amount"')}::float amount,
                "Description of Grant" description, "Approval Date" approved
         from "Discretionary" where year = $1 order by 3 desc nulls last limit 8`,
        [latest]
      )
    : []
  return { years, latest, grants }
}

export async function getContracts(limit = 8) {
  return q<{
    vendor: string
    department: string
    amount: number
    start: string
    end: string
    description: string
  }>(
    `select vendor_name vendor, department_facility department, current_contract_amount::float amount,
            contract_start_date start, contract_end_date "end", contract_description description
     from "Contracts" where current_contract_amount is not null order by current_contract_amount desc limit $1`,
    [limit]
  )
}

export async function getCapital(limit = 8) {
  return q<{
    agency: string
    program: string
    amount: number
    reappropriation: number
    encumbrance: number
    description: string
    fund: string
  }>(
    `select "Agency Name" agency, "Program Name" program,
            coalesce(${MONEY('"Appropriations Recommended 2026-27"')}, 0)::float amount,
            coalesce(${MONEY('"Reappropriations Recommended 2026-27"')}, 0)::float reappropriation,
            coalesce(${MONEY('"Encumbrance as of 1/16/2026"')}, 0)::float encumbrance,
            "Description" description, "Fund Name" fund
     from budget_2027_capital_aprops
     where coalesce(${MONEY('"Appropriations Recommended 2026-27"')}, 0) > 0
     order by 3 desc limit $1`,
    [limit]
  )
}

export async function getCounties() {
  return q<{ county: string; districts: number }>(
    `select "County" county, count(*)::int districts from school_funding where coalesce("County", '') <> '' group by 1 order by 1`
  )
}

export async function getSchoolFunding(county: string) {
  return q<{ district: string; categories: unknown }>(
    `select "District" district, categories from school_funding where "County" = $1 order by 1`,
    [county]
  )
}

export async function getLobbying(billId: number) {
  const [summary, filings] = await Promise.all([
    one<{ filings: number; clients: number; registrants: number }>(
      `select count(distinct lb.filing_uuid)::int filings, count(distinct f.client_name)::int clients, count(distinct f.registrant_name)::int registrants
       from "LobbyingBills" lb join "LobbyingFilings" f using (filing_uuid) where lb.bill_id = $1`,
      [billId]
    ),
    q<{
      client: string
      registrant: string
      income: number | null
      expenses: number | null
      year: number
      period: string
      url: string
    }>(
      `select f.client_name as client, f.registrant_name as registrant, f.income::float as income, f.expenses::float as expenses,
              f.filing_year as year, f.filing_period as period, f.url
       from "LobbyingBills" lb join "LobbyingFilings" f using (filing_uuid)
       where lb.bill_id = $1 order by coalesce(f.income, f.expenses) desc nulls last limit 10`,
      [billId]
    ),
  ])
  return { ...summary, filings: filings, count: n(summary?.filings) }
}

export async function getFec(peopleId: number) {
  const [totals, contributions] = await Promise.all([
    q<{
      cycle: number
      receipts: number
      disbursements: number
      cash_on_hand_end: number
      individual_contributions: number
    }>(
      `select cycle, receipts::float receipts, disbursements::float disbursements, cash_on_hand_end::float cash_on_hand_end,
              individual_contributions::float individual_contributions
       from "FecTotals" where people_id = $1 order by cycle desc limit 6`,
      [peopleId]
    ),
    q<{
      contributor: string
      employer: string | null
      amount: number
      date: string
      city: string | null
      state: string | null
    }>(
      `select contributor_name contributor, contributor_employer employer, amount::float amount, date::text date,
              contributor_city city, contributor_state state
       from "FecContributions" where people_id = $1 order by amount desc nulls last limit 8`,
      [peopleId]
    ),
  ])
  return { totals, contributions }
}

/* ---------------------------------------------------------------------------
 * congress.gov — the families LegiScan and govinfo never carried.
 *
 * Written by scripts/pipeline/congress/harvest.mjs in the livingston repo: the
 * API's own key as the primary key, typed columns for what a page reads, and the
 * record verbatim in `payload`. These readers hand back the API's own shape —
 * field names unchanged — so a page built against a fixture pulled straight from
 * api.congress.gov keeps working when it is pointed here.
 *
 * Congress-only by construction: the tables hold the 119th and nothing else.
 * `US_ONLY` names them so another jurisdiction is told what it asked for rather
 * than handed Congress's rows, exactly as NY_ONLY does for New York's.
 * ------------------------------------------------------------------------- */

export const US_ONLY = [
  "amendments", "summaries", "committee-reports", "laws", "member-detail",
  "committee-detail", "committee-meetings", "hearings", "nominations",
  "crs-reports", "record-issues", "house-votes", "treaties",
  "summaries", "titles", "related-bills", "cosponsors", "member-votes", "communications",
  // Federal money. "LobbyingBills" joins 560,789 rows and every one of them to a
  // US bill; "FecTotals" holds 5,517 rows across 726 members, all US. Measured
  // 2026-09-01 before either was exposed on the route.
  "lobbying", "fec",
] as const;

/** The payload as the API returned it, newest first, for a whole family. */
async function congressFamily(table: string, limit: number, offset: number, where = "", params: unknown[] = []) {
  const rows = await q<{ payload: unknown }>(
    `select payload from ${table} ${where} order by update_date desc nulls last, key limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset],
  );
  return rows.map((r) => r.payload);
}

async function congressCount(table: string, where = "", params: unknown[] = []) {
  const row = await one<{ n: number }>(`select count(*)::int as n from ${table} ${where}`, params);
  return n(row?.n);
}

/**
 * The scoped answer echoes what it was scoped to.
 *
 * These resources took `bill=` and ignored it, so a bill page asking for HR 1's
 * amendments got all 7,035 and the fetch "succeeded" with the wrong rows — the
 * quietest kind of wrong. A caller can now tell a scoped answer from a family
 * list by looking at the envelope, and a scope we cannot honour is an error
 * rather than everything.
 */
export async function getAmendments(limit = 50, offset = 0, billId?: number) {
  if (billId) {
    const rows = await q<{ payload: unknown }>(
      `select payload from congress_amendments where amended_bill_id = $1
        order by update_date desc nulls last, key limit $2 offset $3`, [billId, limit, offset]);
    const total = await one<{ n: number }>(`select count(*)::int as n from congress_amendments where amended_bill_id = $1`, [billId]);
    return { bill: billId, count: n(total?.n), amendments: rows.map((r) => r.payload) };
  }
  return { count: await congressCount("congress_amendments"), amendments: await congressFamily("congress_amendments", limit, offset) };
}

export async function getCommitteeReports(limit = 50, offset = 0, billId?: number) {
  if (billId) {
    const rows = await q<{ payload: unknown }>(
      `select payload from congress_committee_reports where bill_id = $1
        order by update_date desc nulls last, key limit $2 offset $3`, [billId, limit, offset]);
    const total = await one<{ n: number }>(`select count(*)::int as n from congress_committee_reports where bill_id = $1`, [billId]);
    return { bill: billId, count: n(total?.n), reports: rows.map((r) => r.payload) };
  }
  return { count: await congressCount("congress_committee_reports"), reports: await congressFamily("congress_committee_reports", limit, offset) };
}

// congress.gov's bill type <- our bill_number prefix, the same table the sync
// and api/bill-text.ts carry, so the three agree on what a bill is called.
const CONGRESS_TYPE_BY_PREFIX: Record<string, string> = { HB: "HR", SB: "S", HJR: "HJRES", SJR: "SJRES", HCR: "HCONRES", SCR: "SCONRES", HR: "HRES", SR: "SRES" };

/** A law IS a bill, so this one can be scoped without any new linkage. */
export async function getLaws(limit = 250, offset = 0, billId?: number) {
  if (billId) {
    const bill = await one<{ bill_number: string; session_id: number }>(
      `select bill_number, session_id from "Bills" where bill_id = $1 and state = 'US'`, [billId]);
    if (!bill) return { bill: billId, count: 0, bills: [] };
    const prefix = String(bill.bill_number).replace(/[0-9].*$/, "").toUpperCase();
    const key = `${Math.floor((n(bill.session_id) - 1789) / 2) + 1}-${CONGRESS_TYPE_BY_PREFIX[prefix] ?? prefix}-${String(bill.bill_number).replace(/^[A-Z]+/, "")}`;
    const rows = await q<{ payload: unknown }>(`select payload from congress_laws where key = $1`, [key]);
    return { bill: billId, count: rows.length, bills: rows.map((r) => r.payload) };
  }
  return { count: await congressCount("congress_laws"), bills: await congressFamily("congress_laws", limit, offset) };
}

export async function getNominations(limit = 50, offset = 0) {
  return { count: await congressCount("congress_nominations"), nominations: await congressFamily("congress_nominations", limit, offset) };
}

export async function getCommitteeMeetings(limit = 50, offset = 0) {
  return { count: await congressCount("congress_committee_meetings"), committeeMeetings: await congressFamily("congress_committee_meetings", limit, offset) };
}

export async function getCongressHearings(limit = 50, offset = 0) {
  return { count: await congressCount("congress_hearings"), hearings: await congressFamily("congress_hearings", limit, offset) };
}

export async function getTreaties(limit = 50, offset = 0) {
  return { count: await congressCount("congress_treaties"), treaties: await congressFamily("congress_treaties", limit, offset) };
}

/** One member, by bioguide id — the record that carries the official portrait. */
/** Our people_id -> the bioguide the congress.gov tables are keyed on. */
export async function bioguideOf(peopleId: number) {
  const row = await one<{ bioguide_id: string | null }>(`select bioguide_id from "People" where people_id = $1`, [peopleId]);
  return row?.bioguide_id ?? null;
}

export async function getMemberDetail(bioguideId: string) {
  const row = await one<{ payload: unknown; portrait_url: string | null }>(
    `select payload, portrait_url from congress_members where key = $1`, [String(bioguideId).toUpperCase()],
  );
  return row ? { member: row.payload, portraitUrl: row.portrait_url } : null;
}

/** Every sitting member with a portrait, for a roster that wants faces. */
export async function getMembersWithPortraits(limit = 600) {
  return q<{ bioguide_id: string; name: string; party: string; state: string; district: string | null; portrait_url: string | null }>(
    `select bioguide_id, name, party, state, district, portrait_url
       from congress_members where portrait_url is not null order by name limit $1`, [limit],
  );
}

/** One committee, by systemCode. */
export async function getCommitteeDetail(systemCode: string) {
  const row = await one<{ payload: unknown }>(`select payload from congress_committees where key = $1`, [String(systemCode).toLowerCase()]);
  return row?.payload ?? null;
}

/**
 * A bill's text versions as the site holds them — the resource that answers the
 * question this lane started from. Reads "BillTexts" and "Documents" rather than
 * a congress_ table: the versions are already there, and which source won for a
 * given version is part of the answer.
 */
export async function getTextVersions(billId: number) {
  // `date` is the stage's own date — when the bill was introduced, reported,
  // engrossed — not when we fetched it. A version list without it cannot be read
  // as a timeline, which is the only reason to show one.
  return q<{ document_id: number; version: string; source: string; chars: number; date: string | null; fetched_at: string | null; url: string | null }>(
    `select t.document_id, t.version, t.source, t.chars,
            coalesce(d.date, to_char(t.fetched_at, 'YYYY-MM-DD')) as date,
            t.fetched_at, d.url
       from "BillTexts" t
       left join "Documents" d on d.document_id = t.document_id and d.document_type = 'text'
      where t.bill_id = $1
        -- govinfo-billsum rows are CRS summaries, not text versions; they belong
        -- to the summaries family and were showing up here as an undated stage.
        and t.source <> 'govinfo-billsum'
      order by coalesce(d.date, to_char(t.fetched_at, 'YYYY-MM-DD')) desc nulls last, t.document_id desc`,
    [billId],
  );
}

/* ---- BILLSTATUS families (summaries, titles, related bills) --------------- */

/** Every CRS summary the bill has carried, oldest first — the sequence is the point. */
export async function getSummaries(billId: number) {
  const rows = await q<{ payload: unknown }>(
    `select payload from congress_summaries where bill_id = $1 order by action_date, version_code`, [billId]);
  return { bill: billId, count: rows.length, summaries: rows.map((r) => r.payload) };
}

export async function getTitles(billId: number) {
  const rows = await q<{ payload: unknown }>(
    `select payload from congress_titles where bill_id = $1 order by key`, [billId]);
  return { bill: billId, count: rows.length, titles: rows.map((r) => r.payload) };
}

/**
 * Related bills, both ways round.
 *
 * BILLSTATUS records a relationship on one bill only: HR 1 lists 29 and is
 * listed by 39 others, and congress.gov's own answer (38) sits in between. The
 * complete graph is already here, recorded from each bill's own side, so reading
 * it in one direction under-reports by a third at no saving.
 */
export async function getRelatedBills(billId: number) {
  const rows = await q<{ payload: unknown; related_bill_number: string; relationship: string; direction: string }>(
    `select payload, related_bill_number, relationship, 'names' as direction
       from congress_related_bills where bill_id = $1
     union all
     select payload, bill_number as related_bill_number, relationship, 'named-by' as direction
       from congress_related_bills where related_bill_id = $1
        and bill_number not in (select related_bill_number from congress_related_bills where bill_id = $1)
     order by related_bill_number`,
    [billId],
  );
  return { bill: billId, count: rows.length, relatedBills: rows };
}

/* ---- votes, cosponsors, and the reference families ----------------------- */

/**
 * Cosponsors, from the BILLSTATUS zips rather than one request per bill.
 * `payload` is the record as govinfo published it, so the field names are the
 * API's own — bioguideId, fullName, sponsorshipDate, isOriginalCosponsor — and
 * `people_id` is added beside it so a page can link without a second lookup.
 */
export async function getCosponsors(billId: number) {
  const rows = await q<{ payload: Record<string, unknown>; people_id: number | null }>(
    `select payload, people_id from congress_cosponsors where bill_id = $1
      order by sponsorship_date nulls last, full_name`, [billId]);
  return { bill: billId, count: rows.length, cosponsors: rows.map((r) => ({ ...r.payload, people_id: r.people_id })) };
}

/** House roll calls. With `bill=`, only the ones on that bill's legislation. */
export async function getHouseVotes(limit = 50, offset = 0, billId?: number) {
  if (billId) {
    const bill = await one<{ bill_number: string }>(`select bill_number from "Bills" where bill_id = $1 and state = 'US'`, [billId]);
    if (!bill) return { bill: billId, count: 0, houseRollCallVotes: [] };
    const prefix = String(bill.bill_number).replace(/[0-9].*$/, "").toUpperCase();
    const number = String(bill.bill_number).replace(/^[A-Z]+/, "");
    const rows = await q<{ payload: unknown }>(
      `select payload from congress_house_votes
        where legislation_type = $1 and legislation_number = $2 order by start_date desc`,
      [CONGRESS_TYPE_BY_PREFIX[prefix] ?? prefix, number]);
    return { bill: billId, count: rows.length, houseRollCallVotes: rows.map((r) => r.payload) };
  }
  return { count: await congressCount("congress_house_votes"), houseRollCallVotes: await congressFamily("congress_house_votes", limit, offset) };
}

/**
 * Per-member positions. By `vote=`, the roll call's own members; by `member=`,
 * one member's record across every roll call — which is the question a member
 * page asks and `"Roll Call"` has never been able to answer, because LegiScan
 * records the tally and not who was in it.
 */
export async function getMemberVotes({ vote, member, limit = 500 }: { vote?: string; member?: number; limit?: number }) {
  if (vote) {
    const rows = await q(
      `select bioguide_id, people_id, vote_cast, vote_party, vote_state, first_name, last_name
         from congress_house_vote_positions where vote_identifier = $1 order by last_name, first_name`, [vote]);
    return { vote, count: rows.length, memberVotes: rows };
  }
  if (member) {
    const rows = await q(
      `select p.vote_identifier, p.vote_cast, v.roll_call_number, v.legislation_type, v.legislation_number,
              v.result, v.start_date
         from congress_house_vote_positions p
         join congress_house_votes v on v.key = p.vote_identifier
        where p.people_id = $1 order by v.start_date desc limit $2`, [member, limit]);
    return { member, count: rows.length, memberVotes: rows };
  }
  return { count: 0, memberVotes: [] };
}

export async function getCrsReports(limit = 50, offset = 0) {
  return { count: await congressCount("congress_crs_reports"), CRSReports: await congressFamily("congress_crs_reports", limit, offset) };
}

export async function getRecordIssues(limit = 50, offset = 0) {
  return { count: await congressCount("congress_record_daily"), dailyCongressionalRecord: await congressFamily("congress_record_daily", limit, offset) };
}

export async function getCommunications(limit = 50, offset = 0, chamber?: string) {
  const where = chamber ? `where chamber = $1` : "";
  const params = chamber ? [chamber] : [];
  return {
    count: await congressCount("congress_communications", where, params),
    communications: await congressFamily("congress_communications", limit, offset, where, params),
  };
}


// ---------------------------------------------------------------------------
// Search: bills, members, committees and bill text, across every jurisdiction,
// for the header menu and /search.
//
// Two tiers everywhere: the jurisdiction the reader is in sorts first and gets
// the most rows, then every other jurisdiction's *current* session with a cap
// per jurisdiction so Congress cannot drown Wyoming. Bill numbers match on a
// prefix with the spaces squeezed out, so "hb 10" and "HB10" both reach HB10160.
//
// Three things learned the hard way on this data, all load-bearing:
//
//  1. A LATERAL per jurisdiction is the obvious shape and the wrong one: it
//     rebuilds the same global trgm bitmap 52 times (969 ms for "climate",
//     1396 ms for "health"). One trgm pass plus row_number() over (partition by
//     state) is the same answer in 18 ms / 232 ms. Metadata therefore scans
//     once and windows; only the text search, whose index *can* cut per
//     jurisdiction, iterates.
//  2. `default_text_search_config` on this cluster is `simple`, but
//     "BillTexts".search_tsv is generated with 'english'. Every tsquery here
//     names 'english' explicitly — drop it and the query parses as `simple`,
//     matches none of the stemmed lexemes in the index, and returns zero rows
//     with no error at all.
//  3. The text search cuts by (state, session_id) *inside* billtexts_scope_search_idx
//     — gin (state, session_id, search_tsv) over btree_gin. Without those two
//     keys in the index, "health" matches 979,526 rows and fetching them off
//     the 36 GB heap takes three minutes.

// The newest session that actually has bills, per jurisdiction — the view the
// matviews already define (sql/001_policy_matviews.sql). Cross-jurisdiction
// rows come from these sessions, never from the archive.
const CURRENT = `(select state, session::int as session_id from v_policy_latest_session)`

// The oldest of those, as one InitPlan the bitmap scans can use as a lower
// bound before the join prunes the rest. Without it "health" drags all 101,801
// matching titles out of every session ever recorded.
const SINCE = `(select min(session)::int from v_policy_latest_session)`

// New York's Assembly texts arrive as a scrape of the whole page ahead of an
// "<bill> Text:" marker (lib/policy/texts.ts, cleanBillText). A snippet cut
// from that preamble quotes the site's navigation instead of the bill, so the
// marker rule runs here too — over the first 20 k characters only, which is
// where a preamble can be, rather than over an 11 MB body.
const BODY = `substr(t.text, greatest(regexp_instr(left(t.text, 20000),
  '(?n)^[[:blank:]]*[A-Z][0-9]+[A-Z]? Text:[[:blank:]]*$', 1, 1, 1), 1))`

// "BillTextChunks" geometry. These three numbers are the contract between
// scripts/search/bill-text-chunks.sh, which writes the rows, and the text query
// below, which has to know where chunk N starts in order to cut a snippet from
// the right part of an 11 MB document. They were duplicated once and drifted
// once — the script moved to 80 k chunks from offset 1 and the query kept
// computing offsets for the 800 k ones, so every chunk hit was found and then
// silently dropped, because the headline was cut from the wrong place and
// contained no match. Change them here and in the script's FIRST/STRIDE/LEN
// together, or not at all.
const CHUNK_FIRST = 1
const CHUNK_STRIDE = 79_000
const CHUNK_LEN = 80_000

// Snippets, never bodies: the Data API caps a result at 1 MB, and ts_headline
// over a whole 11 MB bill would cost more than the search did. « » delimit the
// match — the surface splits on them, so nothing has to trust HTML from the
// database.
const HEADLINE_OPTS = "MaxFragments=1,MaxWords=34,MinWords=16,StartSel=«,StopSel=»,FragmentDelimiter= … "

// Both extras are opt-in, and for different reasons. `text` is a cost: the pass
// over "BillTexts" is the expensive one and the ⌘K menu must not pay it.
// `all` is a *contract*: the moment bills[] and committees[] can carry a
// jurisdiction that is not the reader's, every caller has to render each row's
// own `state`. /search does. components/command-menu.tsx still draws
// `FlagChip state={state}` from the page's scope and links to `?state=${state}`,
// so turning this on for the menu without changing those two lines would put a
// New York flag on an Arizona bill. It stays off until the menu opts in.
export type SearchOptions = { text?: boolean; all?: boolean; perState?: number }

export async function searchAll(f: Resolved, term: string, limit = 8, options: SearchOptions = {}) {
  const like = `%${term}%`
  const numberLike = `${term.replace(/\s+/g, "")}%`
  // Two rows a jurisdiction: enough that a reader sees the answer is national,
  // few enough that 51 other jurisdictions cannot bury the one they are in.
  const perState = options.all ? (options.perState ?? 2) : 0
  const elsewhereCap = options.all ? Math.max(limit * 2, 24) : 0
  // Four words is more than any name here needs and keeps the parameter list
  // bounded; a one-word query is the old behaviour exactly.
  const nameTokens = term.split(/\s+/).filter(Boolean).slice(0, 4).map((word) => `%${word}%`)

  const [bills, members, committees, texts] = await Promise.all([
    q<{
      bill_id: number
      bill_number: string
      title: string
      status_desc: string | null
      last_action_date: string | null
      state: string
      tier: number
    }>(
      `with scoped as (
         select b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action_date, b.state,
                0 as tier,
                row_number() over (order by (b.bill_number ilike $3) desc,
                                            b.last_action_date desc nulls last, b.bill_id desc)::int as rn
         from "Bills" b
         where b.state = $1 and b.session_id = $2
           and (b.bill_number ilike $3 or b.title ilike $4)
         order by rn
         limit $5
       ),
       -- "as materialized" is not decoration. Inlined, the planner joins the
       -- 52-row session view first and re-derives the trgm bitmap once per
       -- jurisdiction (loops=52, 969 ms). Materialised, the trgm scan runs
       -- once and the join prunes what it produced: 18 ms.
       hits as materialized (
         select b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action_date,
                b.state, b.session_id
         from "Bills" b
         where ${options.all ? `b.session_id >= ${SINCE} and b.state <> $1` : "false"}
           and (b.bill_number ilike $3 or b.title ilike $4)
       ),
       elsewhere as (
         select bill_id, bill_number, title, status_desc, last_action_date, state, 1 as tier, rn
         from (
           select h.bill_id, h.bill_number, h.title, h.status_desc, h.last_action_date, h.state,
                  row_number() over (partition by h.state
                    order by (h.bill_number ilike $3) desc,
                             h.last_action_date desc nulls last, h.bill_id desc)::int as rn
           from hits h join ${CURRENT} c on c.state = h.state and c.session_id = h.session_id
         ) ranked
         where ranked.rn <= $6
       )
       select bill_id, bill_number, title, status_desc, last_action_date, state, tier
       from (select * from scoped union all select * from elsewhere) hits
       order by tier, rn, state
       limit $7`,
      [f.state, f.session, numberLike, like, limit, perState, limit + elsewhereCap]
    ),
    q<{
      people_id: number
      name: string
      party: string
      role: string
      chamber: string
      district: string
      state: string
    }>(
      // Name *and* aliases, token by token. "holmes" has to find Eleanor Holmes
      // Norton, whose LegiScan name is "Eleanor Norton";
      // scripts/search/people-aliases.sql writes the other forms she might be
      // typed under into "People".aliases. But one contiguous %like% over that
      // column is not enough: Gil Cisneros's alias reads "Gilbert Ray Cisneros",
      // so a reader who types "Gilbert Cisneros" — dropping a middle name they
      // never knew he had — matched nothing. Each word of the query is required
      // separately instead, in either column, so word order and missing middle
      // names both stop mattering. Every clause can still use its trigram index.
      //
      // A row inserted since that script last ran has a null alias and is still
      // found by name, so drift degrades to the old behaviour, not to a hole.
      `select p.people_id, p.name, p.party, p.role, p.chamber, p.district, p.state,
              exists (select 1 from "SessionPeople" sp where sp.people_id = p.people_id) as active
       from "People" p
       where p.committee_id is null and not coalesce(p.archived, false)
         -- LegiScan files some committees as people. The committee_id filter
         -- catches most, but 487 of the 22,193 otherwise-searchable rows slip
         -- through — Florida's "Health and Human Services Committee", Oregon's
         -- "Committee On Human Services", and 266 whose names carry no such word
         -- at all: California's "Utilities and Energy", Kansas's "Agriculture",
         -- South Carolina's "Judiciary". Searching "health" across every
         -- jurisdiction put about twenty of them in the Members section.
         --
         -- A name in two parts is what separates them. 487 have no last_name at
         -- all, and exactly one of those carries a party or a district (Oregon's
         -- "Transportation Reinvestment", HD-061, not sitting) — also a
         -- committee. A further 24 have a surname but no given name, because
         -- LegiScan copied the committee's name into both fields: Maryland's
         -- "Health", "Ways", "Economic" and "Mental", New York's "Rules", South
         -- Dakota's "Appropriations". Not one of those 24 has a party, a
         -- district, a photo, an email, a bio, a VoteSmart id or a Ballotpedia
         -- entry, and not one is sitting; five read like surnames (Barnes,
         -- George, Nelson, Rice, Young) and are just as empty, one of them filed
         -- as both Rep and Sen.
         --
         -- So: both halves of a name required. 511 of 22,193 rows leave the
         -- member search and no sitting legislator does. Filtered here rather
         -- than upstream because this is the query that shows people; getMembers
         -- and the directory still list them, which is a data fix, not a search
         -- one.
         and coalesce(p.first_name, '') <> '' and coalesce(p.last_name, '') <> ''
         and p.role in ('Rep', 'Sen')
         and ${nameTokens.map((_, i) => `(p.name ilike $${i + 2} or p.aliases ilike $${i + 2})`).join(" and ") || "false"}
       order by (p.state = $1) desc, active desc, p.last_name, p.first_name
       limit $${nameTokens.length + 2}`,
      [f.state, ...nameTokens, limit + perState * 4]
    ),
    q<{ committee: string; bills: number; chamber: string; state: string; tier: number }>(
      // Committees are a group-by, so the two tiers are one pass with the
      // scope decided per row rather than a union.
      // Same `as materialized` rule as the bills query, and the same size of
      // difference: 1244 ms inlined, 38.8 ms materialised.
      `with hits as materialized (
         select b.state, b.session_id, b.committee, b.body
         from "Bills" b
         where ${options.all ? "" : "b.state = $1 and "}b.session_id >= ${SINCE}
           and coalesce(b.committee, '') <> '' and b.committee ilike $2
       )
       select committee, bills, chamber, state, tier from (
         select h.committee, count(*)::int as bills, min(h.body) as chamber, h.state,
                case when h.state = $1 then 0 else 1 end as tier,
                row_number() over (partition by h.state order by count(*) desc)::int as rn
         from hits h join ${CURRENT} c on c.state = h.state and c.session_id = h.session_id
         group by h.committee, h.state
       ) g
       where g.tier = 0 or g.rn <= $3
       order by tier, bills desc
       limit $4`,
      [f.state, like, perState, Math.min(limit, 6) + 12]
    ),
    options.text
      ? q<{
          bill_id: number
          document_id: number
          state: string
          bill_number: string
          title: string
          snippet: string
          tier: number
        }>(
          // The one query that iterates per jurisdiction, because here it pays:
          // billtexts_scope_search_idx cuts state, session and the tsquery
          // together, so each slice hands back only its own matches. The active
          // jurisdiction is the first row of `scopes` and takes the larger cap.
          `with scopes as (
             select $1::text as state, $2::int as session_id, 0 as tier, $3::int as cap
             union all
             select c.state, c.session_id, 1, $4::int from ${CURRENT} c
              where c.state <> $1 and ${options.all ? "true" : "false"}
           ),
           picked as (
             select s.tier, x.bill_id, x.document_id, x.state, x.head_from
             from scopes s
             cross join lateral (
               -- Two indexes, one question. search_tsv covers the first megabyte
               -- of every document; "BillTextChunks" covers everything after it,
               -- for the 2,110 documents that have an after. Both are gin(state,
               -- session_id, tsv), so both cut the same way in the same plan.
               --
               -- head_from is the character offset ts_headline has to start at.
               -- Without it a chunk hit would be found and then thrown away: the
               -- headline would be cut from the top of the document, contain no
               -- match, and be dropped by the highlight filter below. 1 means the
               -- first megabyte; anything else is the chunk's own start.
               select distinct on (u.bill_id) u.bill_id, u.document_id, u.state, u.head_from
               from (
                 select t.bill_id, t.document_id, t.state, 1 as head_from
                 from "BillTexts" t
                 where t.state = s.state and t.session_id = s.session_id
                   and t.text is not null
                   and t.search_tsv @@ websearch_to_tsquery('english', $5)
                 union all
                 select c.bill_id, c.document_id, c.state,
                        ${CHUNK_FIRST} + c.chunk_no * ${CHUNK_STRIDE}
                 from "BillTextChunks" c
                 where c.state = s.state and c.session_id = s.session_id
                   and c.tsv @@ websearch_to_tsquery('english', $5)
               ) u
               -- head_from ascending breaks the tie when a bill matches in both:
               -- prefer the first megabyte, whose headline is a quarter the cost.
               order by u.bill_id desc, u.document_id desc, u.head_from
               limit s.cap
             ) x
           ),
           -- ts_headline is the expensive half of this query — it detoasts the
           -- body and re-parses it — so the row set is cut to what can actually
           -- be returned *before* it runs. "picked" can hold 8 + 2x51 = 110 rows
           -- when every jurisdiction matches; without this the query pays for
           -- 110 headlines to show at most $7 of them. $8 leaves headroom for
           -- the unhighlighted rows dropped below.
           shortlist as (
             select * from picked order by tier, state, bill_id desc limit $8
           ),
           snippets as (
             select p.tier, p.bill_id, p.document_id, p.state, b.bill_number, b.title,
                    ts_headline('english',
                      case when p.head_from <= 1
                           -- the first megabyte, minus New York's scraped preamble
                           then left(${BODY}, 200000)
                           -- the exact chunk that matched, whole, so the match is
                           -- certain to be inside the window rather than probably
                           else substr(t.text, p.head_from, ${CHUNK_LEN})
                      end,
                      websearch_to_tsquery('english', $5), $6) as snippet
             from shortlist p
             join "Bills" b on b.bill_id = p.bill_id
             join "BillTexts" t on t.document_id = p.document_id
           )
           -- ts_headline given no match inside its window returns the opening of
           -- the document instead of nothing, which reads as a result and teaches
           -- the reader nothing. 2,707 of the 444,220 current-session documents
           -- (0.61%) run past 200 k characters; when one of them matched further
           -- in than that, it is dropped here rather than shown unhighlighted.
           select tier, bill_id, document_id, state, bill_number, title, snippet
           from snippets
           where snippet like '%«%'
           order by tier, state
           limit $7`,
          [f.state, f.session, limit, perState, term, HEADLINE_OPTS, limit + 12, limit + 24]
        )
      : Promise.resolve([]),
  ])

  return {
    q: term,
    state: f.state,
    session: f.session,
    bills: bills.map((r) => ({ ...r, bill_id: n(r.bill_id), tier: n(r.tier) })),
    members: members.map((r) => ({ ...r, people_id: n(r.people_id) })),
    committees: committees.map((r) => ({ ...r, bills: n(r.bills), tier: n(r.tier) })),
    texts: texts.map((r) => ({
      ...r,
      bill_id: n(r.bill_id),
      document_id: n(r.document_id),
      tier: n(r.tier),
    })),
  }
}
