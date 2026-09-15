import "server-only"

import { resolveLink, type StudioData } from "@/components/clips/studio/spec"
import { stateName } from "@/lib/filters"
import { fmtBill } from "@/lib/format"
import { n, one, q } from "@/lib/policy/db"
import { getBill } from "@/lib/policy/db-queries"
import { billHistoryProps, rollCallTallyProps } from "@/lib/clips/templates"

// What a pasted link gives a Studio template (2026-09-14): named values for
// {field} slots, the lists a timeline or bar scene reads, and for a roll call
// or a bill the whole props of the first two templates. A roll call, a
// session's roll calls (a chamber), a bill, a member, a federal committee, a
// state, or a party.

type Keys = { bill_key: string | null; roll_call_chamber?: string; roll_call_key?: string | null }
export type Found = { data: StudioData; keys: Keys }

const PARTY: Record<string, string> = { R: "Republicans", D: "Democrats", I: "Independents", ID: "Independents" }
const PARTY_ONE: Record<string, string> = { R: "Republican", D: "Democrat", I: "Independent", Republican: "Republican", Democratic: "Democrat", Independent: "Independent" }
const day = (iso: string | null | undefined) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "")
const pct = (part: number, whole: number) => (whole ? String(Math.round((part / whole) * 100)) : "0")
const num = (v: number) => v.toLocaleString("en-US")
const CONGRESS = 119
const YES = `('Yea', 'Aye')`
const NO = `('Nay', 'No')`

/** The vote tables for a chamber: the roll calls, their positions, and how a position joins its roll call. */
const TABLES = {
  house: { votes: "congress_house_votes", positions: "congress_house_vote_positions", join: "p.vote_identifier = v.identifier", date: "left(v.start_date, 10)", result: "v.result" },
  senate: { votes: "congress_senate_votes", positions: "congress_senate_vote_positions", join: "p.vote_key = v.key", date: "to_char(v.vote_date, 'YYYY-MM-DD')", result: "v.vote_result" },
}

/** Each split roll call of a congress in a chamber, and which way the Republican majority went. */
const splitVotes = (chamber: "house" | "senate") => {
  const t = TABLES[chamber]
  return `
    with t as (
      select v.key id,
             count(*) filter (where p.vote_party = 'R' and p.vote_cast in ${YES}) ry, count(*) filter (where p.vote_party = 'R' and p.vote_cast in ${NO}) rn,
             count(*) filter (where p.vote_party = 'D' and p.vote_cast in ${YES}) dy, count(*) filter (where p.vote_party = 'D' and p.vote_cast in ${NO}) dn
        from ${t.votes} v join ${t.positions} p on ${t.join}
       where v.congress = $1 group by 1),
    pl as (select id, ry > rn as r_yes from t where (ry > rn and dn > dy) or (rn > ry and dy > dn))`
}

const crossedExpr = `count(*) filter (where p.vote_cast in ('Yea', 'Aye', 'Nay', 'No') and (p.vote_cast in ('Yea', 'Aye')) = (case when p.vote_party = 'R' then not pl.r_yes else pl.r_yes end))::int`

async function rollCall(t: Extract<ReturnType<typeof resolveLink>, { kind: "roll-call" }>): Promise<Found | null> {
  const found = await rollCallTallyProps({ chamber: t.chamber, congress: t.congress, session: t.session, roll: t.roll })
  if (!found) return null
  const p = found.props
  return {
    data: {
      kind: "roll-call",
      link: `${p.chamber}-${p.congress}-${p.session}/${p.roll}`,
      label: `${p.chamber === "senate" ? "Senate" : "House"} roll call ${p.roll}`,
      fields: {
        chamber: p.chamber === "senate" ? "Senate" : "House",
        roll: String(p.roll),
        congress: String(p.congress),
        session: String(p.session),
        date: day(p.date),
        citation: p.citation ?? `${p.chamber === "senate" ? "Senate" : "House"} roll call ${p.roll}`,
        title: p.billTitle ?? "",
        question: p.question ?? "",
        result: p.result ?? "",
        yea: String(p.counts.yea),
        nay: String(p.counts.nay),
        present: String(p.counts.present),
        notVoting: String(p.counts.notVoting),
      },
      lists: { bars: p.parties.map((r) => ({ label: PARTY[r.party] ?? r.party, yes: r.yea, no: r.nay })) },
      raw: { tally: p },
    },
    keys: found.keys,
  }
}

