"use client"

import * as React from "react"

import { DocsTableOfContents } from "@/components/docs-toc"
import { KINDS, useHomeColumns } from "@/components/home/home-columns"

// The account home's On This Page index (Brendan, 2026-09-21), in the right
// rail as DocsPage's is: the six columns in the order the reader keeps them,
// then Analytics and Blocks. A column swapped through its Change column is
// swapped here. The Calendar came off the page on 2026-09-22 and off this list
// with it.
export function HomeToc() {
  const [columns] = useHomeColumns()
  const toc = React.useMemo(() => [...columns.map((kind) => ({ title: KINDS[kind], url: `#${kind}`, depth: 2 })), { title: "Analytics", url: "#analytics", depth: 2 }, { title: "Blocks", url: "#blocks", depth: 2 }], [columns])
  return <DocsTableOfContents toc={toc} />
}
