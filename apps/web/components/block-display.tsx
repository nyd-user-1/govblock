import { createFileTreeForRegistryItemFiles, getBlock } from "@/lib/blocks"
import { BlockViewer } from "@/components/block-viewer"

// Ported from livingston-v3 components/block-display.tsx. v3 resolves the
// registry item and highlights its files on every render; both were done once
// into lib/data/blocks, so this is a lookup. The item handed to the viewer
// carries the raw files; the highlighted copies travel once, as in v3.
export function BlockDisplay({ name, styleName }: { name: string; styleName: string }) {
  const block = getBlock(name)

  if (!block?.files) {
    return null
  }

  const tree = createFileTreeForRegistryItemFiles(block.files)
  const item = { ...block, files: block.files.map(({ highlightedContent: _, ...file }) => file) }

  return <BlockViewer item={item} tree={tree} highlightedFiles={block.files} styleName={styleName} />
}
