import "server-only"

import { n, one, q } from "@/lib/policy/db"
import { parentCode } from "@/lib/policy/congress"
import { BILL_COLUMNS, PRIME_SPONSOR, type BillRow, type Resolved, getSessionTitles, withLatestTexts } from "@/lib/policy/db-queries"

// The committee page's record, and the pages that hang off it — a hearing, a
// nomination, an amendment — read from the congress.gov families the harvest
// landed on 2026-09-05 and 2026-09-06 (Brendan: "get them all"). Each reader
// answers plain rows a client block can take as props; the payload's own
// field names are kept where a row is handed on whole.
//
// The harvest is still running as this is written, and it creates tables and
// adds detail columns as it reaches each family. So a family that is not there
// yet is read through `payload`, which is there from the first list pass, and
// a table that is not there yet throws — the page wraps every family in
// `safe()` and shows the block empty rather than failing the page.

const CONGRESS = 119

/* ---- committees --------------------------------------------------------- */

export type CommitteeRecord = {
  code: string
  name: string
  chamber: string
  type: string | null
  parent: { code: string; name: string } | null
  isCurrent: boolean
  website: string | null
  history: { officialName: string | null; startDate: string | null; endDate: string | null; authority: string | null; type: string | null }[]
  subcommittees: { code: string; name: string }[]
  counts: { bills: number | null; reports: number | null; nominations: number | null; communications: number | null }
}

const asJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

/** One federal committee's own record: names through history, subcommittees, website, and what it holds. */
export async function getCommitteeRecord(code: string): Promise<CommitteeRecord | null> {
  const row = await one<Record<string, unknown>>(
    `select c.key, c.name, c.chamber, c.committee_type, c.parent, p.name as parent_name, c.is_current, c.website_url,
            c.history, c.subcommittees, c.bills_count, c.reports_count, c.nominations_count, c.communications_count
       from congress_committees c left join congress_committees p on p.key = c.parent
      where c.key = $1`,
    [code.toLowerCase()]
  )
  if (!row) return null
  type H = { officialName?: string; startDate?: string; endDate?: string; establishingAuthority?: string; committeeTypeCode?: string; libraryOfCongressName?: string }
  type S = { name?: string; systemCode?: string }
  const history = asJson<H[]>(row.history, [])
  // congress.gov lists every subcommittee the committee has ever had; the
  // current ones are the rows that say so.
  const listed = asJson<S[]>(row.subcommittees, [])
  const current = listed.length
    ? await q<{ key: string }>(`select key from congress_committees where key = any($1::text[]) and coalesce(is_current, 'true') <> 'false'`, [listed.map((s) => String(s.systemCode ?? "").toLowerCase()).filter(Boolean)])
    : []
  const keep = new Set(current.map((r) => r.key))
  const subs = listed.filter((s) => keep.has(String(s.systemCode ?? "").toLowerCase()))
  const count = (v: unknown) => (v == null || v === "" ? null : n(v))
  return {
    code: String(row.key),
    name: String(row.name ?? ""),
    chamber: String(row.chamber ?? ""),
    type: row.committee_type ? String(row.committee_type) : null,
    parent: row.parent ? { code: String(row.parent), name: String(row.parent_name ?? "") } : null,
    isCurrent: String(row.is_current ?? "true") !== "false",
    website: row.website_url ? String(row.website_url) : null,
    history: (Array.isArray(history) ? history : []).map((h) => ({
      officialName: h.officialName ?? h.libraryOfCongressName ?? null,
      startDate: h.startDate ?? null,
      endDate: h.endDate ?? null,
      authority: h.establishingAuthority ?? null,
      type: h.committeeTypeCode ?? null,
    })),
    subcommittees: (Array.isArray(subs) ? subs : []).filter((s) => s.systemCode).map((s) => ({ code: String(s.systemCode), name: String(s.name ?? "") })),
    counts: { bills: count(row.bills_count), reports: count(row.reports_count), nominations: count(row.nominations_count), communications: count(row.communications_count) },
  }
}

export type RosterRow = {
  bioguide_id: string
  people_id: number | null
  name: string
  photo_url: string | null
  party: string | null
  district: string | null
  role: string | null
  chamber: string | null
  rank: number
  /** "Chairman", "Ranking Member", "Vice Chairman"… or null for a member. */
  title: string | null
  /** "majority" or "minority", as the unitedstates project files it. */
  side: string | null
}

/** Who sits on the committee, leadership first, then by rank — from the unitedstates project's roster, faces from People. */
export async function getCommitteeRoster(code: string): Promise<RosterRow[]> {
  const rows = await q<RosterRow>(
    `select m.bioguide_id, p.people_id, coalesce(p.name, m.bioguide_id) as name, p.photo_url, p.party, p.district, p.role, p.chamber,
            m.rank::int as rank, m.title, m.party as side
       from congress_committee_members m
       left join "People" p on p.bioguide_id = m.bioguide_id and p.state = 'US' and p.committee_id is null
      where m.system_code = $1
      order by (m.title is null), (m.party = 'minority'), m.rank, p.name`,
    [code.toLowerCase()]
  )
  return rows.map((r) => ({ ...r, people_id: r.people_id == null ? null : n(r.people_id), rank: n(r.rank) }))
}

/** The committee before and after this one in its chamber's list, or a subcommittee's siblings. */
export async function getCommitteeNeighbours(code: string) {
  const me = await one<{ chamber: string; parent: string | null; name: string }>(`select chamber, parent, name from congress_committees where key = $1`, [code.toLowerCase()])
  if (!me) return { previous: null, next: null }
  const rows = await q<{ key: string; name: string }>(
    me.parent ? `select key, name from congress_committees where parent = $1 order by name` : `select key, name from congress_committees where chamber = $1 and parent is null and coalesce(is_current, 'true') <> 'false' order by name`,
    [me.parent ?? me.chamber]
  )
  const at = rows.findIndex((r) => r.key === code.toLowerCase())
  return { previous: at > 0 ? rows[at - 1] : null, next: at >= 0 && at < rows.length - 1 ? rows[at + 1] : null }
}

