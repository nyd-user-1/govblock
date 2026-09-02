import Link from "next/link"

import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { Announcement } from "@/components/announcement"
import { BlocksTabsNav } from "@/components/blocks-tabs"
import { PageActions, PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/page-header"
import { PageNav } from "@/components/page-nav"
import { Button } from "@govblock/ui/components/ny4/button"

// Everything /blocks wears above a block: the hero, the tab strip, and the
// container the block sits in. It was `app/blocks/layout.tsx` until 2026-09-02,
// when `/blocks/intelligence` needed to be the site nav and the inbox and
// nothing else.
//
// **The wrapper travels with the hero, and that is the whole trick.**
// `PageHeader` and `PageNav` each open their own `container-wrapper` +
// `container`. Leaving the wrapper behind in the layout and rendering the hero
// from the page would nest those inside it — a second `px-2` and a second
// `px-4 lg:px-8` — and the hero would lose its full-bleed rule and sit inset on
// every other tab. Moving all three together means the six other tabs and every
// category page render the same element tree they rendered yesterday, in the
// same order, and `intelligence` simply renders a different wrapper.
//
// That also answers the "prop or data attribute" question by removing it: the
// page that wants full bleed writes its own wrapper without `md:py-12`, so
// nothing has to signal anything across the boundary.

export const BLOCKS_TITLE = "Building Blocks for the Web"
export const BLOCKS_DESCRIPTION =
  "Clean, modern building blocks. Copy and paste into your apps. Works with all React frameworks. Open Source. Free forever."

export function BlocksShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader>
        <Announcement />
        <PageHeaderHeading>{BLOCKS_TITLE}</PageHeaderHeading>
        <PageHeaderDescription>{BLOCKS_DESCRIPTION}</PageHeaderDescription>
        <PageActions>
          <Button asChild size="sm">
            <a href="#blocks">Browse Blocks</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/docs/components">View Components</Link>
          </Button>
        </PageActions>
      </PageHeader>
      <PageNav id="blocks">
        {/* The tab strip replaces the category nav: the categories were
            Sidebar / Login / Signup, the template's taxonomy, not ours. Those
            routes still work; they are just not the way in. */}
        <BlocksTabsNav tabs={BLOCK_TABS} />
        <Button asChild variant="secondary" size="sm" className="mr-7 hidden shadow-none lg:flex">
          <Link href="/blocks/sidebar">Browse all blocks</Link>
        </Button>
      </PageNav>
      <div className="container-wrapper flex-1 section-soft md:py-12">
        <div className="container">{children}</div>
      </div>
    </>
  )
}