async function bill(billId: number): Promise<Found | null> {
  const [history, full] = await Promise.all([billHistoryProps(billId), getBill(billId)])
  if (!history || !full) return null
  const p = history.props
  const first = p.milestones[0]
  const last = p.milestones[p.milestones.length - 1]
  const lead = full.sponsors.find((s) => Number(s.type) === 1) ?? full.sponsors[0]
  const cosponsors = full.sponsors.filter((s) => Number(s.type) !== 1)
  const byParty = new Map<string, number>()
  for (const s of cosponsors) byParty.set(s.party || "—", (byParty.get(s.party || "—") ?? 0) + 1)
  const across = lead ? cosponsors.filter((s) => s.party && s.party !== lead.party).length : 0
  return {
    data: {
      kind: "bill",
      link: `/bills/${billId}`,
      label: p.citation,
      fields: {
        citation: p.citation,
        title: p.title,
        sponsor: p.sponsor ?? "",
        cosponsors: num(cosponsors.length),
        acrossTheAisle: num(across),
        law: p.law ?? "",
        status: full.status_desc ?? "",
        chamber: first?.chamber ?? "",
        introduced: day(first?.date),
        latestAction: last?.action ?? "",
        latestDate: day(last?.date),
      },
      lists: {
        timeline: p.milestones,
        bars: [...byParty.entries()].sort((a, b) => b[1] - a[1]).map(([party, count]) => ({ label: PARTY[party] ?? party, yes: count })),
      },
      raw: { history: p },
    },
    keys: history.keys,
  }
}

async function member(peopleId: number): Promise<Found | null> {
  const person = await one<{ name: string; party: string | null; role: string | null; district: string | null; photo_url: string | null; bioguide_id: string | null; mname: string | null; portrait_url: string | null; mstate: string | null }>(
    `select p.name, p.party, p.role, p.district, p.photo_url, p.bioguide_id, m.name mname, m.portrait_url, m.state mstate
       from "People" p left join congress_members m on m.bioguide_id = p.bioguide_id
      where p.people_id = $1 limit 1`,
    [peopleId]
  )
  if (!person) return null
  const bio = person.bioguide_id
  const chamber: "house" | "senate" = /sen/i.test(person.role ?? "") ? "senate" : "house"
  const t = TABLES[chamber]
  const [sponsored, recent, votes, crossed] = await Promise.all([
    bio ? one<{ total: number; laws: number }>(`select count(*)::int total, count(*) filter (where latest_action ilike 'Became Public Law%')::int laws from congress_member_sponsored where bioguide_id = $1 and congress = $2`, [bio, CONGRESS]) : null,
    bio ? q<{ introduced_date: string; bill_type: string; number: string; title: string }>(`select introduced_date, bill_type, number, title from congress_member_sponsored where bioguide_id = $1 and congress = $2 order by introduced_date desc nulls last limit 6`, [bio, CONGRESS]) : [],
    bio ? one<{ cast: number; missed: number }>(`select count(*) filter (where p.vote_cast in ('Yea', 'Aye', 'Nay', 'No'))::int cast, count(*) filter (where p.vote_cast = 'Not Voting')::int missed from ${t.positions} p join ${t.votes} v on ${t.join} where p.bioguide_id = $1 and v.congress = $2`, [bio, CONGRESS]) : null,
    bio ? one<{ crossed: number; cast: number }>(`${splitVotes(chamber)} select ${crossedExpr} crossed, count(*) filter (where p.vote_cast in ('Yea', 'Aye', 'Nay', 'No'))::int cast from pl join ${t.positions} p on p.${chamber === "house" ? "vote_identifier" : "vote_key"} = pl.id where p.bioguide_id = $2`, [CONGRESS, bio]) : null,
  ])
  const display = person.mname && person.mname.includes(", ") ? `${person.mname.split(", ")[1]} ${person.mname.split(", ")[0]}` : person.name
  const castAll = n(votes?.cast)
  const missed = n(votes?.missed)
  return {
    data: {
      kind: "member",
      link: `/members/${peopleId}`,
      label: display,
      fields: {
        name: display,
        party: PARTY_ONE[person.party ?? ""] ?? person.party ?? "",
        chamber: chamber === "senate" ? "Senate" : "House",
        title: chamber === "senate" ? "Senator" : "Representative",
        district: (person.district ?? "").replace(/^[A-Z]+-/, ""),
        state: stateName(person.mstate ?? "") || (person.mstate ?? ""),
        photo: person.portrait_url || person.photo_url || "",
        sponsored: num(n(sponsored?.total)),
        becameLaw: num(n(sponsored?.laws)),
        votesCast: num(castAll),
        missed: num(missed),
        missedPct: pct(missed, castAll + missed),
        crossed: num(n(crossed?.crossed)),
        crossedPct: pct(n(crossed?.crossed), n(crossed?.cast)),
      },
      lists: { timeline: recent.map((b) => ({ date: String(b.introduced_date ?? "").slice(0, 10), chamber: `${b.bill_type} ${b.number}`, action: b.title })) },
    },
    keys: { bill_key: null },
  }
}