/** The bills before a committee this session, by status, with the count — the Bills block's tabs. */
export async function getCommitteeBillsByStatus(f: Resolved, name: string, status: string | null, limit = 50, offset = 0) {
  const params: unknown[] = [f.state, f.session, name]
  let where = `b.state = $1 and b.session_id = $2 and (b.committee = $3 or exists (select 1 from "Referrals" rf where rf.bill_id = b.bill_id and rf.name = $3))`
  if (status) where += ` and coalesce(nullif(b.status_desc, ''), 'Introduced') = $${params.push(status)}`
  const scope = params.slice()
  const [rows, count] = await Promise.all([
    q<BillRow>(
      `select ${BILL_COLUMNS} from "Bills" b ${PRIME_SPONSOR}
        where ${where}
        order by b.last_action_date desc nulls last, b.bill_id desc
        limit $${params.push(limit)} offset $${params.push(offset)}`,
      params
    ),
    one<{ total: number }>(`select count(*)::int total from "Bills" b where ${where}`, scope),
  ])
  return { rows: await withLatestTexts(rows.map((r) => ({ ...r, bill_id: n(r.bill_id) }))), total: n(count?.total) }
}

/** The status breakdown of the bills before a committee this session — the tabs and their counts. */
export async function getCommitteeStatuses(f: Resolved, name: string) {
  return q<{ status: string; bills: number }>(
    `select coalesce(nullif(b.status_desc, ''), 'Introduced') status, count(*)::int bills from "Bills" b
      where b.state = $1 and b.session_id = $2 and (b.committee = $3 or exists (select 1 from "Referrals" rf where rf.bill_id = b.bill_id and rf.name = $3))
      group by 1 order by 2 desc`,
    [f.state, f.session, name]
  ).then((rows) => rows.map((r) => ({ ...r, bills: n(r.bills) })))
}

/**
 * The room test: a full committee's page carries what its subcommittees held,
 * a subcommittee's only its own. A system code is chamber + committee +
 * subcommittee, so the first four characters are the committee.
 */
const roomWhere = (code: string, column: string) => (code.toLowerCase().endsWith("00") ? `left(lower(${column}), 4) = '${parentCode(code)}'` : `lower(${column}) = '${code.toLowerCase().replace(/'/g, "")}'`)

export type HearingRow = {
  key: string
  jacket: string
  chamber: string | null
  number: string | null
  citation: string | null
  title: string | null
  date: string | null
  committee_code: string | null
  committee_name: string | null
  text_url: string | null
  pdf_url: string | null
  /** True once hearing-texts.mjs has the transcript on file. */
  has_text: boolean
}

const HEARING_COLUMNS = `h.key, h.jacket_number as jacket, h.chamber, h.number,
  h.payload->>'citation' as citation, h.payload->>'title' as title,
  coalesce(h.payload->'dates'->0->>'date', h.payload->>'date') as date,
  h.payload->'committees'->0->>'systemCode' as committee_code, h.payload->'committees'->0->>'name' as committee_name,
  (select f->>'url' from jsonb_array_elements(coalesce(h.payload->'formats', '[]'::jsonb)) f where f->>'type' ilike '%text%' limit 1) as text_url,
  (select f->>'url' from jsonb_array_elements(coalesce(h.payload->'formats', '[]'::jsonb)) f where f->>'type' ilike '%pdf%' limit 1) as pdf_url`

/** The hearings a committee held, newest first, from the detail landing tonight (a list row alone has no title). */
export async function getCommitteeHearingRows(code: string, limit = 200): Promise<HearingRow[]> {
  const rows = await q<Omit<HearingRow, "has_text">>(
    `select ${HEARING_COLUMNS} from congress_hearings h
      where exists (select 1 from jsonb_array_elements(coalesce(h.payload->'committees', '[]'::jsonb)) c where ${roomWhere(code, "c->>'systemCode'")})
      order by coalesce(h.payload->'dates'->0->>'date', '') desc, h.update_date desc nulls last limit $1`,
    [limit]
  )
  const held = await hearingTextKeys(rows.map((r) => r.key))
  return rows.map((r) => ({ ...r, has_text: held.has(r.key) }))
}

/** Which of these hearings have a transcript on file; empty until the fetcher has run. */
async function hearingTextKeys(keys: string[]) {
  if (!keys.length) return new Set<string>()
  try {
    const rows = await q<{ key: string }>(`select key from congress_hearing_texts where key = any($1::text[]) and text is not null`, [keys])
    return new Set(rows.map((r) => r.key))
  } catch {
    return new Set<string>()
  }
}

export type MeetingRow = {
  event_id: string
  congress: number
  chamber: string | null
  date: string | null
  title: string | null
  type: string | null
  status: string | null
  building: string | null
  room: string | null
  committee_code: string | null
  committee_name: string | null
  committees: { code: string; name: string }[]
  witnesses: { name: string | null; position: string | null; organization: string | null }[]
  /** The witnesses' own papers: biography, statement, truth in testimony — matched to a witness by the surname in the file name. */
  witness_documents: { type: string | null; url: string; format: string | null }[]
  documents: { name: string | null; type: string | null; url: string | null; format: string | null }[]
  bills: { type: string | null; number: string | null; title: string | null }[]
  videos: { name: string | null; url: string }[]
  /** The printed transcript's jacket number, once GPO has one. */
  transcript_jacket: string | null
  /** True once the detail pass has read the record; a list row has none of the above. */
  detailed: boolean
}

