import type { Metadata } from "next"
import Link from "next/link"

import { CodeFigure } from "@/components/code-block"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2 } from "@/components/typeset"

// /docs/cli (Brendan, 2026-09-12): the shadcn CLI as it is used with @44gov.
// There is no CLI of our own — the registry is the whole of the integration.

const title = "CLI"
const description = "The shadcn CLI, as it is used with the @44gov registry: add, view, search, and build."

export const metadata: Metadata = { title, description }

const toc = [
  { title: "add", url: "#add", depth: 2 },
  { title: "view", url: "#view", depth: 2 },
  { title: "search", url: "#search", depth: 2 },
  { title: "Multiple items", url: "#multiple", depth: 2 },
  { title: "Overwrite", url: "#overwrite", depth: 2 },
  { title: "Build your own", url: "#build", depth: 2 },
]

export default function CliPage() {
  return (
    <DocsPage title={title} description={description} slug="/docs/cli" previous={{ name: "Installation", url: "/docs/installation" }} next={{ name: "Components", url: "/docs/components" }} rail={<DocsTableOfContents toc={toc} />}>
      <p>
        Everything below is shadcn&rsquo;s CLI. The only thing that is ours is the namespace. Name it once (<Link href="/docs/installation#registry">Installation</Link>) and every command works.
      </p>

      <H2 id="add">add</H2>
      <p>Adds an item and everything it depends on. The item&rsquo;s files land where its page says; primitives it needs come from shadcn or Base UI.</p>
      <CodeFigure code={`npx shadcn@latest add @44gov/seals`} />

      <H2 id="view">view</H2>
      <p>Prints an item as the registry serves it, files and all, without installing.</p>
      <CodeFigure code={`npx shadcn@latest view @44gov/district-join`} />

      <H2 id="search">search</H2>
      <p>Lists what the registry has, and filters it.</p>
      <CodeFigure code={`npx shadcn@latest search @44gov\nnpx shadcn@latest search @44gov -q map`} />

      <H2 id="multiple">Multiple items</H2>
      <p>Several at once, and a data set with its component.</p>
      <CodeFigure code={`npx shadcn@latest add @44gov/seals @44gov/directory-search @44gov/use-local\nnpx shadcn@latest add @44gov/votes-card @44gov/votes-card-data`} />

      <H2 id="overwrite">Overwrite</H2>
      <p>
        An item already in your tree is left alone unless you say otherwise. <code>--overwrite</code> takes the registry&rsquo;s copy; a data set added again with it refreshes the rows.
      </p>
      <CodeFigure code={`npx shadcn@latest add @44gov/votes-card-data --overwrite`} />

      <H2 id="build">Build your own</H2>
      <p>
        The registry itself is <code>registry.json</code> at the root of the GovBlocks repository, built with <code>shadcn build</code> into flat JSON under <code>/r</code>. Fork the repository and the same command publishes a registry of your own.
      </p>
      <CodeFigure code={`pnpm registry   # node scripts/registry/build.mjs → apps/web/public/r/*.json`} />
    </DocsPage>
  )
}
