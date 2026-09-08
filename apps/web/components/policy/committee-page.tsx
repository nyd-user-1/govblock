"use client"

import * as React from "react"
import Link from "next/link"

import { memberHref, stateName } from "@/lib/filters"
import { fmtBill, fmtDate, fmtNumber, honorific, shortDistrict, truncate } from "@/lib/format"
import type { BillRow } from "@/lib/policy/db-queries"
import type { CommitteeRecord, CommunicationRow, HearingRow, MeetingRow, NominationRow, PrintRow, ReportRow, RosterRow } from "@/lib/policy/committee-queries"
import { parentCode } from "@/lib/policy/congress"
import { shortName } from "@/lib/policy/committee-slug"
import { nominationPath } from "@/lib/policy/congress-hrefs"
import { CalendarCard, type CalendarEvent } from "@/components/cards/calendar"
import { CardBlock, type CardSpec } from "@/components/policy/card-block"
import { Chip } from "@/components/chip"
import { ChamberSeal, MemberPortrait } from "@/components/policy/imagery"
import { CommitteeSeats } from "@/components/policy/committee-seats"
import { MemberTabs } from "@/components/policy/member-tabs"
import { PagedList } from "@/components/policy/paged-list"
import { Figure } from "@/components/policy/pending-session"
import { RecordItem, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, H3, Table } from "@/components/typeset"

// One committee, on the member page's design (Brendan, 2026-09-06: "design
// the /committee page"): Summary, the rule, Record with an H3 a part —
// Members, Subcommittees, Bills, Meetings, Reports, Nominations,
// Communications — then History last, as Classification closes the bill page.
// Every block is one the member and bill pages already draw: the registry
// card for a face, the card grid for a committee, the tabs over a paged list,
// the typeset table for a citation. The page loads every family on the server
// and hands the rows in here as props.

const CONGRESS = 119
export type CalendarRow = { date: string; time: string | null; description: string | null; bill_id: number; bill_number: string; title: string }
const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "")
const today = () => new Date().toISOString().slice(0, 10)

export const reportHref = (r: { chamber: string | null; number: string | null; part: number | null }) =>
  `https://www.congress.gov/congressional-report/${CONGRESS}th-congress/${String(r.chamber ?? "house").toLowerCase()}-report/${r.number ?? ""}${r.part ? `/${r.part}` : ""}`
export const communicationHref = (c: CommunicationRow) => `https://www.congress.gov/${String(c.chamber ?? "house").toLowerCase()}-communication/${CONGRESS}th-congress/${(c.type_code ?? "").toUpperCase()}/${c.number ?? ""}`

/* ---- summary ---------------------------------------------------------------- */

export function CommitteeSummary({ record, roster, bills, state, who, hearings, reports }: { record: CommitteeRecord | null; roster: RosterRow[]; bills: number; state: string; who: string; hearings: number; reports: number }) {
  const subs = record?.subcommittees.length ?? 0
  const jurisdiction = state === "US" ? "Congress" : stateName(state)
  return (
    <>
      <p>
        {record?.parent ? (
          <>
            <Chip>{who}</Chip> is a subcommittee of the <Chip>{shortName(record.parent.name)}</Chip> Committee
          </>
        ) : (
          <>
            <Chip>{who}</Chip> is a {record?.type ? record.type.toLowerCase() : ""} committee of the {state === "US" ? `U.S. ${record?.chamber ?? ""}` : `${jurisdiction} ${record?.chamber ?? ""}`}
          </>
        )}
        {subs ? (
          <>
            {" "}
            with {subs} {subs === 1 ? "subcommittee" : "subcommittees"}
          </>
        ) : null}
        {roster.length ? (
          <>
            {subs ? " and" : " with"} {roster.length} members
          </>
        ) : null}
        . It has <Figure>{fmtNumber(bills)}</Figure> {bills === 1 ? "bill" : "bills"} before it this session
        {hearings ? (
          <>
            {reports ? "," : " and"} has held {fmtNumber(hearings)} {hearings === 1 ? "hearing" : "hearings"}
          </>
        ) : null}
        {reports ? (
          <>
            {" "}
            and has filed {fmtNumber(reports)} {reports === 1 ? "report" : "reports"}
          </>
        ) : null}
        .
      </p>
    </>
  )
}

