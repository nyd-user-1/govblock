import { getBlockNames, registryCategories } from "@/lib/blocks"
import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { BlockDisplay } from "@/components/block-display"

// Ported from livingston-v3 app/(app)/blocks/[...categories]/page.tsx. Two
// things share this route: a tab (/blocks/vote) renders exactly one block —
// the Code view inlines a block's highlighted source, so one block per page
// keeps the response small — and a category (/blocks/sidebar) lists everything
// in it, which is what "Browse all blocks" is for.
export function generateStaticParams() {
  return [
    ...BLOCK_TABS.map((tab) => ({ categories: [tab.value] })),
    ...registryCategories.map((category) => ({ categories: [category.slug] })),
  ]
}

export default async function BlocksPage({ params }: { params: Promise<{ categories?: string[] }> }) {
  const { categories = [] } = await params
  const tab = BLOCK_TABS.find((entry) => entry.value === categories[0])
  const blocks = tab ? [tab.block] : getBlockNames(categories)

  return (
    <div className="flex flex-col gap-12 md:gap-24">
      {blocks.map((name) => (
        <BlockDisplay name={name} key={name} styleName="new-york-v4" />
      ))}
    </div>
  )
}
