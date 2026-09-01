import { type Metadata } from "next"
import Link from "next/link"

import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { Announcement } from "@/components/announcement"
import { BlocksTabsNav } from "@/components/blocks-tabs"
import { PageActions, PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/page-header"
import { PageNav } from "@/components/page-nav"
import { Button } from "@govblock/ui/components/ny4/button"

// Ported from livingston-v3 app/(app)/blocks/layout.tsx.
const title = "Building Blocks for the Web"
const description =
  "Clean, modern building blocks. Copy and paste into your apps. Works with all React frameworks. Open Source. Free forever."

export const metadata: Metadata = { title, description }

export default function BlocksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader>
        <Announcement />
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
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
