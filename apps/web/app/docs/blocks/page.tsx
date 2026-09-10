import type { Metadata } from "next"
import * as React from "react"
import Link from "next/link"

import { BLOCK_DOCS, BLOCK_GROUP_LABEL } from "@/lib/workspace/block-docs"
import { REGISTRY_ITEMS } from "@/lib/workspace/registry-items"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, Table } from "@/components/typeset"

// /docs/blocks (Brendan, 2026-09-07): the manual for /workspace/blocks — the
// same catalogue, the same slugs, one page per block beside the Components
// docs, the way shadcn keeps Components and Blocks as two sections.
const title = "Blocks"
const description = "Every block the site is built from: the home page's cards, the account home's tiles, the dashboards' cards, the bill page's blocks. Each one a real component, with its source, its data and its props."

export const metadata: Metadata = { title, description }

const GROUPS = ["home", "analytics", "dashboard", "bill"] as const

export default function BlocksIndexPage() {
  const toc = [
    { title: "Registry", url: "#registry", depth: 2 },
    ...GROUPS.map((g) => ({ title: BLOCK_GROUP_LABEL[g], url: `#${g}`, depth: 2 })),
  ]
  return (
    <DocsPage title={title} description={description} slug="/docs/blocks" previous={{ name: "API", url: "/docs/api" }} next={{ name: "Bulk Datasets", url: "/docs/datasets" }} rail={<DocsTableOfContents toc={toc} />}>
      <p>
        Each block stands on the canvas at <Link href="/workspace/blocks">/workspace/blocks</Link>, where it can be sized, coloured and rearranged. Its page here carries the preview, the command that installs it, the source, and the routes it reads.
      </p>
      <H2 id="registry">Registry</H2>
      <p>
        GovBlock&rsquo;s parts install the way any shadcn registry&rsquo;s do. Name it once in your <code>components.json</code>:
      </p>
      <pre>
        <code>{`"registries": {\n  "@nysgpt": "https://gov.nysgpt.com/r/{name}.json"\n}`}</code>
      </pre>
      <p>Then take what you need. Anything an item depends on arrives with it.</p>
      <pre>
        <code>npx shadcn@latest add @nysgpt/district-join</code>
      </pre>
      <p>
        These are published today. The blocks below are not yet among them: they read the site&rsquo;s own card frame and jurisdiction, which does not travel.
      </p>
      <Table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Kind</th>
            <th>What it is</th>
          </tr>
        </thead>
        <tbody>
          {REGISTRY_ITEMS.map((item) => (
            <tr key={item.name}>
              <td>
                <code>@nysgpt/{item.name}</code>
              </td>
              <td>{item.kind}</td>
              <td>{item.what}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {GROUPS.map((g) => (
        <React.Fragment key={g}>
          <H2 id={g}>{BLOCK_GROUP_LABEL[g]}</H2>
          <div data-not-typeset="true" className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-x-8 lg:gap-x-16 lg:gap-y-5">
            {BLOCK_DOCS.filter((d) => d.group === g).map((d) => (
              <Link key={d.slug} href={`/docs/blocks/${d.slug}`} className="inline-flex items-center gap-2 text-lg font-medium underline-offset-4 hover:underline md:text-base">
                {d.title}
              </Link>
            ))}
          </div>
        </React.Fragment>
      ))}
    </DocsPage>
  )
}
