import { getBlockNames, registryCategories } from "@/lib/blocks"
import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { BlockDisplay } from "@/components/block-display"
import { BlockFrame } from "@/components/block-frame"
import { BlocksShell } from "@/components/blocks-shell"

// Ported from livingston-v3 app/(app)/blocks/[...categories]/page.tsx. Two
// things share this route: a tab (/blocks/vote) renders exactly one block —
// the Code view inlines a block's highlighted source, so one block per page
// keeps the response small — and a category (/blocks/sidebar) lists everything
// in it, which is what "Browse all blocks" is for.
//
// Three things now: `/blocks/intelligence` is the inbox and nothing else.
export function generateStaticParams() {
  return [
    ...BLOCK_TABS.map((tab) => ({ categories: [tab.value] })),
    ...registryCategories.map((category) => ({ categories: [category.slug] })),
  ]
}

// Brendan, 2026-09-02: the site nav, then the inbox frame, sized to the screen.
// No hero, no tab strip, no Preview/Code toolbar, no `npx shadcn add`. The page
// is what it is for. Same route, same name, same static param — only what this
// one tab renders is different.
const FULL_BLEED = "intelligence"

export default async function BlocksPage({ params }: { params: Promise<{ categories?: string[] }> }) {
  const { categories = [] } = await params
  const tab = BLOCK_TABS.find((entry) => entry.value === categories[0])

  if (tab && tab.value === FULL_BLEED) {
    return (
      // `data-slot="inbox"`: the root layout pins the page to the viewport and
      // hides the footer, so the frame is the screen below the header less this
      // wrapper's padding — a bordered card that fits, and never a page that
      // scrolls. The panes inside it do their own scrolling.
      <div data-slot="inbox" className="container-wrapper flex min-h-0 flex-1 flex-col py-3">
        <div className="container flex min-h-0 flex-1 flex-col">
          <BlockFrame styleName="new-york-v4" name={tab.block} title={tab.label} />
        </div>
      </div>
    )
  }

  const blocks = tab ? [tab.block] : getBlockNames(categories)

  return (
    <BlocksShell>
      <div className="flex flex-col gap-12 md:gap-24">
        {blocks.map((name) => (
          <BlockDisplay name={name} key={name} styleName="new-york-v4" />
        ))}
      </div>
    </BlocksShell>
  )
}
