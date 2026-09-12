import type { Metadata } from "next"
import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ComponentsIndex } from "@/components/docs/components-index"
import { REGISTRY_ITEMS, REGISTRY_KINDS } from "@/lib/workspace/registry-items"

// /docs/components (Brendan, 2026-09-12): the @44gov registry, the way
// shadcn's /docs/components lists its own — every item by kind, one line
// each, each a page. The blocks the site is built from have their own page
// at /docs/blocks; this is everything that installs today.

const title = "Components"
const description = "Every part of GovBlocks that installs into your own app with one command: components, cards, hooks and libraries, each with its page."

export const metadata: Metadata = { title, description }

const PLURAL: Record<string, string> = { Component: "Components", Card: "Cards", Hook: "Hooks", Library: "Libraries" }

export default function DocsComponentsPage() {
  const kinds = REGISTRY_KINDS.filter((k) => REGISTRY_ITEMS.some((i) => i.kind === k))
  const toc = kinds.map((k) => ({ title: PLURAL[k], url: `#${PLURAL[k].toLowerCase()}`, depth: 2 }))
  return (
    <DocsPage title={title} description={description} slug="/docs/components" previous={{ name: "CLI", url: "/docs/cli" }} next={{ name: "Blocks", url: "/docs/blocks" }} rail={<DocsTableOfContents toc={toc} />}>
      <p>
        <Link href="/docs/installation">Install</Link> once, then add what you need. Every item has a page with its preview, its command, what it exports, and, where it ships rows, the data set beside it. {REGISTRY_ITEMS.length} items today.
      </p>
      <ComponentsIndex />
    </DocsPage>
  )
}
