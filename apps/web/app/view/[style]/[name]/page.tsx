import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { getBlock } from "@/lib/blocks"
import { blockComponents } from "@/registry/blocks"

// Ported from livingston-v3 app/(view)/view/[style]/[name]/page.tsx: the page
// the block viewer's iframe loads, and "Open in New Tab". v3 mounts it outside
// the site chrome via a route group; here data-slot="view" hides the header
// and footer instead, so the existing routes stay where they are.
const STYLE = "new-york-v4"

export function generateStaticParams() {
  return Object.keys(blockComponents).map((name) => ({ style: STYLE, name }))
}

export async function generateMetadata({ params }: { params: Promise<{ style: string; name: string }> }): Promise<Metadata> {
  const { name } = await params
  const item = getBlock(name)
  return item ? { title: item.name, description: item.description } : {}
}

export default async function BlockPage({ params }: { params: Promise<{ style: string; name: string }> }) {
  const { style, name } = await params
  const Component = style === STYLE ? blockComponents[name] : undefined

  if (!Component) {
    notFound()
  }

  return (
    <div data-slot="view" className="bg-background *:data-[slot=card]:has-[[data-slot=chart]]:shadow-none">
      <Component />
    </div>
  )
}