/** The chair's paragraph, under its own H2 after the rule (Brendan, 2026-09-06). */
export function CommitteeChair({ record, roster, state, website }: { record: CommitteeRecord | null; roster: RosterRow[]; state: string; website?: string | null }) {
  const chair = roster.find((r) => /chair/i.test(r.title ?? "") && !/vice/i.test(r.title ?? ""))
  const ranking = roster.find((r) => /ranking/i.test(r.title ?? ""))
  const site = website ?? record?.website ?? null
  if (!chair && !ranking && !site) return null
  // "Rep. Tim Walberg (R-MI)": party and state, no district (Brendan's image).
  const link = (r: RosterRow) => {
    const place = shortDistrict(r.district).split("-")[0]
    const label = `${honorific(r.role, r.chamber)} ${r.name}${r.party ? ` (${[r.party, place].filter(Boolean).join("-")})` : ""}`.trim()
    return <Chip>{label}</Chip>
  }
  return (
    <p>
      {chair && <>Chair: {link(chair)}. </>}
      {ranking && <>Ranking Member: {link(ranking)}. </>}
      {site && (
        <>
          Online at{" "}
          <a href={site} target="_blank" rel="noopener noreferrer">
            {site.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
          .
        </>
      )}
    </p>
  )
}

/* ---- members ---------------------------------------------------------------- */

/** A member on the committee card /docs/committees draws: portrait, name, one line (Brendan, 2026-09-06: "use this for the majority and minority committee members"). */
const cardOf = (r: RosterRow, state: string): CardSpec => ({
  key: r.bioguide_id,
  href: r.people_id ? memberHref(r.people_id, state) : "#",
  title: r.name,
  media: <MemberPortrait name={r.name} photoUrl={r.photo_url} state={state} chamber={r.chamber} size={28} />,
  meta: [[r.party, shortDistrict(r.district)].filter(Boolean).join("–") || null, r.title?.replace(/^Chairman$|^Chairwoman$/, "Chair") ?? "Member"].filter(Boolean).join(" · "),
})

/** The roster: the seating chart, the sentence, then the cards, Majority and Minority tabs where the record says which side. */
export function CommitteeMembers({ roster, state, who, menu }: { roster: RosterRow[]; state: string; who: string; menu?: React.ReactNode }) {
  if (!roster.length) return null
  const majority = roster.filter((r) => r.side === "majority")
  const minority = roster.filter((r) => r.side === "minority")
  const sided = majority.length > 0 && minority.length > 0
  const led = roster.filter((r) => r.title)
  // The majority's colour is its party's: red when the chair is a Republican.
  const majorityEmoji = (majority[0] ?? roster[0])?.party === "D" ? "🟦" : "🟥"
  const minorityEmoji = majorityEmoji === "🟥" ? "🟦" : "🟥"
  return (
    <>
      <H3>Members</H3>
      {sided && <CommitteeSeats roster={roster} state={state} />}
      <p>
        {roster.length} members sit on <Chip>{who}</Chip>
        {sided ? (
          <>
            , {majority.length} in the majority and {minority.length} in the minority
          </>
        ) : null}
        {led.length ? (
          <>
            ;{" "}
            {led.map((r, i) => (
              <React.Fragment key={r.bioguide_id}>
                {i > 0 && (i === led.length - 1 ? " and " : ", ")}
                <Chip>{r.name}</Chip> is {r.title?.replace(/^Chairman$|^Chairwoman$/, "Chair")}
              </React.Fragment>
            ))}
          </>
        ) : null}
        .
      </p>
      {sided ? (
        <PreviewFrame>
          <MemberTabs
            menu={menu}
            tabs={[
              { value: "majority", label: "Majority", emoji: majorityEmoji, count: majority.length, content: <CardBlock framed={false} cards={majority.map((r) => cardOf(r, state))} initial={6} /> },
              { value: "minority", label: "Minority", emoji: minorityEmoji, count: minority.length, content: <CardBlock framed={false} cards={minority.map((r) => cardOf(r, state))} initial={6} /> },
            ]}
          />
        </PreviewFrame>
      ) : (
        <CardBlock cards={roster.map((r) => cardOf(r, state))} initial={6} menu={menu} />
      )}
    </>
  )
}

/* ---- subcommittees ---------------------------------------------------------- */

export function CommitteeSubcommittees({ record, counts, state }: { record: CommitteeRecord | null; counts: Map<string, number>; state: string }) {
  const subs = record?.subcommittees ?? []
  if (!subs.length) return null
  const cards: CardSpec[] = [...subs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const bills = counts.get(s.code)
      return {
        key: s.code,
        href: `/docs/committees/${s.code}`,
        title: s.name,
        media: <ChamberSeal state={state} chamber={record?.chamber} size={28} />,
        meta: bills != null ? `${fmtNumber(bills)} Bills` : "Subcommittee",
      }
    })
  return (
    <>
      <H3>Subcommittees</H3>
      <p>
        The committee's work is divided among {subs.length} {subs.length === 1 ? "subcommittee" : "subcommittees"}.
      </p>
      <CardBlock cards={cards} initial={6} />
    </>
  )
}

