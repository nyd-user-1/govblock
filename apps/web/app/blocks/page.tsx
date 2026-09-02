import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { BlockDisplay } from "@/components/block-display"
import { BlocksShell } from "@/components/blocks-shell"

// Ported from livingston-v3 app/(app)/blocks/page.tsx. /blocks is the first
// tab; the others are /blocks/<tab>, each a static page carrying one block.
// The hero and the tab strip come from `BlocksShell` rather than the layout —
// see that file for why they travel with the container.
export default function BlocksPage() {
  const first = BLOCK_TABS[0]

  return (
    <BlocksShell>
      <div className="flex flex-col gap-12 md:gap-24">
        <BlockDisplay name={first.block} styleName="new-york-v4" />
      </div>
    </BlocksShell>
  )
}
