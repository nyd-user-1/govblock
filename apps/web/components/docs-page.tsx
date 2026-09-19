import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { BackToTop } from "@/components/back-to-top"
import { DOCS_COLUMN, DocsHeader, type DocsLink } from "@/components/docs-header"
import { PublicRail } from "@/components/block-card"
import { RightRailSheet } from "@/components/rail-sheet"
import { Button } from "@govblock/ui/components/ny4/button"

// The docs page shell /bills, /committees and /members each
// carry a copy of: title, Copy Page, prev/next, description, the prose column,
// and the rail. Written down once here for the pages added after them — the
// same markup and the same classNames, moved rather than redesigned.

export { DOCS_COLUMN, DocsHeader, NAV_BUTTON, type DocsLink } from "@/components/docs-header"

export function DocsPage({ title, description, lead, slug, previous, next, rail, railSettings, actions, railFirst, children }: { title: string; description: string; /** Drawn under the title in the description's place — a desk's eyebrow; the description still feeds Copy Page. */ lead?: React.ReactNode; slug: string; /** Absent on the first page, which has nothing before it. */ previous?: DocsLink; next: DocsLink; rail?: React.ReactNode; /** The right rail's second view, toggled at its top: the laws reader's Settings (2026-09-19). */ railSettings?: React.ReactNode; /** Small buttons before the Copy page group: a tag's Follow (2026-09-18). */ actions?: React.ReactNode; /** Draw Build with GovBlocks above the page's own rail instead of below it. */ railFirst?: boolean; children: React.ReactNode }) {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className={DOCS_COLUMN}>
          <DocsHeader title={title} description={description} lead={lead} slug={slug} previous={previous} next={next} actions={actions} />
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
          {/* Every docs page gets the circle back to the top (Brendan, 2026-09-18). */}
          <BackToTop />
        </div>
      </div>
      {/* The right rail is the left rail, mirrored (Brendan, 2026-09-10): the
          same hairline and tab, moved to the inner edge. A sheet since
          2026-09-16 — it lies over the page from its edge instead of standing
          in a column that pushed itself off screen at narrow widths — and it
          opens and closes on its own, independently of the left. */}
      <RightRailSheet settings={railSettings}>
        {railFirst && <PublicRail />}
        {rail}
        {!railFirst && <PublicRail />}
      </RightRailSheet>
    </div>
  )
}
