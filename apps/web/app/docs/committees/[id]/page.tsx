import { type Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft } from "@tabler/icons-react"

import CODES from "@/lib/data/congress/committee-codes.json"
import { getCommittee } from "@/lib/policy/db-queries"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import {
  CommitteeAbout,
  CommitteeFederalNote,
  CommitteeHearings,
  CommitteeMeetings,
  CommitteeProvider,
  CommitteeReports,
  CommitteeSubcommittees,
  CommitteeToc,
} from "@/components/policy/committee-page"
import { H2, Table } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"

// One committee, keyed by the system code congress.gov gives it — `hsvr00` is
// the House Veterans' Affairs Committee, `hsvr03` its Health Subcommittee. The
// cards on /docs/committees link here.
//
// The code is also the join: `committee-codes.json` maps the name LegiScan
// prints ("Veterans' Affairs") to the code congress.gov uses, so the page can
// ask Aurora for the bills before the committee under the name Aurora knows,
// and congress.gov for everything else under the code it knows. When the
// `committees` resource carries the system code itself, the map goes.

const SECTIONS = ["Bills"]
const CODE_MAP = CODES as { byName: Record<string, string>; byCode: Record<string, { chamber: string; name: string }> }

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return Object.keys(CODE_MAP.byCode).map((id) => ({ id }))
}

function known(id: string) {
  return CODE_MAP.byCode[id.toLowerCase()] ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const committee = known(id)
  if (!committee) return { title: "Committee" }
  return {
    title: `${committee.name} Committee`,
    description: `The ${committee.name} Committee of the federal legislature — bills before it, what it met about, and what it filed.`,
  }
}

export default async function CommitteeRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const code = id.toLowerCase()
  const committee = known(code)
  if (!committee) notFound()
  const record = await getCommittee({ state: "US", session: 2025 }, committee.name)
  // `bills` is the 25 most recent; the true total is the status breakdown,
  // which counts every bill referred this session.
  const referred = record.statuses.reduce((total, row) => total + row.bills, 0)
  const title = `${committee.name} Committee`
  const description = `Bills before the committee this session, the meetings it held, and the reports and transcripts it filed.`
  const markdown = [`# ${title}`, "", description].join("\n")

  return (
    <CommitteeProvider code={code}>
      <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage page={markdown} url={`https://govblock.app/docs/committees/${code}`} />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="extend-touch-target size-8 shadow-none md:size-7"
                      asChild
                    >
                      <Link href="/docs/committees">
                        <IconArrowLeft />
                        <span className="sr-only">All committees</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">
                {description}
              </p>
            </div>
            <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
              <CommitteeAbout bills={referred} />

              <H2>Bills</H2>
              {record.bills.length ? (
                <Table>
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Latest action</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.bills.map((bill) => (
                      <tr key={bill.bill_id}>
                        <td>
                          <Link href={`/docs/bills/${bill.bill_id}`} className="no-underline hover:underline">
                            {bill.bill_number}
                          </Link>
                        </td>
                        <td>{bill.last_action ?? "—"}</td>
                        <td>{bill.status_desc ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p>No bills before this committee this session.</p>
              )}
              {referred > record.bills.length && (
                <p>
                  Showing the {record.bills.length} most recent of {referred.toLocaleString("en-US")}.
                </p>
              )}

              <CommitteeSubcommittees />
              <CommitteeMeetings />
              <CommitteeReports />
              <CommitteeHearings />
              <CommitteeFederalNote />
            </div>
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-(--top-spacing) shrink-0"></div>
          <div className="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
            <CommitteeToc base={SECTIONS} />
          </div>
          <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
            <OpenInV0Cta />
          </div>
        </div>
      </div>
    </CommitteeProvider>
  )
}