/* ---- bills ---------------------------------------------------------------- */

export type CommitteeBillsTab = { status: string; count: number; rows: BillRow[] }

// LegiScan's statuses in the order a bill moves through them; Congress adds
// "In House Committee" and "In Senate Committee" between Introduced and Engrossed.
const STATUS_ORDER = ["Introduced", "In House Committee", "In Senate Committee", "Engrossed", "Enrolled", "Passed", "Vetoed", "Failed"]
const STATUS_EMOJI: Record<string, string> = { Introduced: "📥", "In House Committee": "🏛️", "In Senate Committee": "🏛️", Engrossed: "📤", Enrolled: "📜", Passed: "✅", Vetoed: "🚫", Failed: "❌" }
const inCommittee = (status: string) => status === "Introduced" || /committee/i.test(status)
const rank = (s: string) => {
  const at = STATUS_ORDER.indexOf(s)
  return at < 0 ? STATUS_ORDER.length : at
}

function BillRows({ rows, total, state, more, empty }: { rows: BillRow[]; total: number; state: string; more: (offset: number, limit: number) => Promise<BillRow[]>; empty: string }) {
  return (
    <PagedList
      items={rows}
      total={total}
      more={more}
      pageSize={5}
      empty={empty}
      render={(bill, index) => (
        <RecordItem
          key={bill.bill_id}
          stacked
          hover="rail"
          href={`/docs/bills/${bill.bill_id}`}
          avatar={<RecordSeal state={state} chamber={bill.body} ordinal={index + 1} />}
          title={fmtBill(bill.bill_number, state)}
          lead={bill.last_action}
          meta={[bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.status_desc || "Introduced", bill.sponsor]}
          description={truncate(bill.title, 240)}
        />
      )}
    />
  )
}