const meetingOf = (row: Record<string, unknown>): MeetingRow => {
  const p = asJson<Record<string, unknown>>(row.payload, {})
  const loc = (p.location ?? {}) as { building?: string; room?: string }
  const committees = (p.committees ?? []) as { systemCode?: string; name?: string }[]
  const witnesses = (p.witnesses ?? []) as { name?: string; position?: string; organization?: string }[]
  const witnessDocs = (p.witnessDocuments ?? []) as { documentType?: string; url?: string; format?: string }[]
  const documents = (p.meetingDocuments ?? []) as { name?: string; documentType?: string; url?: string; format?: string }[]
  const related = ((p.relatedItems as { bills?: { type?: string; number?: string; title?: string }[] })?.bills ?? []) as { type?: string; number?: string; title?: string }[]
  const videos = (p.videos ?? []) as { name?: string; url?: string }[]
  const transcript = (p.hearingTranscript ?? []) as { jacketNumber?: number | string }[]
  return {
    event_id: String(row.event_id ?? p.eventId ?? ""),
    congress: n(row.congress ?? p.congress) || CONGRESS,
    chamber: (p.chamber as string) ?? null,
    date: (row.meeting_date as string) ?? (p.date as string) ?? null,
    title: (row.title as string) ?? (p.title as string) ?? null,
    type: (p.type as string) ?? null,
    status: (row.meeting_status as string) ?? (p.meetingStatus as string) ?? null,
    building: loc.building ?? null,
    room: loc.room ?? null,
    committee_code: committees[0]?.systemCode ?? null,
    committee_name: committees[0]?.name ?? null,
    committees: committees.filter((c) => c.systemCode).map((c) => ({ code: String(c.systemCode), name: String(c.name ?? "") })),
    witnesses: witnesses.map((w) => ({ name: w.name ?? null, position: w.position ?? null, organization: w.organization ?? null })),
    witness_documents: witnessDocs.filter((d) => d.url).map((d) => ({ type: d.documentType ?? null, url: String(d.url), format: d.format ?? null })),
    documents: documents.map((d) => ({ name: d.name ?? null, type: d.documentType ?? null, url: d.url ?? null, format: d.format ?? null })),
    bills: related.map((b) => ({ type: b.type ?? null, number: b.number ?? null, title: b.title ?? null })),
    videos: videos.filter((v) => v.url).map((v) => ({ name: v.name ?? null, url: String(v.url) })),
    transcript_jacket: transcript[0]?.jacketNumber != null ? String(transcript[0].jacketNumber) : null,
    detailed: row.detail_fetched_at != null || p.title != null,
  }
}

/** What a committee's calendar needs of a meeting; the witnesses and papers stay on the meeting's own page. */
export const meetingLite = (m: MeetingRow) => ({ event_id: m.event_id, date: m.date, title: m.title, type: m.type, committee_code: m.committee_code, committee_name: m.committee_name })

/** One meeting by its congress.gov event id, whole. */
export async function getMeeting(eventId: string): Promise<MeetingRow | null> {
  const row = await one<Record<string, unknown>>(`select m.event_id, m.congress, m.meeting_date, m.title, m.meeting_status, m.detail_fetched_at, m.payload from congress_committee_meetings m where m.event_id = $1 or m.key = $1 limit 1`, [
    eventId,
  ])
  return row ? meetingOf(row) : null
}

/** The meeting before and after this one on the committee's calendar. */
export async function getMeetingNeighbours(meeting: MeetingRow) {
  const code = meeting.committee_code
  const date = meeting.date ?? ""
  if (!code) return { previous: null, next: null }
  const inRoom = `exists (select 1 from jsonb_array_elements(coalesce(m.payload->'committees', '[]'::jsonb)) c where ${roomWhere(code, "c->>'systemCode'")})`
  const [previous, next] = await Promise.all([
    one<{ event_id: string; title: string | null; meeting_date: string | null }>(
      `select m.event_id, m.title, m.meeting_date from congress_committee_meetings m where m.meeting_date is not null and ${inRoom} and (m.meeting_date, m.event_id) < ($1, $2) order by m.meeting_date desc, m.event_id desc limit 1`,
      [date, meeting.event_id]
    ),
    one<{ event_id: string; title: string | null; meeting_date: string | null }>(
      `select m.event_id, m.title, m.meeting_date from congress_committee_meetings m where m.meeting_date is not null and ${inRoom} and (m.meeting_date, m.event_id) > ($1, $2) order by m.meeting_date, m.event_id limit 1`,
      [date, meeting.event_id]
    ),
  ])
  return { previous, next }
}

/** Our bill rows for a meeting's related bills, by congress.gov type and number. */
export async function getBillsByCongressNumber(refs: { type: string | null; number: string | null }[]) {
  const prefix: Record<string, string> = { HR: "HB", S: "SB", HJRES: "HJR", SJRES: "SJR", HCONRES: "HCR", SCONRES: "SCR", HRES: "HR", SRES: "SR" }
  const numbers = refs.filter((r) => r.type && r.number).map((r) => `${prefix[String(r.type).toUpperCase()] ?? String(r.type).toUpperCase()}${r.number}`)
  if (!numbers.length) return new Map<string, { bill_id: number; title: string }>()
  const rows = await q<{ bill_id: number; bill_number: string; title: string }>(`select bill_id, bill_number, title from "Bills" where state = 'US' and session_id = ${yearOfCongress(CONGRESS)} and bill_number = any($1::text[])`, [numbers])
  return new Map(rows.map((r) => [r.bill_number, { bill_id: n(r.bill_id), title: r.title }]))
}

const yearOfCongress = (c: number) => (c - 1) * 2 + 1789

/** The committee's meetings with a date on file, newest first — the detail pass keeps the last month and the next two. */
export async function getCommitteeMeetingRows(code: string, limit = 200): Promise<MeetingRow[]> {
  const rows = await q<Record<string, unknown>>(
    `select m.event_id, m.congress, m.meeting_date, m.title, m.meeting_status, m.detail_fetched_at, m.payload from congress_committee_meetings m
      where m.meeting_date is not null
        and exists (select 1 from jsonb_array_elements(coalesce(m.payload->'committees', '[]'::jsonb)) c where ${roomWhere(code, "c->>'systemCode'")})
      order by m.meeting_date desc limit $1`,
    [limit]
  )
  return rows.map(meetingOf)
}

export type ReportRow = {
  key: string
  citation: string | null
  chamber: string | null
  type: string | null
  number: string | null
  part: number | null
  title: string | null
  issued: string | null
  bill_id: number | null
  bill_number: string | null
}

