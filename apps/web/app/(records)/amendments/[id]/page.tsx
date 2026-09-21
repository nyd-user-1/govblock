import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, shortDistrict } from "@/lib/format"
import { citationOf, congressGovHref } from "@/lib/policy/congress"
import { getAmendment, getAmendmentActions, getAmendmentCosponsors, getAmendmentNeighbours, getAmendmentTexts, getPeopleByBioguide } from "@/lib/policy/committee-queries"
import type { MemberCardRow } from "@/components/policy/member-card"
import { DocsPage } from "@/components/docs-page"
import { RecordFacts } from "@/components/record-header"
import { amendmentPath, fmtAmendment } from "@/lib/policy/congress-hrefs"
import { AmendmentActions, AmendmentSponsors, AmendmentTextBlock, AmendmentToc } from "@/components/policy/amendment-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One amendment, by "samdt-5512". On DocsPage since 2026-09-20 (Brendan):
// the shell draws the head, the arrows, Copy Page and the rail it had a copy
// of, and the facts are its sub-header.

export const revalidate = 3600

const STATE = "US"

async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("amendment: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

// An amendment amends a federal bill, so the bill it names is cited the way
// congress.gov cites it: "S. 2", never LegiScan's "SB 2".
const billLabel = (type: string | null, number: string | null) => citationOf(type, number)

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const amendment = await safe(() => getAmendment(id), null)
  if (!amendment) return { title: "Amendment" }
  return { title: fmtAmendment(amendment.type, amendment.number), description: amendment.purpose ?? amendment.description ?? "An amendment before Congress." }
}