async function committee(code: string): Promise<Found | null> {
  const c = await one<{ name: string; chamber: string }>(`select name, chamber from congress_committees where system_code = $1 order by congress desc limit 1`, [code])
  if (!c) return null
  const [roster, meetings, hearings] = await Promise.all([
    q<{ title: string | null; party: string | null; name: string | null }>(`select c.title, c.party, m.name from congress_committee_members c left join congress_members m on m.bioguide_id = c.bioguide_id where c.system_code = $1`, [code]),
    q<{ meeting_date: string; title: string; total: number }>(`select meeting_date, title, count(*) over ()::int as total from congress_committee_meetings where congress = $1 and payload->'committees' @> $2::jsonb order by meeting_date desc limit 6`, [CONGRESS, JSON.stringify([{ systemCode: code }])]),
    one<{ count: number }>(`select count(*)::int count from congress_hearings where committee_code = $1 and congress = $2`, [code, CONGRESS]),
  ])
  const flip = (name: string | null | undefined) => (name && name.includes(", ") ? `${name.split(", ")[1]} ${name.split(", ")[0]}` : (name ?? ""))
  const chair = roster.find((r) => r.title === "Chair" || r.title === "Chairman")
  const ranking = roster.find((r) => r.title === "Ranking Member")
  const majority = roster.filter((r) => r.party === "majority").length
  const minority = roster.filter((r) => r.party === "minority").length
  return {
    data: {
      kind: "committee",
      link: `/committees/${code}`,
      label: c.name,
      fields: {
        name: c.name,
        chamber: c.chamber,
        chair: flip(chair?.name),
        rankingMember: flip(ranking?.name),
        members: num(roster.length),
        majority: num(majority),
        minority: num(minority),
        meetings: num(n(meetings[0]?.total)),
        hearings: num(n(hearings?.count)),
      },
      lists: {
        timeline: meetings.slice(0, 6).map((m) => ({ date: String(m.meeting_date).slice(0, 10), chamber: null, action: String(m.title).replace(/^"|"$/g, "") })),
        bars: [
          { label: "Majority", yes: majority },
          { label: "Minority", yes: minority },
        ],
      },
    },
    keys: { bill_key: null },
  }
}

async function party(p: "R" | "D", chamber: "house" | "senate"): Promise<Found | null> {
  const t = TABLES[chamber]
  const partyName = p === "R" ? "Republican" : "Democratic"
  const [seats, crossers, laws] = await Promise.all([
    one<{ seats: number; total: number }>(
      `select count(*) filter (where party = $1)::int seats, count(*)::int total from congress_members where current_member in ('true', 't', 'True') and ${chamber === "senate" ? "(district is null or district = '')" : "(district is not null and district <> '')"}`,
      [partyName]
    ),
    q<{ name: string; crossed: number; cast: number }>(
      `${splitVotes(chamber)}
       select coalesce(max(case when m.name like '%, %' then split_part(m.name, ', ', 2) || ' ' || split_part(m.name, ', ', 1) else m.name end), max(p.last_name)) name,
              ${crossedExpr} crossed, count(*) filter (where p.vote_cast in ('Yea', 'Aye', 'Nay', 'No'))::int cast
         from pl join ${t.positions} p on p.${chamber === "house" ? "vote_identifier" : "vote_key"} = pl.id
         left join congress_members m on m.bioguide_id = p.bioguide_id
        where p.vote_party = $2 group by p.bioguide_id order by 2 desc`,
      [CONGRESS, p]
    ),
    one<{ laws: number; sponsored: number }>(`select count(*) filter (where latest_action ilike 'Became Public Law%')::int laws, count(*)::int sponsored from congress_bills where congress = $1 and sponsor_party = $2`, [CONGRESS, p]),
  ])
  const crossedAll = crossers.reduce((s, r) => s + n(r.crossed), 0)
  const castAll = crossers.reduce((s, r) => s + n(r.cast), 0)
  const label = `${PARTY[p]} in the ${chamber === "senate" ? "Senate" : "House"}`
  return {
    data: {
      kind: "party",
      link: `/party/${p.toLowerCase()}-${chamber}`,
      label,
      fields: {
        party: PARTY[p],
        chamber: chamber === "senate" ? "Senate" : "House",
        congress: String(CONGRESS),
        seats: num(n(seats?.seats)),
        ofSeats: num(n(seats?.total)),
        unity: String(100 - Number(pct(crossedAll, castAll))),
        crossings: num(crossedAll),
        sponsored: num(n(laws?.sponsored)),
        becameLaw: num(n(laws?.laws)),
        topCrosser: crossers[0]?.name ?? "",
        topCrossings: num(n(crossers[0]?.crossed)),
      },
      lists: { bars: crossers.slice(0, 5).map((r) => ({ label: r.name, yes: n(r.cast) - n(r.crossed), no: n(r.crossed) })) },
    },
    keys: { bill_key: null },
  }
}