/** The reports a committee filed this Congress, newest first. */
export async function getCommitteeReportRows(code: string, limit = 200): Promise<ReportRow[]> {
  const rows = await q<ReportRow>(
    `select r.key, r.citation, r.chamber, r.report_type as type, r.number, r.part, r.title, r.issue_date as issued, r.bill_id, b.bill_number
       from congress_committee_reports r left join "Bills" b on b.bill_id = r.bill_id
      where ${roomWhere(code, "r.committee_code")}
      order by r.issue_date desc nulls last, r.update_date desc nulls last limit $1`,
    [limit]
  )
  return rows.map((r) => ({ ...r, part: r.part == null ? null : n(r.part), bill_id: r.bill_id == null ? null : n(r.bill_id) }))
}

export type PrintRow = { key: string; jacket: string; chamber: string | null; number: string | null; title: string | null; citation: string | null; bills: { type: string | null; number: string | null; title: string | null }[] }

/** The committee prints a committee issued — read through payload, since the detail lands with the harvest. */
export async function getCommitteePrintRows(code: string, limit = 100): Promise<PrintRow[]> {
  const rows = await q<Record<string, unknown>>(
    `select p.key, p.jacket_number, p.chamber, p.number, p.payload from congress_committee_prints p
      where exists (select 1 from jsonb_array_elements(coalesce(p.payload->'committees', '[]'::jsonb)) c where ${roomWhere(code, "c->>'systemCode'")})
      order by p.update_date desc nulls last limit $1`,
    [limit]
  )
  return rows.map((r) => {
    const p = asJson<Record<string, unknown>>(r.payload, {})
    const bills = (p.associatedBills ?? []) as { type?: string; number?: string; title?: string }[]
    return {
      key: String(r.key),
      jacket: String(r.jacket_number ?? ""),
      chamber: (r.chamber as string) ?? null,
      number: (r.number as string) ?? null,
      title: (p.title as string) ?? null,
      citation: (p.citation as string) ?? null,
      bills: bills.map((b) => ({ type: b.type ?? null, number: b.number ?? null, title: b.title ?? null })),
    }
  })
}

export type NominationRow = {
  key: string
  citation: string | null
  description: string | null
  organization: string | null
  received: string | null
  latest_action: string | null
  latest_action_date: string | null
}

/** The nominations referred to a Senate committee this Congress, newest first, with the total. */
export async function getCommitteeNominationRows(code: string, limit = 50, offset = 0) {
  const where = `parent_key = $1 and congress = ${CONGRESS}`
  const [rows, total] = await Promise.all([
    q<NominationRow>(
      `select key, citation, description, payload->>'organization' as organization, received_date as received, latest_action, latest_action_date
         from congress_committee_nominations where ${where}
        order by received_date desc nulls last, key desc limit $2 offset $3`,
      [code.toLowerCase(), limit, offset]
    ),
    one<{ n: number }>(`select count(*)::int as n from congress_committee_nominations where ${where}`, [code.toLowerCase()]),
  ])
  return { rows, total: n(total?.n) }
}

export type CommunicationRow = {
  key: string
  chamber: string | null
  type: string | null
  type_code: string | null
  number: string | null
  referred: string | null
  abstract: string | null
}

/** The executive communications, petitions and memorials referred to a committee this Congress. */
export async function getCommitteeCommunicationRows(code: string, limit = 50, offset = 0) {
  const where = `c.parent_key = $1 and c.congress = ${CONGRESS}`
  const [rows, total] = await Promise.all([
    q<CommunicationRow>(
      `select c.key, c.chamber, c.communication_type as type, c.type_code, c.number, c.referral_date as referred,
              d.payload->>'abstract' as abstract
         from congress_committee_communications c
         left join congress_communications d on d.key = c.key
        where ${where}
        order by c.referral_date desc nulls last, c.key desc limit $2 offset $3`,
      [code.toLowerCase(), limit, offset]
    ),
    one<{ n: number }>(`select count(*)::int as n from congress_committee_communications c where ${where}`, [code.toLowerCase()]),
  ])
  return { rows, total: n(total?.n) }
}

/* ---- New York's committees ----------------------------------------------- */

export type StateCommittee = {
  committee_id: number
  name: string
  slug: string
  chamber: string
  type: string | null
  description: string | null
  schedule: string | null
  chair: string | null
  chair_email: string | null
  member_count: number | null
  members: string[]
  url: string | null
  address: string | null
}

