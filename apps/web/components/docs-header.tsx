import Link from "next/link"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

import { DocsCopyPage } from "@/components/docs-copy-page"
import { Button } from "@govblock/ui/components/ny4/button"

// The docs shell's head, in a module of its own so a client component can draw
// it without taking the whole shell — rail, sidebar, pager — into its bundle
// (the root page's second section, 2026-09-18). components/docs-page.tsx
// re-exports everything here.

export type DocsLink = { name: string; url: string }

/** The head's small square buttons: prev/next, and whatever a `nav` puts in their place. */
export const NAV_BUTTON = "extend-touch-target size-8 shadow-none md:size-7"

/** The line under the title; a `lead` that stands in for it wears the same. */
export const DOCS_DESCRIPTION = "text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]"

/** The page's 640px column. The root page draws /bills in one too, outside the shell. */
export const DOCS_COLUMN = "mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground"

/**
 * The shell's head: title, Copy Page, prev/next, description and the rule under
 * them. Apart from DocsPage since 2026-09-18, when the root page took /bills's
 * layout as its second section (Brendan) — the head and the cards, not the
 * rail, back-to-top circle and pager, which the root frame keeps its own of.
 * `nav` takes the prev/next arrows' place: the root section's cards and table
 * buttons (Brendan, 2026-09-18). `below` sits under the description, before
 * the rule: the root section's search bar (Brendan, the same day).
 */
export function DocsHeader({ title, description, lead, slug, previous, next, actions, nav, below }: { title: string; description: string; lead?: React.ReactNode; slug: string; previous?: DocsLink; next?: DocsLink; actions?: React.ReactNode; nav?: React.ReactNode; below?: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between md:items-start">
            <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <div className="docs-nav flex items-center gap-2">
              {actions}
              <div className="hidden sm:block">
                <DocsCopyPage page={`# ${title}\n\n${description}`} url={`https://gov.nysgpt.com${slug}`} />
              </div>
              <div className="ml-auto flex gap-2">
                {nav ?? (
                  <>
                    {previous && (
                    <Button variant="secondary" size="icon" className={NAV_BUTTON} asChild>
                      <Link href={previous.url}>
                        <IconArrowLeft />
                        <span className="sr-only">Previous</span>
                      </Link>
                    </Button>
                    )}
                    {next && (
                    <Button variant="secondary" size="icon" className={NAV_BUTTON} asChild>
                      <Link href={next.url}>
                        <span className="sr-only">Next</span>
                        <IconArrowRight />
                      </Link>
                    </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {lead ?? <p className={DOCS_DESCRIPTION}>{description}</p>}
        </div>
      </div>
      {below}
      {/* An index page's view buttons, at the right just above the rule (Brendan,
          2026-09-20): the list below owns the choice and portals them in
          (components/index-views.tsx). Empty, it takes no room. */}
      <div data-slot="docs-views" className="-mt-3 -mb-9 flex justify-end gap-2 empty:hidden" />
      {/* The header's rule, at the distance RecordHeader keeps (2026-09-18). */}
      <hr className="mt-6 border-0 border-t border-border" />
    </>
  )
}
