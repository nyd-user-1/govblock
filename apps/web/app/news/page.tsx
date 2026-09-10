import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { getLatestBrief, getStoryCounts } from "@/lib/policy/news"
import { Brief, BriefByline } from "@/components/news/brief"
import { NewsIndex } from "@/components/news-index"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { CalendarCard } from "@/components/cards/calendar"
import { PublicRail } from "@/components/block-card"
import { Button } from "@govblock/ui/components/ny4/button"

// The news index, on the committees doc's page (Brendan, 2026-09-09:
// "duplicate this page as /news"): the same header, search field and card
// grid, with a jurisdiction on each card where a committee was. /newsroom is
// untouched; this is the page in front of it.
const title = "News"
const description =
  "What each legislature did, newest first: a desk for every jurisdiction with a record."
const previous = { name: "Committees", url: "/docs/committees" }
const next = { name: "Subjects", url: "/docs/subjects" }

export const metadata = { title, description }
export const revalidate = 3600

export default async function NewsPage() {
  const [counts, brief] = await Promise.all([
    getStoryCounts(),
    getLatestBrief("states"),
  ])
  return (
    <div
      data-slot="docs"
      className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage
                      page={`# ${title}\n\n${description}`}
                      url="https://govblock.app/news"
                    />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="extend-touch-target size-8 shadow-none md:size-7"
                      asChild
                    >
                      <Link href={previous.url}>
                        <IconArrowLeft />
                        <span className="sr-only">Previous</span>
                      </Link>
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="extend-touch-target size-8 shadow-none md:size-7"
                      asChild
                    >
                      <Link href={next.url}>
                        <span className="sr-only">Next</span>
                        <IconArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">
                {description}
              </p>
            </div>
          </div>
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
            {/* Today across the states: Exa's daily monitor writes a cited brief
                over the statehouse press, and it stands at the top of the
                desks (Brendan, 2026-09-09). Absent, the desks begin at once. */}
            {brief && (
              <section className="mb-10 flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mt-0 text-lg font-semibold tracking-tight">
                  Today across the states
                </h2>
                <BriefByline brief={brief} />
                <Brief brief={brief} compact />
              </section>
            )}
            <NewsIndex counts={counts} />
          </div>
          <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
            <Button
              variant="secondary"
              size="sm"
              className="shadow-none"
              asChild
            >
              <Link href={previous.url}>
                <IconArrowLeft /> {previous.name}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto shadow-none"
              asChild
            >
              <Link href={next.url}>
                {next.name} <IconArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="hidden flex-1 flex-col gap-6 px-6 xl:flex">
          <CalendarCard compact />
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