/** One New York committee by its slug ("senate-aging"), from the Senate and Assembly sites. */
export async function getStateCommittee(slug: string): Promise<StateCommittee | null> {
  const row = await one<Record<string, unknown>>(
    `select committee_id, committee_name, slug, chamber, committee_type, description, meeting_schedule, chair_name, chair_email,
            member_count, committee_members, committee_url, address
       from "Committees" where slug = $1 limit 1`,
    [slug]
  )
  if (!row) return null
  return {
    committee_id: n(row.committee_id),
    name: String(row.committee_name ?? ""),
    slug: String(row.slug ?? slug),
    chamber: String(row.chamber ?? ""),
    type: (row.committee_type as string) ?? null,
    description: (row.description as string) ?? null,
    schedule: (row.meeting_schedule as string) ?? null,
    chair: (row.chair_name as string) ?? null,
    chair_email: (row.chair_email as string) ?? null,
    member_count: row.member_count == null || row.member_count === "" ? null : n(row.member_count),
    members: String(row.committee_members ?? "")
      .split(/[;\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    url: (row.committee_url as string) ?? null,
    address: (row.address as string) ?? null,
  }
}

/** The New York committee's members as People rows, matched by the name slug the site prints. */
export async function getStateCommitteeRoster(members: string[], chair: string | null, chamber: string): Promise<RosterRow[]> {
  if (!members.length) return []
  const rows = await q<{ slug: string; people_id: number; name: string; photo_url: string | null; party: string | null; district: string | null; role: string | null; chamber: string | null }>(
    `select lower(regexp_replace(regexp_replace(unaccent(p.name), '[^A-Za-z]+', '-', 'g'), '(^-|-$)', '', 'g')) as slug,
            p.people_id, p.name, p.photo_url, p.party, p.district, p.role, p.chamber
       from "People" p
      where p.state = 'NY' and p.committee_id is null and not coalesce(p.archived, false) and p.chamber = $1`,
    [chamber]
  ).catch(() =>
    q<{ slug: string; people_id: number; name: string; photo_url: string | null; party: string | null; district: string | null; role: string | null; chamber: string | null }>(
      `select lower(regexp_replace(regexp_replace(p.name, '[^A-Za-z]+', '-', 'g'), '(^-|-$)', '', 'g')) as slug,
              p.people_id, p.name, p.photo_url, p.party, p.district, p.role, p.chamber
         from "People" p
        where p.state = 'NY' and p.committee_id is null and not coalesce(p.archived, false) and p.chamber = $1`,
      [chamber]
    )
  )
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  // "jos-serrano" is José Serrano with the accent dropped by the site; match
  // on the surname when the whole slug misses.
  const bySurname = new Map(rows.map((r) => [r.slug.split("-").slice(-1)[0], r]))
  const chairSlug = chair
    ? chair
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : null
  const out: RosterRow[] = []
  members.forEach((slug, index) => {
    const p = bySlug.get(slug) ?? bySurname.get(slug.split("-").slice(-1)[0])
    const isChair = chairSlug
      ? slug === chairSlug ||
        (p &&
          p.name
            .toLowerCase()
            .replace(/[^a-z]+/g, "-")
            .replace(/(^-|-$)/g, "") === chairSlug)
      : index === 0
    out.push({
      bioguide_id: slug,
      people_id: p ? n(p.people_id) : null,
      name:
        p?.name ??
        slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      photo_url: p?.photo_url ?? null,
      party: p?.party ?? null,
      district: p?.district ?? null,
      role: p?.role ?? null,
      chamber: p?.chamber ?? chamber,
      rank: index + 1,
      title: isChair ? "Chair" : null,
      side: null,
    })
  })
  return out.sort((a, b) => (a.title ? 0 : 1) - (b.title ? 0 : 1) || a.rank - b.rank)
}

/** A state committee's hearings from the calendar, newest first. */
export async function getStateCommitteeCalendar(f: Resolved, name: string, limit = 60) {
  return q<{ date: string; time: string | null; description: string | null; bill_id: number; bill_number: string; title: string }>(
    `with scope as (select bill_id, bill_number, title from "Bills" where state = $1 and session_id = $2)
     select c.date, c.time, c.description, s.bill_id, s.bill_number, s.title
       from "Calendar" c join scope s using (bill_id)
      where c.description ilike $3 and c.date <= to_char(now() + interval '1 year', 'YYYY-MM-DD')
      order by c.date desc, c.time limit $4`,
    [f.state, f.session, `%${name} Committee%`, limit]
  ).then((rows) => rows.map((r) => ({ ...r, bill_id: n(r.bill_id) })))
}

/* ---- hearings ------------------------------------------------------------ */

export type HearingRecord = HearingRow & {
  congress: number
  dates: string[]
  committees: { code: string; name: string }[]
  loc_id: string | null
  text: string | null
  chars: number | null
}

/** One hearing by jacket number, with its transcript when the fetcher has it. */
export async function getHearing(jacket: string): Promise<HearingRecord | null> {
  const row = await one<Record<string, unknown>>(`select ${HEARING_COLUMNS}, h.congress, h.payload from congress_hearings h where h.key = $1 or h.jacket_number = $1 limit 1`, [jacket])
  if (!row) return null
  const p = asJson<Record<string, unknown>>(row.payload, {})
  const dates = ((p.dates ?? []) as { date?: string }[]).map((d) => d.date).filter(Boolean) as string[]
  const committees = ((p.committees ?? []) as { systemCode?: string; name?: string }[]).filter((c) => c.systemCode).map((c) => ({ code: String(c.systemCode), name: String(c.name ?? "") }))
  let text: string | null = null
  let chars: number | null = null
  try {
    const held = await one<{ text: string | null; chars: number | null }>(`select text, chars from congress_hearing_texts where key = $1`, [String(row.key)])
    text = held?.text ?? null
    chars = held?.chars == null ? null : n(held.chars)
  } catch {
    // The transcripts table does not exist until hearing-texts.mjs has run.
  }
  return {
    key: String(row.key),
    jacket: String(row.jacket ?? ""),
    chamber: (row.chamber as string) ?? null,
    number: (row.number as string) ?? null,
    citation: (row.citation as string) ?? null,
    title: (row.title as string) ?? null,
    date: (row.date as string) ?? null,
    committee_code: (row.committee_code as string) ?? null,
    committee_name: (row.committee_name as string) ?? null,
    text_url: (row.text_url as string) ?? null,
    pdf_url: (row.pdf_url as string) ?? null,
    has_text: text != null,
    congress: n(row.congress) || CONGRESS,
    dates,
    committees,
    loc_id: (p.libraryOfCongressIdentifier as string) ?? null,
    text,
    chars,
  }
}

/** The meeting record a hearing came from: same committee, same day. That is where the witnesses and the bills are. */
export async function getHearingMeeting(committeeCode: string | null, date: string | null): Promise<MeetingRow | null> {
  if (!committeeCode || !date) return null
  const row = await one<Record<string, unknown>>(
    `select m.event_id, m.congress, m.meeting_date, m.title, m.meeting_status, m.detail_fetched_at, m.payload from congress_committee_meetings m
      where left(m.meeting_date, 10) = left($2, 10)
        and exists (select 1 from jsonb_array_elements(coalesce(m.payload->'committees', '[]'::jsonb)) c where lower(c->>'systemCode') = $1)
      order by m.update_date desc nulls last limit 1`,
    [committeeCode.toLowerCase(), date]
  )
  return row ? meetingOf(row) : null
}

/** The hearing before and after this one in its chamber, by date. */
export async function getHearingNeighbours(key: string) {
  const me = await one<{ chamber: string | null; date: string | null }>(`select chamber, coalesce(payload->'dates'->0->>'date', '') as date from congress_hearings where key = $1`, [key])
  if (!me) return { previous: null, next: null }
  const [previous, next] = await Promise.all([
    one<{ key: string; citation: string | null }>(
      `select key, payload->>'citation' as citation from congress_hearings
        where chamber = $1 and (coalesce(payload->'dates'->0->>'date', ''), key) < ($2, $3) and payload->>'title' is not null
        order by coalesce(payload->'dates'->0->>'date', '') desc, key desc limit 1`,
      [me.chamber, me.date ?? "", key]
    ),
    one<{ key: string; citation: string | null }>(
      `select key, payload->>'citation' as citation from congress_hearings
        where chamber = $1 and (coalesce(payload->'dates'->0->>'date', ''), key) > ($2, $3) and payload->>'title' is not null
        order by coalesce(payload->'dates'->0->>'date', ''), key limit 1`,
      [me.chamber, me.date ?? "", key]
    ),
  ])
  return { previous, next }
}

/** Every hearing with a title, newest first, for the index. */
export async function getHearingIndex(limit = 100, offset = 0, chamber?: string) {
  const where = `h.payload->>'title' is not null${chamber ? ` and h.chamber = $3` : ""}`
  const params: unknown[] = [limit, offset]
  if (chamber) params.push(chamber)
  const [rows, total] = await Promise.all([
    q<Omit<HearingRow, "has_text">>(
      `select ${HEARING_COLUMNS} from congress_hearings h where ${where}
        order by coalesce(h.payload->'dates'->0->>'date', '') desc, h.key desc limit $1 offset $2`,
      params
    ),
    one<{ n: number }>(`select count(*)::int as n from congress_hearings h where ${where}`, chamber ? [null, null, chamber].slice(2) : []).catch(() => null),
  ])
  const held = await hearingTextKeys(rows.map((r) => r.key))
  return { rows: rows.map((r) => ({ ...r, has_text: held.has(r.key) })), total: n(total?.n) }
}

/* ---- nominations --------------------------------------------------------- */

export type NominationRecord = {
  key: string
  congress: number
  number: string
  part: string | null
  citation: string | null
  description: string | null
  organization: string | null
  received: string | null
  latest_action: string | null
  latest_action_date: string | null
  authority_date: string | null
  is_privileged: boolean | null
  nominees: { ordinal: number | null; count: number | null; organization: string | null; position: string | null; intro: string | null }[]
  counts: { actions: number | null; committees: number | null; hearings: number | null }
}

const nominationOf = (row: Record<string, unknown>): NominationRecord => {
  const p = asJson<Record<string, unknown>>(row.payload, {})
  const nominees = asJson<{ ordinal?: number; nomineeCount?: number; organization?: string; positionTitle?: string; introText?: string }[]>(row.nominees ?? p.nominees, [])
  const count = (v: unknown) => (v == null || v === "" ? null : n(v))
  return {
    key: String(row.key),
    congress: n(row.congress) || CONGRESS,
    number: String(row.number ?? ""),
    part: row.part_number ? String(row.part_number) : null,
    citation: (row.citation as string) ?? null,
    description: (row.description as string) ?? null,
    organization: (row.organization as string) ?? null,
    received: (row.received_date as string) ?? null,
    latest_action: (row.latest_action as string) ?? null,
    latest_action_date: (row.latest_action_date as string) ?? (p.latestAction as { actionDate?: string })?.actionDate ?? null,
    authority_date: (row.authority_date as string) ?? null,
    is_privileged: row.is_privileged == null ? null : String(row.is_privileged) === "true",
    nominees: (Array.isArray(nominees) ? nominees : []).map((x) => ({
      ordinal: x.ordinal ?? null,
      count: x.nomineeCount ?? null,
      organization: x.organization ?? null,
      position: x.positionTitle ?? null,
      intro: x.introText ?? null,
    })),
    counts: { actions: count(row.actions_count), committees: count(row.committees_count), hearings: count(row.hearings_count) },
  }
}

/** One nomination by citation ("PN1255-8") or key ("119-1255-08"). */
export async function getNomination(id: string): Promise<NominationRecord | null> {
  const row = await one<Record<string, unknown>>(`select * from congress_nominations where key = $1 or lower(citation) = lower($1) limit 1`, [id])
  return row ? nominationOf(row) : null
}

export type NominationAction = { key: string; date: string | null; text: string | null; type: string | null; committees: { code: string | null; name: string }[] }

export async function getNominationActions(key: string): Promise<NominationAction[]> {
  const rows = await q<{ key: string; action_date: string | null; text: string | null; action_type: string | null; committees: unknown }>(
    `select key, action_date, text, action_type, committees from congress_nomination_actions where parent_key = $1 order by action_date desc, key desc`,
    [key]
  )
  return rows.map((r) => ({
    key: r.key,
    date: r.action_date,
    text: r.text,
    type: r.action_type,
    committees: asJson<{ systemCode?: string; name?: string }[]>(r.committees, []).map((c) => ({ code: c.systemCode ?? null, name: c.name ?? "" })),
  }))
}

export async function getNominationCommittees(key: string) {
  return q<{ key: string; code: string | null; name: string | null; chamber: string | null; activities: unknown }>(
    `select key, system_code as code, name, chamber, activities from congress_nomination_committees where parent_key = $1 order by key`,
    [key]
  ).then((rows) => rows.map((r) => ({ ...r, activities: asJson<{ name?: string; date?: string }[]>(r.activities, []) })))
}

export async function getNominationHearings(key: string) {
  return q<{ key: string; jacket: string | null; date: string | null; citation: string | null; number: string | null }>(
    `select key, jacket_number as jacket, hearing_date as date, citation, number from congress_nomination_hearings where parent_key = $1 order by hearing_date desc`,
    [key]
  )
}

/** The nomination received before and after this one. */
export async function getNominationNeighbours(key: string) {
  const me = await one<{ received_date: string | null }>(`select received_date from congress_nominations where key = $1`, [key])
  if (!me) return { previous: null, next: null }
  const [previous, next] = await Promise.all([
    one<{ key: string; citation: string | null }>(`select key, citation from congress_nominations where (coalesce(received_date, ''), key) < ($1, $2) order by received_date desc nulls last, key desc limit 1`, [me.received_date ?? "", key]),
    one<{ key: string; citation: string | null }>(`select key, citation from congress_nominations where (coalesce(received_date, ''), key) > ($1, $2) order by received_date, key limit 1`, [me.received_date ?? "", key]),
  ])
  return { previous, next }
}

/* ---- amendments ---------------------------------------------------------- */

export type AmendmentRecord = {
  key: string
  congress: number
  type: string
  number: string
  chamber: string | null
  purpose: string | null
  description: string | null
  latest_action: string | null
  latest_action_date: string | null
  submitted: string | null
  proposed: string | null
  sponsors: { bioguide_id: string | null; name: string | null; party: string | null; state: string | null; district: string | null }[]
  bill: { id: number | null; type: string | null; number: string | null; title: string | null } | null
  amends: { type: string | null; number: string | null } | null
  counts: { actions: number | null; cosponsors: number | null; texts: number | null }
}

const amendmentOf = (row: Record<string, unknown>): AmendmentRecord => {
  const p = asJson<Record<string, unknown>>(row.payload, {})
  const sponsors = asJson<{ bioguideId?: string; fullName?: string; firstName?: string; lastName?: string; party?: string; state?: string; district?: string }[]>(row.sponsors ?? p.sponsors, [])
  const bill = (p.amendedBill ?? null) as { type?: string; number?: string; title?: string } | null
  const amends = (p.amendedAmendment ?? null) as { type?: string; number?: string } | null
  const latest = (p.latestAction ?? {}) as { text?: string; actionDate?: string }
  const count = (v: unknown) => (v == null || v === "" ? null : n(v))
  return {
    key: String(row.key),
    congress: n(row.congress) || CONGRESS,
    type: String(row.amendment_type ?? p.type ?? ""),
    number: String(row.number ?? p.number ?? ""),
    chamber: (row.chamber as string) ?? (p.chamber as string) ?? null,
    purpose: (row.purpose as string) ?? (p.purpose as string) ?? null,
    description: (row.description as string) ?? (p.description as string) ?? null,
    latest_action: (row.latest_action as string) ?? latest.text ?? null,
    latest_action_date: (row.latest_action_date as string) ?? latest.actionDate ?? null,
    submitted: (p.submittedDate as string) ?? null,
    proposed: (p.proposedDate as string) ?? null,
    sponsors: (Array.isArray(sponsors) ? sponsors : []).map((s) => ({
      bioguide_id: s.bioguideId ?? null,
      name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.fullName || null,
      party: s.party ?? null,
      state: s.state ?? null,
      district: s.district == null ? null : String(s.district),
    })),
    bill: bill ? { id: row.amended_bill_id == null ? null : n(row.amended_bill_id), type: bill.type ?? null, number: bill.number ?? null, title: bill.title ?? null } : null,
    amends: amends ? { type: amends.type ?? null, number: amends.number ?? null } : null,
    counts: { actions: count(row.actions_count), cosponsors: count(row.cosponsors_count), texts: count(row.text_versions_count) },
  }
}

/** One amendment by key ("119-SAMDT-5512") or by "samdt-5512" / "samdt5512". */
export async function getAmendment(id: string): Promise<AmendmentRecord | null> {
  const m = id.toUpperCase().match(/^(?:(\d+)-)?([HS]AMDT|[HS]A)-?(\d+)$/)
  const key = m ? `${m[1] ?? CONGRESS}-${m[2].length === 2 ? `${m[2].charAt(0)}AMDT` : m[2]}-${m[3]}` : id
  const row = await one<Record<string, unknown>>(`select * from congress_amendments where key = $1`, [key])
  return row ? amendmentOf(row) : null
}

export type AmendmentAction = {
  key: string
  date: string | null
  time: string | null
  text: string | null
  type: string | null
  source: string | null
  votes: { chamber: string | null; roll: number | null; date: string | null; url: string | null }[]
}

export async function getAmendmentActions(key: string): Promise<AmendmentAction[]> {
  const rows = await q<{ key: string; action_date: string | null; action_time: string | null; text: string | null; action_type: string | null; source_system: string | null; recorded_votes: unknown }>(
    `select key, action_date, action_time, text, action_type, source_system, recorded_votes from congress_amendment_actions where parent_key = $1
      order by action_date desc, action_time desc nulls last, key desc`,
    [key]
  )
  return rows.map((r) => ({
    key: r.key,
    date: r.action_date,
    time: r.action_time,
    text: r.text,
    type: r.action_type,
    source: r.source_system,
    votes: asJson<{ chamber?: string; rollNumber?: number; date?: string; url?: string }[]>(r.recorded_votes, []).map((v) => ({ chamber: v.chamber ?? null, roll: v.rollNumber ?? null, date: v.date ?? null, url: v.url ?? null })),
  }))
}

export type AmendmentCosponsor = { bioguide_id: string | null; name: string | null; party: string | null; state: string | null; joined: string | null; original: boolean }

export async function getAmendmentCosponsors(key: string): Promise<AmendmentCosponsor[]> {
  const rows = await q<{ bioguide_id: string | null; name: string | null; party: string | null; state: string | null; sponsorship_date: string | null; is_original: string | null }>(
    `select bioguide_id, name, party, state, sponsorship_date, is_original from congress_amendment_cosponsors where parent_key = $1 order by sponsorship_date, name`,
    [key]
  )
  return rows.map((r) => ({ bioguide_id: r.bioguide_id, name: r.name, party: r.party, state: r.state, joined: r.sponsorship_date, original: String(r.is_original) === "true" }))
}

export type AmendmentText = { version: string | null; date: string | null; text_url: string | null; pdf_url: string | null }

export async function getAmendmentTexts(key: string): Promise<AmendmentText[]> {
  return q<{ version_type: string | null; version_date: string | null; text_url: string | null; pdf_url: string | null }>(
    `select version_type, version_date, text_url, pdf_url from congress_amendment_texts where parent_key = $1 order by version_date desc nulls last`,
    [key]
  ).then((rows) => rows.map((r) => ({ version: r.version_type, date: r.version_date, text_url: r.text_url, pdf_url: r.pdf_url })))
}

/** Our People row for a set of bioguide ids — the faces and links on a card. */
export async function getPeopleByBioguide(ids: string[]) {
  const wanted = [...new Set(ids.filter(Boolean).map((s) => s.toUpperCase()))]
  if (!wanted.length) return new Map<string, { people_id: number; name: string; photo_url: string | null; party: string | null; district: string | null; role: string | null; chamber: string | null }>()
  const rows = await q<{ bioguide_id: string; people_id: number; name: string; photo_url: string | null; party: string | null; district: string | null; role: string | null; chamber: string | null }>(
    `select bioguide_id, people_id, name, photo_url, party, district, role, chamber from "People"
      where state = 'US' and committee_id is null and bioguide_id = any($1::text[])`,
    [wanted]
  )
  return new Map(rows.map((r) => [r.bioguide_id.toUpperCase(), { ...r, people_id: n(r.people_id) }]))
}

/** The amendment before and after this one, by number within its chamber. */
export async function getAmendmentNeighbours(key: string) {
  const me = await one<{ amendment_type: string; number: string }>(`select amendment_type, number from congress_amendments where key = $1`, [key])
  if (!me) return { previous: null, next: null }
  const [previous, next] = await Promise.all([
    one<{ key: string; amendment_type: string; number: string }>(`select key, amendment_type, number from congress_amendments where amendment_type = $1 and number::int < $2::int order by number::int desc limit 1`, [
      me.amendment_type,
      me.number,
    ]),
    one<{ key: string; amendment_type: string; number: string }>(`select key, amendment_type, number from congress_amendments where amendment_type = $1 and number::int > $2::int order by number::int limit 1`, [
      me.amendment_type,
      me.number,
    ]),
  ])
  return { previous, next }
}

/* ---- the rail ------------------------------------------------------------ */

/** The bills the rail shows beside a committee: what is still before it, and what moved last, newest action first. */
export async function getCommitteeRail(f: Resolved, name: string, limit = 8) {
  const where = `b.state = $1 and b.session_id = $2 and (b.committee = $3 or exists (select 1 from "Referrals" rf where rf.bill_id = b.bill_id and rf.name = $3))`
  const columns = `b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date`
  const [pending, recent] = await Promise.all([
    q<{ bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action: string | null; last_action_date: string | null }>(
      `select ${columns} from "Bills" b where ${where} and (coalesce(nullif(b.status_desc, ''), 'Introduced') = 'Introduced' or b.status_desc ilike '%committee%')
        order by b.last_action_date desc nulls last, b.bill_id desc limit $4`,
      [f.state, f.session, name, limit]
    ),
    q<{ bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action: string | null; last_action_date: string | null }>(
      `select ${columns} from "Bills" b where ${where} order by b.last_action_date desc nulls last, b.bill_id desc limit $4`,
      [f.state, f.session, name, limit]
    ),
  ])
  const fix = (rows: typeof pending) => rows.map((r) => ({ ...r, bill_id: n(r.bill_id) }))
  return { pending: fix(pending), recent: fix(recent) }
}

/** The bills a member sponsored this session, newest action first, for the rail beside their page. */
export async function getMemberRail(f: Resolved, peopleId: number, limit = 12) {
  const rows = await q<{ bill_id: number; bill_number: string; title: string; status_desc: string | null; last_action: string | null; last_action_date: string | null }>(
    `select b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date
       from "Sponsors" s join "Bills" b using (bill_id)
      where s.people_id = $1 and s.sponsor_type_id = 1 and b.state = $2 and b.session_id = $3
      order by b.last_action_date desc nulls last, b.bill_id desc limit $4`,
    [peopleId, f.state, f.session, limit]
  )
  return { sponsored: rows.map((r) => ({ ...r, bill_id: n(r.bill_id) })) }
}

/* ---- a member's whole voting record, for the PDF --------------------------- */

export type VoteRecordRow = {
  session_id: number
  session_title: string | null
  date: string | null
  roll_call_id: number
  bill_id: number
  bill_number: string
  title: string
  description: string | null
  vote: string
  yea: number | null
  nay: number | null
  chamber: string | null
}

/**
 * Every recorded position a member has taken, across every session we hold,
 * newest first (Brendan, 2026-09-06: "their entire voting record"). Read in
 * keyset pages of a thousand: the Data API answers at most a megabyte a
 * statement, and a long-serving member's record runs past that.
 */
export async function getMemberVoteRecord(peopleId: number, state: string, limit = 20000): Promise<VoteRecordRow[]> {
  const PAGE = 1000
  const titles = await getSessionTitles(state)
  const rows: VoteRecordRow[] = []
  let cursor: { date: string; id: number } | null = null
  while (rows.length < limit) {
    const page: VoteRecordRow[] = await q<VoteRecordRow>(
      `select b.session_id, coalesce(r.date, '') as date, r.roll_call_id, b.bill_id, b.bill_number, left(b.title, 160) as title, left(r.description, 160) as description, v.vote_desc as vote,
              r.yea::int as yea, case when trim(r.nay) ~ '^[0-9]+$' then trim(r.nay)::int end as nay, r.chamber
         from "Votes" v
         join "Roll Call" r using (roll_call_id)
         join "Bills" b on b.bill_id = r.bill_id
        where v.people_id = $1 and b.state = $2
          and ($3::text is null or (coalesce(r.date, ''), r.roll_call_id) < ($3, $4))
        order by coalesce(r.date, '') desc, r.roll_call_id desc limit ${PAGE}`,
      [peopleId, state, cursor?.date ?? null, cursor?.id ?? 0]
    )
    rows.push(...page)
    if (page.length < PAGE) break
    const last = page[page.length - 1]
    cursor = { date: last.date ?? "", id: n(last.roll_call_id) }
  }
  return rows.map((r) => ({
    ...r,
    session_id: n(r.session_id),
    session_title: titles.get(n(r.session_id)) ?? null,
    roll_call_id: n(r.roll_call_id),
    bill_id: n(r.bill_id),
    yea: r.yea == null ? null : n(r.yea),
    nay: r.nay == null ? null : n(r.nay),
  }))
}