/** The bills before the committee this session, a tab per status, paged through the committee-bills resource. */
export function CommitteeBills({ tabs, name, state, session, who, menu }: { tabs: CommitteeBillsTab[]; name: string; state: string; session: number; who: string; menu?: React.ReactNode }) {
  const total = tabs.reduce((sum, t) => sum + t.count, 0)
  const ordered = [...tabs].sort((a, b) => rank(a.status) - rank(b.status) || b.count - a.count)
  const more = (status: string) => async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/committee-bills?state=${state}&session=${session}&name=${encodeURIComponent(name)}&status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: BillRow[] }
    return data.rows ?? []
  }
  const held = ordered.filter((t) => inCommittee(t.status)).reduce((sum, t) => sum + t.count, 0)
  return (
    <>
      <H3>Bills</H3>
      <p>
        <Figure>{fmtNumber(total)}</Figure> {total === 1 ? "bill has" : "bills have"} been referred to <Chip>{who}</Chip> this session
        {held && total > held ? (
          <>
            , and <Figure>{fmtNumber(held)}</Figure> of them {held === 1 ? "is" : "are"} still in committee
          </>
        ) : null}
        .
      </p>
      <PreviewFrame>
        {ordered.length > 1 ? (
          <MemberTabs
            menu={menu}
            tabs={ordered.slice(0, 6).map((t) => ({
              value: t.status.toLowerCase(),
              label: t.status,
              emoji: STATUS_EMOJI[t.status] ?? "📄",
              count: t.count,
              content: <BillRows rows={t.rows} total={t.count} state={state} more={more(t.status)} empty={`Nothing ${t.status.toLowerCase()} before ${who} this session.`} />,
            }))}
          />
        ) : (
          <>
            {menu && <div className="flex items-center pb-4">{menu}</div>}
            <BillRows rows={ordered[0]?.rows ?? []} total={ordered[0]?.count ?? 0} state={state} more={more(ordered[0]?.status ?? "")} empty={`No bills before ${who} this session.`} />
          </>
        )}
      </PreviewFrame>
    </>
  )
}

/* ---- meetings and hearings ------------------------------------------------ */

