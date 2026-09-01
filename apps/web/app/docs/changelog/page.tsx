import Link from "next/link"
import { IconRss } from "@tabler/icons-react"

import { stateName } from "@/lib/filters"
import { fmtDate, truncate } from "@/lib/format"
import { getStream, type StreamBill } from "@/lib/policy/stream"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import { Button } from "@govblock/ui/components/nova/button"

// Ported from livingston-v3 app/(app)/docs/changelog/page.tsx: bills as they
// move, across jurisdictions, in the changelog's own layout.
export const metadata = { title: "Changelog", description: "Latest updates and announcements." }
// Rebuilt every hour from mv_stream_latest.
export const revalidate = 3600

const NUMBER_OF_LATEST_PAGES = 5

type Entry = StreamBill & { state: string; session: number }

const workspaceHref = (bill: Entry) => `/typeset?state=${bill.state}&session=${bill.session}&bill=${bill.bill_id}`

export default async function ChangelogPage() {
  const { groups, source } = await getStream({ limit: 40 })
  const entries: Entry[] = groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))
  const latestPages = entries.slice(0, NUMBER_OF_LATEST_PAGES)
  const olderPages = entries.slice(NUMBER_OF_LATEST_PAGES)

  return (
    <div data-slot="docs" data-source={source} className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1 className="scroll-m-24 text-4xl font-semibold tracking-tight sm:text-3xl">Changelog</h1>
              <Button variant="secondary" size="sm" render={<a href="/rss.xml" target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                <IconRss />
                RSS
              </Button>
            </div>
            <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">Latest updates and announcements.</p>
          </div>
          <div className="w-full flex-1 pb-16 sm:pb-0">
            {latestPages.map((bill) => (
              <article key={`${bill.state}-${bill.bill_id}`} id={`${bill.state}-${bill.bill_number}`} className="mb-12 scroll-mt-24 border-b pb-12">
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  <Link href={workspaceHref(bill)} className="no-underline hover:underline">
                    {fmtDate(bill.last_action_date)} - {stateName(bill.state)} {bill.bill_number}
                  </Link>
                </h2>
                <div className="typeset mt-6 *:first:mt-0">
                  <p>
                    <strong>{bill.title}</strong>
                  </p>
                  {bill.description && bill.description.trim() !== bill.title.trim() && <p>{truncate(bill.description, 600)}</p>}
                  <ul>
                    {bill.last_action && (
                      <li>
                        <strong>{fmtDate(bill.last_action_date)}</strong> — {bill.last_action}
                      </li>
                    )}
                    {bill.status_desc && (
                      <li>
                        Status: {bill.status_desc}
                        {bill.committee ? ` · ${bill.committee} Committee` : ""}
                      </li>
                    )}
                    {bill.sponsor && (
                      <li>
                        Sponsor: {bill.sponsor}
                        {bill.sponsor_party ? ` (${bill.sponsor_party})` : ""}
                      </li>
                    )}
                  </ul>
                </div>
              </article>
            ))}
            {olderPages.length > 0 && (
              <div id="more-updates" className="mb-24 scroll-mt-24">
                <h2 className="mb-6 font-heading text-xl font-semibold tracking-tight">More Updates</h2>
                <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
                  {olderPages.map((bill) => (
                    <Link
                      key={`${bill.state}-${bill.bill_id}`}
                      href={workspaceHref(bill)}
                      className="flex w-full flex-col rounded-2xl bg-surface px-4 py-3 text-surface-foreground transition-colors hover:bg-surface/80"
                    >
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(bill.last_action_date)} · {stateName(bill.state)}
                      </span>
                      <span className="text-sm font-medium">
                        {bill.bill_number} · {truncate(bill.title, 70)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 lg:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="no-scrollbar flex flex-col gap-8 overflow-y-auto px-8">
          <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
            <p className="sticky top-0 h-6 bg-background text-xs font-medium text-muted-foreground">On This Page</p>
            {latestPages.map((bill) => (
              <a key={`${bill.state}-${bill.bill_id}`} href={`#${bill.state}-${bill.bill_number}`} className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground">
                {stateName(bill.state)} {bill.bill_number}
              </a>
            ))}
            {olderPages.length > 0 && (
              <a href="#more-updates" className="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground">
                More Updates
              </a>
            )}
          </div>
        </div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <OpenInV0Cta />
        </div>
      </div>
    </div>
  )
}