export default async function AmendmentRoute({ params }: Props) {
  const { id } = await params
  const amendment = await safe(() => getAmendment(id), null)
  if (!amendment) notFound()
  const [actions, cosponsors, texts, neighbours] = await Promise.all([
    safe(() => getAmendmentActions(amendment.key), []),
    safe(() => getAmendmentCosponsors(amendment.key), []),
    safe(() => getAmendmentTexts(amendment.key), []),
    safe(() => getAmendmentNeighbours(amendment.key), { previous: null, next: null }),
  ])
  const people = await safe(() => getPeopleByBioguide([...amendment.sponsors.map((s) => s.bioguide_id ?? ""), ...cosponsors.map((c) => c.bioguide_id ?? "")]), new Map())
  const name = fmtAmendment(amendment.type, amendment.number)
  const chamber = amendment.chamber ?? (amendment.type.toUpperCase().startsWith("S") ? "Senate" : "House")
  const bill = amendment.bill
  const billName = bill ? billLabel(bill.type, bill.number) : null

  const card = (row: { bioguide_id: string | null; name: string | null; party: string | null; state: string | null; district?: string | null }, role: string, detail: string | null): MemberCardRow => {
    const p = row.bioguide_id ? people.get(row.bioguide_id.toUpperCase()) : undefined
    return {
      id: `${role}-${row.bioguide_id ?? row.name}`,
      name: p?.name ?? row.name ?? "—",
      href: p ? memberHref(p.people_id, STATE) : null,
      photo: p?.photo_url ?? null,
      chamber: p?.chamber ?? chamber,
      line: [p ? honorific(p.role, p.chamber) : null, [row.party, p?.district ? shortDistrict(p.district) : [row.state, row.district].filter(Boolean).join("-")].filter(Boolean).join("–"), role].filter(Boolean).join(" · "),
      detail,
    }
  }
  const sponsorRows: MemberCardRow[] = [
    ...amendment.sponsors.map((s) => card(s, "Sponsor", amendment.submitted ? `Submitted ${fmtDate(amendment.submitted)}` : null)),
    ...cosponsors.map((c) => card(c, "Co-sponsor", [c.joined ? `Joined ${fmtDate(c.joined)}` : null, c.original ? "Original" : null].filter(Boolean).join(" · ") || null)),
  ]
  const sponsor = amendment.sponsors[0]
  const sponsorPerson = sponsor?.bioguide_id ? people.get(sponsor.bioguide_id.toUpperCase()) : undefined
  const who = sponsor
    ? `${sponsorPerson ? honorific(sponsorPerson.role, sponsorPerson.chamber) : chamber === "Senate" ? "Sen." : "Rep."} ${sponsorPerson?.name ?? sponsor.name ?? ""}${sponsor.party ? ` (${sponsor.party}${sponsor.state ? `-${sponsor.state}` : ""})` : ""}`.trim()
    : null

  const facts = [
    `U.S. ${chamber}`,
    billName ? bill?.id ? <Link key="b" href={`/bills/${bill.id}`} className="hover:underline">{`Amends ${billName}`}</Link> : `Amends ${billName}` : null,
    amendment.amends ? `Amends ${fmtAmendment(amendment.amends.type ?? "", amendment.amends.number ?? "")}` : null,
  ]
  const source = congressGovHref("amendment", amendment.type, amendment.number, amendment.congress)
  const markdown = [`# ${name}`, "", amendment.purpose ?? amendment.description ?? "", "", amendment.latest_action ?? ""].join("\n")
  const parts = ["Text"]
  if (sponsorRows.length) parts.push("Sponsors")
  if (actions.length) parts.push("Actions")

  const pathOf = (n: NonNullable<typeof neighbours.previous>) => amendmentPath(n.amendment_type, n.number)

  return (
    <DocsPage
      title={name}
      description={amendment.purpose ?? amendment.description ?? "An amendment before Congress."}
      page={markdown}
      lead={<RecordFacts meta={facts} />}
      slug={amendmentPath(amendment.type, amendment.number)}
      previous={neighbours.previous ? { name: fmtAmendment(neighbours.previous.amendment_type, neighbours.previous.number), url: pathOf(neighbours.previous) } : { name: "Amendments", url: "/amendments" }}
      next={neighbours.next ? { name: fmtAmendment(neighbours.next.amendment_type, neighbours.next.number), url: pathOf(neighbours.next) } : undefined}
      rail={<AmendmentToc parts={parts} />}
    >
      <H2>Summary</H2>
      <p>
        {who ? (
          <>
            <Chip>{who}</Chip> offered <Chip>{name}</Chip>
          </>
        ) : (
          <>
            <Chip>{name}</Chip> was offered
          </>
        )}
        {billName ? (
          <>
            {" "}
            to <Chip>{billName}</Chip>
            {bill?.title ? <>, the {bill.title.replace(/\.$/, "")},</> : null}
          </>
        ) : null}
        {amendment.submitted ? <> on {fmtDate(amendment.submitted)}</> : null}
        {amendment.purpose ? <> {amendment.purpose.charAt(0).toLowerCase() + amendment.purpose.slice(1).replace(/\.$/, "")}</> : null}.
      </p>
      {amendment.latest_action && (
        <p>
          {amendment.latest_action_date ? (
            <>
              On {fmtDate(amendment.latest_action_date)}: {amendment.latest_action}
            </>
          ) : (
            amendment.latest_action
          )}
        </p>
      )}
      {amendment.description && amendment.description !== amendment.purpose && <p>{amendment.description}</p>}

      <hr />
      <H2>Record</H2>
      <p>
        <Chip>{name}</Chip> has {fmtNumber(cosponsors.length)} {cosponsors.length === 1 ? "co-sponsor" : "co-sponsors"}, {fmtNumber(actions.length)} {actions.length === 1 ? "action" : "actions"} and {fmtNumber(texts.length)} text{" "}
        {texts.length === 1 ? "version" : "versions"} on the record.
      </p>
      <AmendmentTextBlock texts={texts} who={name} source={source} />
      <AmendmentSponsors rows={sponsorRows} who={name} />
      <AmendmentActions actions={actions} who={name} />
    </DocsPage>
  )
}