async function chamber(t: Extract<ReturnType<typeof resolveLink>, { kind: "chamber" }>): Promise<Found | null> {
  const tb = TABLES[t.chamber]
  const [totals, months, split] = await Promise.all([
    one<{ votes: number; passed: number; failed: number; first: string | null; last: string | null }>(
      `select count(*)::int votes,
              count(*) filter (where ${tb.result} ~* '^(passed|agreed|confirmed|adopted)')::int passed,
              count(*) filter (where ${tb.result} ~* '^(failed|rejected|not)')::int failed,
              min(${tb.date}) as first, max(${tb.date}) as last
         from ${tb.votes} v where v.congress = $1 and v.session_number = $2`,
      [t.congress, String(t.session)]
    ),
    q<{ month: string; votes: number }>(`select left(${tb.date}, 7) as month, count(*)::int as votes from ${tb.votes} v where v.congress = $1 and v.session_number = $2 group by 1 order by 1`, [t.congress, String(t.session)]),
    one<{ split: number }>(`${splitVotes(t.chamber)} select count(*)::int split from pl join ${tb.votes} v on v.key = pl.id where v.session_number = $2`, [t.congress, String(t.session)]),
  ])
  if (!totals || !n(totals.votes)) return null
  const busiest = [...months].sort((a, b) => n(b.votes) - n(a.votes))[0]
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
  return {
    data: {
      kind: "chamber",
      link: `${t.chamber}-${t.congress}-${t.session}`,
      label: `${t.chamber === "senate" ? "Senate" : "House"}, ${t.congress}th Congress, session ${t.session}`,
      fields: {
        chamber: t.chamber === "senate" ? "Senate" : "House",
        congress: String(t.congress),
        session: String(t.session),
        rollCalls: num(n(totals.votes)),
        passed: num(n(totals.passed)),
        failed: num(n(totals.failed)),
        split: num(n(split?.split)),
        splitPct: pct(n(split?.split), n(totals.votes)),
        first: day(totals.first),
        last: day(totals.last),
        busiestMonth: busiest ? monthName(busiest.month) : "",
        busiestCount: num(n(busiest?.votes)),
      },
      lists: { bars: months.slice(-8).map((m) => ({ label: monthName(m.month), yes: n(m.votes) })) },
    },
    keys: { bill_key: null },
  }
}

async function state(code: string): Promise<Found | null> {
  const session = await one<{ session_id: number; title: string | null }>(`select session_id, max(session_title) title from "Bills" where state = $1 group by 1 order by 1 desc limit 1`, [code])
  if (!session) return null
  const [stages, laws] = await Promise.all([
    q<{ status: string; count: number }>(`select coalesce(status_desc, 'Unknown') status, count(*)::int count from "Bills" where state = $1 and session_id = $2 group by 1 order by 2 desc`, [code, session.session_id]),
    q<{ bill_number: string; title: string; last_action_date: string | null }>(
      `select bill_number, title, last_action_date from "Bills" where state = $1 and session_id = $2 and status_desc ~* '^(signed|chaptered|enacted|approved by governor)' order by last_action_date desc nulls last limit 6`,
      [code, session.session_id]
    ),
  ])
  const total = stages.reduce((s, r) => s + n(r.count), 0)
  const count = (re: RegExp) => stages.filter((r) => re.test(r.status)).reduce((s, r) => s + n(r.count), 0)
  const signed = count(/^(signed|chaptered|enacted|approved by governor)/i)
  const vetoed = count(/veto/i)
  const passed = count(/passed|enrolled|engrossed/i)
  return {
    data: {
      kind: "state",
      link: `/state/${code.toLowerCase()}`,
      label: `${stateName(code)}, ${session.title ?? session.session_id}`,
      fields: {
        state: stateName(code),
        session: session.title ?? String(session.session_id),
        bills: num(total),
        signed: num(signed),
        vetoed: num(vetoed),
        passedOneChamber: num(passed),
        signedPct: pct(signed, total),
      },
      lists: {
        bars: stages.slice(0, 6).map((r) => ({ label: r.status, yes: n(r.count) })),
        timeline: laws.map((b) => ({ date: String(b.last_action_date ?? "").slice(0, 10), chamber: fmtBill(b.bill_number, code), action: b.title })),
      },
    },
    keys: { bill_key: null },
  }
}

export async function studioData(link: string): Promise<Found | null> {
  const target = resolveLink(link)
  if (!target) return null
  switch (target.kind) {
    case "roll-call":
      return rollCall(target)
    case "bill":
      return bill(target.billId)
    case "member":
      return member(target.peopleId)
    case "committee":
      return committee(target.code)
    case "party":
      return party(target.party, target.chamber)
    case "chamber":
      return chamber(target)
    case "state":
      return state(target.state)
  }
}
