import type { Metadata } from "next"
import Link from "next/link"

import { CodeFigure } from "@/components/code-block"
import { CommandBlock } from "@/components/command-block"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2 } from "@/components/typeset"

// /docs/installation (Brendan, 2026-09-12): our own version of shadcn's
// installation page. One registry, named once, then the same CLI everyone
// already uses.

const title = "Installation"
const description = "Name the @44gov registry once in your project, then add any component, card, hook or library with the shadcn CLI."

export const metadata: Metadata = { title, description }

const toc = [
  { title: "Prerequisites", url: "#prerequisites", depth: 2 },
  { title: "Name the registry", url: "#registry", depth: 2 },
  { title: "Add a component", url: "#add", depth: 2 },
  { title: "Add its data", url: "#data", depth: 2 },
  { title: "Base UI or Radix", url: "#style", depth: 2 },
  { title: "Framework", url: "#framework", depth: 2 },
  { title: "Assets", url: "#assets", depth: 2 },
]

export default function InstallationPage() {
  return (
    <DocsPage title={title} description={description} slug="/docs/installation" previous={{ name: "Docs", url: "/docs" }} next={{ name: "CLI", url: "/docs/cli" }} rail={<DocsTableOfContents toc={toc} />}>
      <H2 id="prerequisites">Prerequisites</H2>
      <p>
        A project shadcn already knows: Next.js, Vite, Remix or any React app with Tailwind and a <code>components.json</code>. If you have none, shadcn&rsquo;s own <code>init</code> makes one.
      </p>
      <CommandBlock tabs={[{ value: "pnpm", label: "pnpm", lines: ["pnpm dlx shadcn@latest init"] }, { value: "npm", label: "npm", lines: ["npx shadcn@latest init"] }, { value: "yarn", label: "yarn", lines: ["yarn dlx shadcn@latest init"] }, { value: "bun", label: "bun", lines: ["bunx --bun shadcn@latest init"] }]} />

      <H2 id="registry">Name the registry</H2>
      <p>
        Once, in <code>components.json</code>. After this the CLI resolves <code>@44gov/…</code> the way it resolves shadcn&rsquo;s own items.
      </p>
      <CodeFigure title="components.json" code={`{\n  "registries": {\n    "@44gov": "https://44gov.nysgpt.com/r/{name}.json"\n  }\n}`} />
      <p>
        The registry is listed in shadcn&rsquo;s directory, so once that listing is live this step is optional: the CLI adds the entry itself the first time it sees <code>@44gov</code>.
      </p>

      <H2 id="add">Add a component</H2>
      <p>Anything an item depends on arrives with it: other @44gov items, shadcn primitives, npm packages.</p>
      <CommandBlock tabs={[{ value: "pnpm", label: "pnpm", lines: ["pnpm dlx shadcn@latest add @44gov/seals"] }, { value: "npm", label: "npm", lines: ["npx shadcn@latest add @44gov/seals"] }, { value: "yarn", label: "yarn", lines: ["yarn dlx shadcn@latest add @44gov/seals"] }, { value: "bun", label: "bun", lines: ["bunx --bun shadcn@latest add @44gov/seals"] }]} />
      <p>
        Every item&rsquo;s page under <Link href="/docs/components">Components</Link> carries its own command, what it exports, and where it lands in your tree.
      </p>

      <H2 id="data">Add its data</H2>
      <p>
        A component that shows the record can arrive with rows already in it. Each such item names a second item, <code>&lt;name&gt;-data</code>, that lands a JSON file under <code>lib/44gov/data/</code> read from the same record the site reads. Add both in one command, or switch on <em>Add the data set</em> on the item&rsquo;s page and copy the command it writes.
      </p>
      <CommandBlock tabs={[{ value: "pnpm", label: "pnpm", lines: ["pnpm dlx shadcn@latest add @44gov/votes-card @44gov/votes-card-data"] }, { value: "npm", label: "npm", lines: ["npx shadcn@latest add @44gov/votes-card @44gov/votes-card-data"] }, { value: "yarn", label: "yarn", lines: ["yarn dlx shadcn@latest add @44gov/votes-card @44gov/votes-card-data"] }, { value: "bun", label: "bun", lines: ["bunx --bun shadcn@latest add @44gov/votes-card @44gov/votes-card-data"] }]} />

      <H2 id="style">Base UI or Radix</H2>
      <p>
        GovBlocks draws with Base UI, so most components here are Base UI components and install cleanly into any of shadcn&rsquo;s <code>base-*</code> styles. Each page says which primitives it stands on: <em>base</em>, <em>radix</em>, <em>both</em>, or <em>none</em>. A <em>both</em> item reaches only for primitives the two ship alike. Install a <em>base</em> item into a Radix project and the CLI will fetch Base UI versions of the primitives it needs beside your own.
      </p>

      <H2 id="framework">Framework</H2>
      <p>
        The components are React and Tailwind. Where one links, it links with <code>next/link</code>; in another framework, swap that import for your router&rsquo;s Link. A card&rsquo;s links fall back to <code>gov.nysgpt.com</code> unless you hand it a route of your own.
      </p>

      <H2 id="assets">Assets</H2>
      <p>
        Flags, seals and boundary files are read from <code>44gov.nysgpt.com</code> by absolute URL, so nothing has to be copied into <code>public/</code>. They are public and free to use.
      </p>
    </DocsPage>
  )
}
