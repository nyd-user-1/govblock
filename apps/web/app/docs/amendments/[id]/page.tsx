import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { memberHref } from "@/lib/filters"
import { fmtBill, fmtDate, fmtNumber, honorific, shortDistrict } from "@/lib/format"
import { congressGovHref } from "@/lib/policy/congress"
import { getAmendment, getAmendmentActions, getAmendmentCosponsors, getAmendmentNeighbours, getAmendmentTexts, getPeopleByBioguide } from "@/lib/policy/committee-queries"
import { BackToTop } from "@/components/back-to-top"
import { Button } from "@govblock/ui/components/ny4/button"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { ChamberSeal } from "@/components/policy/imagery"
import type { MemberCardRow } from "@/components/policy/member-card"
import { RECORD_MEDIA, RecordHeader } from "@/components/record-header"
import { amendmentPath, fmtAmendment } from "@/lib/policy/congress-hrefs"
import { AmendmentActions, AmendmentSponsors, AmendmentTextBlock, AmendmentToc } from "@/components/policy/amendment-page"
import { H2 } from "@/components/typeset"
import { Chip } from "@/components/chip"

// One amendment, by "samdt-5512", on the bill page's design.

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

// congress.gov's bill type → the prefix our bill numbers carry, so "S 2" prints as "SB 2".
const OUR_PREFIX: Record<string, string> = { HR: "HB", S: "SB", HJRES: "HJR", SJRES: "SJR", HCONRES: "HCR", SCONRES: "SCR", HRES: "HR", SRES: "SR" }
const billLabel = (type: string | null, number: string | null) => (type && number ? fmtBill(`${OUR_PREFIX[type.toUpperCase()] ?? type.toUpperCase()}${number}`) : null)

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
    billName ? bill?.id ? <Link key="b" href={`/docs/bills/${bill.id}`} className="hover:underline">{`Amends ${billName}`}</Link> : `Amends ${billName}` : null,
    amendment.amends ? `Amends ${fmtAmendment(amendment.amends.type ?? "", amendment.amends.number ?? "")}` : null,
  ]
  const source = congressGovHref("amendment", amendment.type, amendment.number, amendment.congress)
  const markdown = [`# ${name}`, "", amendment.purpose ?? amendment.description ?? "", "", amendment.latest_action ?? ""].join("\n")
  const arrow = "extend-touch-target size-8 shadow-none md:size-7"
  const parts = ["Text"]
  if (sponsorRows.length) parts.push("Sponsors")
  if (actions.length) parts.push("Actions")

  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <RecordHeader
            media={<ChamberSeal state={STATE} chamber={chamber} size={RECORD_MEDIA} />}
            title={name}
            meta={facts}
            action={
              <>
                <DocsCopyPage page={markdown} url={`https://govblock.app${amendmentPath(amendment.type, amendment.number)}`} />
                {neighbours.previous ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={amendmentPath(neighbours.previous.amendment_type, neighbours.previous.number)} title={fmtAmendment(neighbours.previous.amendment_type, neighbours.previous.number)}>
                      <IconArrowLeft />
                      <span className="sr-only">Previous amendment</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} disabled>
                    <IconArrowLeft />
                  </Button>
                )}
                {neighbours.next ? (
                  <Button variant="secondary" size="icon" className={arrow} asChild>
                    <Link href={amendmentPath(neighbours.next.amendment_type, neighbours.next.number)} title={fmtAmendment(neighbours.next.amendment_type, neighbours.next.number)}>
                      <IconArrowRight />
                      <span className="sr-only">Next amendment</span>
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="icon" className={arrow} disabled>
                    <IconArrowRight />
                  </Button>
                )}
              </>
            }
          />
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
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

            <hr />
            <p>
              Source:{" "}
              <a href={source} target="_blank" rel="noopener noreferrer">
                congress.gov
              </a>
            </p>
          </div>
          {(neighbours.previous || neighbours.next) && (
            <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
              {neighbours.previous && (
                <Button variant="secondary" size="sm" className="shadow-none" asChild>
                  <Link href={amendmentPath(neighbours.previous.amendment_type, neighbours.previous.number)}>
                    <IconArrowLeft /> {fmtAmendment(neighbours.previous.amendment_type, neighbours.previous.number)}
                  </Link>
                </Button>
              )}
              {neighbours.next && (
                <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
                  <Link href={amendmentPath(neighbours.next.amendment_type, neighbours.next.number)}>
                    {fmtAmendment(neighbours.next.amendment_type, neighbours.next.number)} <IconArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          )}
          <BackToTop />
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="scrollbar-none flex scroll-fade flex-col gap-8 overflow-y-auto px-8">
          <AmendmentToc parts={parts} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
