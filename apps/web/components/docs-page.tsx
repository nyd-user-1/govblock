import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { RightRailSheet } from "@/components/rail-sheet"
import { Button } from "@govblock/ui/components/ny4/button"

// The docs page shell /bills, /committees and /members each
// carry a copy of: title, Copy Page, prev/next, description, the prose column,
// and the rail. Written down once here for the pages added after them — the
// same markup and the same classNames, moved rather than redesigned.

export type DocsLink = { name: string; url: string }

export function DocsPage({ title, description, lead, slug, previous, next, rail, railFirst, children }: { title: string; description: string; /** Drawn under the title in the description's place — a desk's eyebrow; the description still feeds Copy Page. */ lead?: React.ReactNode; slug: string; /** Absent on the first page, which has nothing before it. */ previous?: DocsLink; next: DocsLink; rail?: React.ReactNode; /** Draw Build with GovBlocks above the page's own rail instead of below it. */ railFirst?: boolean; children: React.ReactNode }) {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between md:items-start">
                <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <div className="docs-nav flex items-center gap-2">
                  <div className="hidden sm:block">
                    <DocsCopyPage page={`# ${title}\n\n${description}`} url={`https://gov.nysgpt.com${slug}`} />
                  </div>
                  <div className="ml-auto flex gap-2">
                    {previous && (
                    <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" asChild>
                      <Link href={previous.url}>
                        <IconArrowLeft />
                        <span className="sr-only">Previous</span>
                      </Link>
                    </Button>
                    )}
                    <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" asChild>
                      <Link href={next.url}>
                        <span className="sr-only">Next</span>
                        <IconArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              {lead ?? <p className="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">{description}</p>}
            </div>
          </div>
          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">{children}</div>
          <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
            {previous && (
            <Button variant="secondary" size="sm" className="shadow-none" asChild>
              <Link href={previous.url}>
                <IconArrowLeft /> {previous.name}
              </Link>
            </Button>
            )}
            <Button variant="secondary" size="sm" className="ml-auto shadow-none" asChild>
              <Link href={next.url}>
                {next.name} <IconArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {/* The right rail is the left rail, mirrored (Brendan, 2026-09-10): the
          same hairline and tab, moved to the inner edge. A sheet since
          2026-09-16 — it lies over the page from its edge instead of standing
          in a column that pushed itself off screen at narrow widths — and it
          opens and closes on its own, independently of the left. */}
      <RightRailSheet>
        {railFirst && <PublicRail />}
        {rail}
        {!railFirst && <PublicRail />}
      </RightRailSheet>
    </div>
  )
}
