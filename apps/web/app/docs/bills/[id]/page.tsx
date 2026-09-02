import Link from "next/link"
import { notFound } from "next/navigation"

import { BILLS } from "@/lib/data"
import { getBill, getBillText } from "@/lib/policy/queries"
import { memberHref } from "@/lib/filters"
import { BillText } from "@/components/bill-text"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import { BillAmendments, BillCommitteeReports, BillCongressProvider, BillCosponsorDates, BillRelatedBills, BillStatusExtras, BillSummaries, BillTitles, BillToc, BillVersions } from "@/components/policy/bill-congress"
import { BillActions, BillCommittees, BillDepthProvider, BillTracker } from "@/components/policy/bill-depth"
import { Callout, H2, Table } from "@/components/typeset"

// Ported from livingston-v3 app/(app)/docs/bills/[id]/page.tsx: a bill's own
// page — status, Summary, Sponsors, History, Votes, Text, Source.
//
// Every bill in the policy database has a page. The twelve committed under
// lib/data are prerendered at build time and stand in if the database is
// unreachable; the rest render on demand and are then cached.

// The sections a bill always has. What congress.gov adds — committee reports,
// amendments, related bills, titles — joins the contents only where the bill
// has rows for it, so the rail names what is on the page and nothing else.
const SECTIONS = ["Summary", "Sponsors", "History", "Votes", "Text"]
// On a Congress bill the same section is called what congress.gov calls it, and
// carries what congress.gov carries: the stage, the acting committee and the
// roll call, on our own rows.
const CONGRESS_SECTIONS = ["Summary", "Sponsors", "Actions", "Committees", "Votes", "Text"]
const SPONSOR_TYPE: Record<number, string> = { 1: "prime sponsor", 2: "co-sponsor", 3: "joint sponsor" }
const MAX_SPONSORS = 20

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")
const district = (value: string | null | undefined) => (value ?? "").replace(/^[A-Z]+-/, "").replace(/(^|-)0+(?=\d)/g, "$1")
const host = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

// A bill's record changes under it — an action, a cosponsor, and above all a new
// text version as it moves. The twelve prerendered here would otherwise be
// frozen at build time: HB10160's introduced text landed in Aurora and the page
// still said "No text on file yet", because nothing asked it again. The rest of
// the app already revalidates hourly.
export const revalidate = 3600

export function generateStaticParams() {
  return Object.keys(BILLS).map((id) => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await getBill(Number(id))
  if (!bill) return { title: "Bill" }
  return { title: bill.bill_number, description: bill.description || bill.title }
}

export default async function BillRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await getBill(Number(id))
  if (!bill) notFound()
  const held = await getBillText(Number(id))
  const text = held?.text
  const summary = bill.description || bill.title
  const shownSponsors = bill.sponsors.slice(0, MAX_SPONSORS)
  const moreSponsors = bill.sponsors.length - shownSponsors.length

  const statusParts: string[] = []
  if (bill.last_action_date || bill.last_action) statusParts.push(`last action ${day(bill.last_action_date)}: ${bill.last_action ?? ""}`.trim())
  if (bill.committee) statusParts.push(bill.committee)

  const sources: { prefix: string; label: string; href: string }[] = []
  if (bill.state_link) sources.push({ prefix: "Source: ", label: host(bill.state_link), href: bill.state_link })
  if (bill.url) sources.push({ prefix: sources.length ? "" : "Source: ", label: host(bill.url), href: bill.url })

  const markdown = [`# ${bill.bill_number}`, "", summary, "", `**${bill.status_desc ?? "—"}**${statusParts.map((p) => ` · ${p}`).join("")}`, "", "## Summary", "", summary].join("\n")

  return (
    <BillCongressProvider billId={bill.bill_id} billNumber={bill.bill_number} state={bill.state}>
      <BillDepthProvider billId={bill.bill_id} state={bill.state}>
      <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{bill.bill_number}</h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage page={markdown} url={`https://govblock.app/docs/bills/${bill.bill_id}`} />
                  </div>
                </div>
              </div>
              <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">{summary}</p>
            </div>
          </div>
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
            <Callout className="bg-muted">
              <p>
                <strong>{bill.status_desc ?? "—"}</strong>
                {statusParts.map((part) => (
                  <span key={part}> · {part}</span>
                ))}
                <BillStatusExtras />
              </p>
              <BillTracker />
            </Callout>

            <H2>Summary</H2>
            <BillSummaries fallback={<p>{summary}</p>} />

            <H2>Sponsors</H2>
            <ul>
              {shownSponsors.map((sponsor) => (
                <li key={sponsor.people_id}>
                  <Link href={memberHref(sponsor.people_id, bill.state)} className="no-underline hover:underline">
                    <strong>{sponsor.name}</strong>
                  </Link>{" "}
                  ({sponsor.party ?? "—"}–{district(sponsor.district)}) — {SPONSOR_TYPE[sponsor.type] ?? "sponsor"}
                </li>
              ))}
              {moreSponsors > 0 && <li>…and {moreSponsors} more co-sponsors</li>}
              {!bill.sponsors.length && <li>—</li>}
            </ul>
            <BillCosponsorDates />

            <H2>{bill.state === "US" ? "Actions" : "History"}</H2>
            <BillActions
              history={bill.history}
              fallback={
                bill.history.length ? (
                  <Table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Chamber</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.history.map((row, index) => (
                        <tr key={`${row.date}-${row.sequence}-${index}`}>
                          <td>{day(row.date)}</td>
                          <td>{row.chamber}</td>
                          <td>{row.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p>No history recorded yet.</p>
                )
              }
            />

            <BillCommitteeReports />
            <BillCommittees />

            <H2>Votes</H2>
            {bill.rollCalls.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vote</th>
                    <th>Yea</th>
                    <th>Nay</th>
                    <th>NV</th>
                    <th>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.rollCalls.map((row: { roll_call_id: number; date: string; description: string; yea?: number; nay?: number; nv?: number; absent?: number }) => (
                    <tr key={row.roll_call_id}>
                      <td>{day(row.date)}</td>
                      <td>{row.description}</td>
                      <td>{row.yea ?? 0}</td>
                      <td>{row.nay ?? 0}</td>
                      <td>{row.nv ?? 0}</td>
                      <td>{row.absent ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p>No roll call recorded yet.</p>
            )}

            <BillAmendments />
            <BillRelatedBills />
            <BillTitles />

            <H2>Text</H2>
            <BillVersions
              held={held?.document_id ?? null}
              fallback={
                text ? (
                  <BillText text={text} />
                ) : (
                  <p>
                    No text on file yet
                    {sources[0] ? (
                      <>
                        {" "}
                        — read it at{" "}
                        <a href={sources[0].href} target="_blank" rel="noopener noreferrer">
                          {sources[0].label}
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                )
              }
            />

            {sources.length > 0 && (
              <>
                <hr />
                <p>
                  {sources.map((link, index) => (
                    <span key={link.href}>
                      {index > 0 && " · "}
                      {link.prefix}
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </span>
                  ))}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
          <BillToc base={bill.state === "US" ? CONGRESS_SECTIONS : SECTIONS} />
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <OpenInV0Cta />
        </div>
        </div>
      </div>
      </BillDepthProvider>
    </BillCongressProvider>
  )
}
