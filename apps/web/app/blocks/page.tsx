import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { BlockDisplay } from "@/components/block-display"

// Ported from livingston-v3 app/(app)/blocks/page.tsx. /blocks is the first
// tab; the others are /blocks/<tab>, each a static page carrying one block.
export default function BlocksPage() {
  const first = BLOCK_TABS[0]

  return (
    <div className="flex flex-col gap-12 md:gap-24">
      <BlockDisplay name={first.block} styleName="new-york-v4" />
    </div>
  )
}