/** An ISO instant as the calendar's date and time, in the Capitol's zone. */
function eastern(iso: string | null): { date: string; time: string | null } {
  if (!iso) return { date: "", time: null }
  if (!iso.includes("T")) return { date: iso.slice(0, 10), time: null }
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return { date: iso.slice(0, 10), time: null }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}` }
}

/** What the calendar needs of a meeting; the witnesses and papers stay on the meeting's own page. */
export type MeetingLite = Pick<MeetingRow, "event_id" | "date" | "title" | "type" | "committee_code" | "committee_name">

// Federal by construction — the committee page renders it only under Congress —
// so a calendared bill is cited the way congress.gov cites it.
export function CommitteeMeetings({ meetings, hearings, calendar, who }: { meetings: MeetingLite[]; hearings: HearingRow[]; calendar: CalendarRow[]; who: string }) {
  const now = today()
  // Every meeting on its date in the home page's Calendar card, as Brendan
  // gave it (2026-09-06: "there's no upcoming/held tab, it's just placed on
  // its date"). A meeting ahead adds to the reader's calendar on hover; one
  // already held opens its record. A printed transcript whose meeting is on
  // the calendar rides with the meeting; one without sits on its own date.
  const dated = meetings.filter((m) => m.date)
  const meetingDays = new Set(dated.map((m) => `${parentCode(m.committee_code)}|${day(m.date)}`))
  const events: CalendarEvent[] = [
    ...dated.map((m) => {
      const at = eastern(m.date)
      const past = at.date < now
      return { id: `m-${m.event_id}`, ...at, description: m.title ?? m.type ?? "Meeting", href: `/docs/meetings/${m.event_id}`, badge: m.type ?? null, committee: m.committee_name, action: past ? ("open" as const) : ("calendar" as const) }
    }),
    ...hearings
      .filter((h) => h.date && !meetingDays.has(`${parentCode(h.committee_code)}|${day(h.date)}`))
      .map((h) => ({
        id: `h-${h.key}`,
        date: day(h.date),
        time: null,
        description: h.title ?? h.citation ?? `Hearing ${h.number ?? ""}`,
        href: `/docs/hearings/${h.jacket}`,
        badge: "Transcript",
        committee: h.committee_name,
        action: "open" as const,
      })),
    ...calendar.map((c) => ({
      id: `c-${c.bill_id}-${c.date}`,
      date: day(c.date),
      time: c.time,
      description: c.description ?? who,
      href: `/docs/bills/${c.bill_id}`,
      badge: fmtBill(c.bill_number, "US"),
      committee: who,
      action: day(c.date) < now ? ("open" as const) : ("calendar" as const),
    })),
  ]
  if (!events.length) return null
  const ahead = events.filter((e) => e.date >= now).length
  return (
    <>
      <H3>Meetings</H3>
      <p>
        <Chip>{who}</Chip> has {fmtNumber(events.length)} {events.length === 1 ? "meeting" : "meetings"} on the calendar
        {ahead ? <>, {fmtNumber(ahead)} of them ahead</> : null}.
      </p>
      <CalendarCard events={events} />
    </>
  )
}

/* ---- a state committee's hearings, from the calendar ---------------------- */

export function CommitteeCalendar({ rows, who, state, chamber }: { rows: CalendarRow[]; who: string; state: string; chamber: string }) {
  if (!rows.length) return null
  return (
    <>
      <H3>Hearings</H3>
      <p>
        {fmtNumber(rows.length)} {rows.length === 1 ? "bill has" : "bills have"} come before <Chip>{who}</Chip> in a hearing this session.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          pageSize={5}
          render={(row, index) => (
            <RecordItem
              key={`${row.bill_id}-${row.date}-${index}`}
              stacked
              hover="rail"
              href={`/docs/bills/${row.bill_id}`}
              avatar={<RecordSeal state={state} chamber={chamber} ordinal={index + 1} />}
              title={fmtBill(row.bill_number, state)}
              lead={row.description}
              meta={[row.date ? fmtDate(row.date) : null, row.time]}
              description={truncate(row.title, 240)}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

/* ---- reports and prints --------------------------------------------------- */

export function CommitteeReports({ reports, prints, who }: { reports: ReportRow[]; prints: PrintRow[]; who: string }) {
  if (!reports.length && !prints.length) return null
  const reportTable = (
    <Table>
      <thead>
        <tr>
          <th className="w-[22%]">Citation</th>
          <th className="w-[46%]">Title</th>
          <th className="w-[16%]">Bill</th>
          <th className="w-[16%] pr-8 text-right">Issued</th>
        </tr>
      </thead>
      <tbody>
        {reports.slice(0, 100).map((r) => (
          <tr key={r.key}>
            <td>
              <a href={reportHref(r)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap">
                {r.citation ?? "—"}
              </a>
            </td>
            <td>{truncate(r.title ?? "", 140) || "—"}</td>
            <td className="whitespace-nowrap">{r.bill_id ? <Link href={`/docs/bills/${r.bill_id}`}>{fmtBill(r.bill_number, "US")}</Link> : "—"}</td>
            <td className="pr-8 text-right whitespace-nowrap tabular-nums">{r.issued ? fmtDate(r.issued) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
  const printTable = (
    <Table>
      <thead>
        <tr>
          <th className="w-[22%]">Citation</th>
          <th className="w-[62%]">Title</th>
          <th className="w-[16%] pr-8 text-right">Bills</th>
        </tr>
      </thead>
      <tbody>
        {prints.slice(0, 100).map((p) => (
          <tr key={p.key}>
            <td className="whitespace-nowrap">{p.citation ?? `Jacket ${p.jacket}`}</td>
            <td>{truncate(p.title ?? "", 140) || "—"}</td>
            <td className="pr-8 text-right whitespace-nowrap">{p.bills.length ? p.bills.map((b) => `${b.type ?? ""} ${b.number ?? ""}`.trim()).join(", ") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
  return (
    <>
      <H3>Reports</H3>
      <p>
        <Chip>{who}</Chip> has filed {fmtNumber(reports.length)} {reports.length === 1 ? "report" : "reports"}
        {prints.length ? (
          <>
            {" "}
            and issued {fmtNumber(prints.length)} {prints.length === 1 ? "print" : "prints"}
          </>
        ) : null}{" "}
        this Congress.
      </p>
      {prints.length ? (
        <PreviewFrame>
          <MemberTabs
            tabs={[
              { value: "reports", label: "Reports", emoji: "📑", count: reports.length, content: <div className="typeset">{reportTable}</div> },
              { value: "prints", label: "Prints", emoji: "🖨️", count: prints.length, content: <div className="typeset">{printTable}</div> },
            ]}
          />
        </PreviewFrame>
      ) : (
        reportTable
      )}
    </>
  )
}

/* ---- nominations ---------------------------------------------------------- */

export function CommitteeNominations({ rows, total, code, who, state }: { rows: NominationRow[]; total: number; code: string; who: string; state: string }) {
  if (!total) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/committee-nominations?state=US&committee=${code}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: NominationRow[] }
    return data.rows ?? []
  }
  return (
    <>
      <H3>Nominations</H3>
      <p>
        {fmtNumber(total)} {total === 1 ? "nomination has" : "nominations have"} been referred to <Chip>{who}</Chip> this Congress.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          total={total}
          more={more}
          pageSize={5}
          render={(r, index) => (
            <RecordItem
              key={r.key}
              stacked
              hover="rail"
              href={nominationPath(r)}
              avatar={<RecordSeal state={state} chamber="Senate" ordinal={index + 1} />}
              title={r.citation ?? r.key}
              lead={r.latest_action}
              meta={[r.received ? `Received ${fmtDate(r.received)}` : null, r.organization]}
              description={truncate(r.description ?? "", 240)}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

/* ---- communications ------------------------------------------------------- */

export function CommitteeCommunications({ rows, total, code, who, state }: { rows: CommunicationRow[]; total: number; code: string; who: string; state: string }) {
  if (!total) return null
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/committee-communications?state=US&committee=${code}&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: CommunicationRow[] }
    return data.rows ?? []
  }
  return (
    <>
      <H3>Communications</H3>
      <p>
        {fmtNumber(total)} executive communications, petitions and memorials have been referred to <Chip>{who}</Chip> this Congress.
      </p>
      <PreviewFrame>
        <PagedList
          items={rows}
          total={total}
          more={more}
          pageSize={5}
          render={(c, index) => (
            <RecordItem
              key={c.key}
              stacked
              hover="rail"
              external
              href={communicationHref(c)}
              avatar={<RecordSeal state={state} chamber={c.chamber} ordinal={index + 1} />}
              title={`${(c.type_code ?? "").toUpperCase()} ${c.number ?? ""}`.trim() || c.key}
              lead={c.type}
              meta={[c.referred ? `Referred ${fmtDate(c.referred)}` : null]}
              description={c.abstract ? truncate(c.abstract, 240) : "The abstract lands with tonight's harvest."}
            />
          )}
        />
      </PreviewFrame>
    </>
  )
}

/* ---- history ---------------------------------------------------------------- */

export function CommitteeHistory({ record }: { record: CommitteeRecord | null }) {
  const rows = [...(record?.history ?? [])].sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))
  if (!rows.length) return null
  const first = rows[rows.length - 1]
  return (
    <>
      <hr />
      <H2>History</H2>
      <p>
        The committee has carried {rows.length} {rows.length === 1 ? "name" : "names"}
        {first?.startDate ? <> since {fmtDate(first.startDate)}</> : null}
        {first?.authority ? (
          <>
            , established by <Chip>{first.authority}</Chip>
          </>
        ) : null}
        .
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[46%]">Name</th>
            <th className="w-[18%]">From</th>
            <th className="w-[18%]">To</th>
            <th className="w-[18%] pr-8 text-right">Authority</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={`${h.officialName}-${i}`}>
              <td>{h.officialName ?? "—"}</td>
              <td className="whitespace-nowrap tabular-nums">{h.startDate ? fmtDate(h.startDate) : "—"}</td>
              <td className="whitespace-nowrap tabular-nums">{h.endDate ? fmtDate(h.endDate) : "Present"}</td>
              <td className="pr-8 text-right whitespace-nowrap">{h.authority ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

/* ---- the rail's contents ----------------------------------------------------- */

export function CommitteeToc({ parts, history }: { parts: string[]; history: boolean }) {
  const toc = [
    { title: "Summary", url: "#summary", depth: 2 },
    { title: "Chair", url: "#chair", depth: 2 },
    ...parts.map((title) => ({ title, url: `#${title.replace(/\s+/g, "-").toLowerCase()}`, depth: 3 })),
    ...(history ? [{ title: "History", url: "#history", depth: 2 }] : []),
  ]
  return <DocsTableOfContents toc={toc} />
}
