import type { Metadata } from "next"
import { promises as fs } from "node:fs"
import path from "node:path"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BLOCK_DOCS, BLOCK_GROUP_LABEL, compositionIn, findBlockDoc, resourcesIn } from "@/lib/workspace/block-docs"
import { CodeFigure } from "@/components/code-block"
import { CommandBlock } from "@/components/command-block"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { PreviewFrame } from "@/components/preview-frame"
import { H2, Table } from "@/components/typeset"
import { BlockPreview } from "@/components/workspace/block-preview"

// One block's page (Brendan, 2026-09-07), in the shape of a shadcn component
// page: the preview, Installation (the command, or the source to copy),
// Usage, Composition, Data — the routes the block reads, found in its source
// — and the API reference. Static, one per slug.

export function generateStaticParams() {
  return BLOCK_DOCS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const doc = findBlockDoc(slug)
  return doc ? { title: doc.title, description: `The ${doc.title} block: preview, installation, usage, data and API.` } : {}
}

const COMMANDS = [
  { value: "pnpm", label: "pnpm", lines: (slug: string) => [`pnpm dlx shadcn@latest add @govblock/${slug}`] },
  { value: "npm", label: "npm", lines: (slug: string) => [`npx shadcn@latest add @govblock/${slug}`] },
  { value: "yarn", label: "yarn", lines: (slug: string) => [`yarn dlx shadcn@latest add @govblock/${slug}`] },
  { value: "bun", label: "bun", lines: (slug: string) => [`bunx --bun shadcn@latest add @govblock/${slug}`] },
]

export default async function BlockDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = findBlockDoc(slug)
  if (!doc) notFound()
  const source = await fs.readFile(path.join(process.cwd(), doc.file), "utf8").catch(() => "")
  const resources = resourcesIn(source)
  const composition = compositionIn(source, doc.component)
  const at = BLOCK_DOCS.findIndex((d) => d.slug === slug)
  const previous = BLOCK_DOCS[at - 1]
  const next = BLOCK_DOCS[at + 1]
  const importPath = `@/${doc.file.replace(/\.tsx$/, "")}`
  const toc = [
    { title: "Installation", url: "#installation", depth: 2 },
    { title: "Usage", url: "#usage", depth: 2 },
    { title: "Composition", url: "#composition", depth: 2 },
    { title: "Data", url: "#data", depth: 2 },
    { title: "API Reference", url: "#api-reference", depth: 2 },
  ]

  return (
    <DocsPage
      title={doc.title}
      description={`A ${BLOCK_GROUP_LABEL[doc.group].toLowerCase()} block. It lives at ${doc.lives}${doc.group === "bill" ? ", drawn here for the newest bill in scope" : ""}.`}
      slug={`/docs/blocks/${slug}`}
      previous={previous ? { name: previous.title, url: `/docs/blocks/${previous.slug}` } : { name: "Blocks", url: "/docs/blocks" }}
      next={next ? { name: next.title, url: `/docs/blocks/${next.slug}` } : { name: "Bulk Datasets", url: "/docs/datasets" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <PreviewFrame>
        <BlockPreview slug={slug} />
      </PreviewFrame>
      <p>
        <Link href={`/workspace/blocks/${slug}`}>Open it on the canvas</Link>, where it can be sized, coloured and rearranged with the rest.
      </p>

      <H2 id="installation">Installation</H2>
      <CommandBlock tabs={COMMANDS.map((c) => ({ value: c.value, label: c.label, lines: c.lines(slug) }))} />
      <p>Or copy the source into your project and update the import paths to match it.</p>
      <CodeFigure title={doc.file} code={source} collapsible />

      <H2 id="usage">Usage</H2>
      <CodeFigure code={`import { ${doc.component} } from "${importPath}"`} />
      <CodeFigure code={doc.usage} />

      <H2 id="composition">Composition</H2>
      <p>The parts the block is built from, in the order they appear.</p>
      <CodeFigure code={composition.map((c, i) => (i === 0 ? c : `${i === composition.length - 1 ? "└──" : "├──"} ${c}`)).join("\n")} />

      <H2 id="data">Data</H2>
      {resources.length ? (
        <>
          <p>The routes the block reads, each under the jurisdiction and year in scope. Every one is documented in the API.</p>
          <ul>
            {resources.map((r) => (
              <li key={r}>
                <Link href={`/docs/api#${r}`}>
                  <code>/api/policy/{r}</code>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>The block reads no route of its own. What it shows comes from the page that holds it.</p>
      )}

      <H2 id="api-reference">API Reference</H2>
      {doc.props?.length ? (
        <Table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {doc.props.map((p) => (
              <tr key={p.name}>
                <td>
                  <code>{p.name}</code>
                </td>
                <td>
                  <code>{p.type}</code>
                </td>
                <td>{p.default ? <code>{p.default}</code> : "—"}</td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p>
          <code>{doc.component}</code> takes no props. It reads the jurisdiction and year from the page.
        </p>
      )}
    </DocsPage>
  )
}
