import { PublicRail } from "@/components/block-card"
import { RightRailSheet } from "@/components/rail-sheet"

// The third page type (Brendan, 2026-09-20), beside DocsPage and the
// dashboard's full-screen shell: the docs shell with a wider column and no
// head of its own. The account home drew it first — a greeting, a search and
// three columns want more than DocsPage's 40rem — and /pricing's four plans
// and their table sit best in the same width. Under the docs layout, so the
// site's left rail is beside it; the right rail is the page's, then the
// public rail, as DocsPage has them.

/** The page's 64rem column. The root's account-home sheet draws the same column by itself, outside the shell. */
export const WIDE_COLUMN = "mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-10 px-4 py-6 text-foreground md:px-6 lg:py-8"

export function WidePage({ rail, publicRail = true, children }: { /** The page's own right rail, above the public one. */ rail?: React.ReactNode; publicRail?: boolean; children: React.ReactNode }) {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className={WIDE_COLUMN}>{children}</div>
      </div>
      <RightRailSheet>
        {rail}
        {publicRail && <PublicRail />}
      </RightRailSheet>
    </div>
  )
}
