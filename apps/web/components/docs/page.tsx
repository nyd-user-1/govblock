import type { Metadata } from "next"
import { promises as fs } from "node:fs"
import path from "node:path"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CodeFigure } from "@/components/code-block"
import { ComponentPreview } from "@/components/docs/previews"
import { InstallCommand } from "@/components/docs/install-command"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, Table } from "@/components/typeset"
import { REGISTRY_ITEMS, registryItem } from "@/lib/workspace/registry-items"

// One registry item's page (Brendan, 2026-09-12), in the shape of a shadcn
// component page: the preview, Installation with the data-set switch, Usage,
// the API reference, and the source as the registry serves it. Static, one
// per item; the source is read from the built registry at build time.

type BuiltFile = { path: string; target?: string; content?: string; type: string }
type Built = { name: string; files: BuiltFile[]; registryDependencies?: string[]; dependencies?: string[] }

export function generateStaticParams() {
  return REGISTRY_ITEMS.map((i) => ({ name: i.name }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const item = registryItem(name)
  return item ? { title: item.title, description: item.what } : {}
}

const STYLE: Record<string, string> = {
  base: "Built on Base UI, the primitives this site draws with. Install into a Base UI project (shadcn's base-* styles).",
  radix: "Built on Radix primitives. Install into a Radix project (shadcn's default and new-york styles).",
  both: "Works in a Base UI or a Radix project; it reaches only for primitives both ship.",
  none: "No UI primitives underneath; installs into any project.",
}

export default async function ComponentDocPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const item = registryItem(name)
  if (!item) notFound()
  const built = await fs
    .readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "r", `${name}.json`), "utf8")
    .then((t) => JSON.parse(t) as Built)
    .catch(() => null)
  const sorted = [...REGISTRY_ITEMS].sort((a, b) => a.title.localeCompare(b.title))
  const at = sorted.findIndex((i) => i.name === name)
  const previous = sorted[at - 1]
  const next = sorted[at + 1]
  const toc = [
    { title: "Installation", url: "#installation", depth: 2 },
    { title: "Usage", url: "#usage", depth: 2 },
    ...(item.data ? [{ title: "Data", url: "#data", depth: 2 }] : []),
    { title: "API Reference", url: "#api-reference", depth: 2 },
    { title: "Source", url: "#source", depth: 2 },
  ]
  return (
    <DocsPage
      title={item.title}
      description={item.what}
      slug={`/docs/components/${name}`}
      previous={previous ? { name: previous.title, url: `/docs/components/${previous.name}` } : { name: "Components", url: "/docs/components" }}
      next={next ? { name: next.title, url: `/docs/components/${next.name}` } : { name: "Blocks", url: "/docs/blocks" }}
      rail={<DocsTableOfContents toc={toc} />}
    >
      <ComponentPreview name={name} fallback={<CodeFigure code={item.usage} />} />
      <p>{STYLE[item.style]}</p>

      <H2 id="installation">Installation</H2>
      <InstallCommand name={name} data={item.data} />
      {built?.registryDependencies?.length ? (
        <p>
          Arrives with{" "}
          {built.registryDependencies.map((d, i) => (
            <span key={d}>
              {i > 0 && ", "}
              {d.startsWith("@44gov/") ? <Link href={`/docs/components/${d.slice(7)}`}><code>{d}</code></Link> : <code>{d}</code>}
            </span>
          ))}
          .{built.dependencies?.length ? <> Installs <code>{built.dependencies.join("</code>, <code>")}</code> from npm.</> : null}
        </p>
      ) : null}

      <H2 id="usage">Usage</H2>
      <CodeFigure code={`import { ${item.exports.join(", ")} } from "@/${item.target}"`} />
      <CodeFigure code={item.usage} />

      {item.data && (
        <>
          <H2 id="data">Data</H2>
          <p>
            {item.data.what} Switch on <em>Add the data set</em> above and <code>{item.data.item}</code> lands beside the component as <code>lib/44gov/data/{item.data.file}.json</code>: {item.data.rows}, read from the same record the site reads, so the component draws the moment it is installed. Replace the file with your own rows in the same shape, or point the component at a live source.
          </p>
        </>
      )}

      <H2 id="api-reference">API Reference</H2>
      {item.props?.length ? (
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
            {item.props.map((p) => (
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
          Exports <code>{item.exports.join("</code>, <code>")}</code>. The signatures are in the source below.
        </p>
      )}

      <H2 id="source">Source</H2>
      <p>What the registry serves, file by file, as it lands in your tree.</p>
      {built?.files?.length ? (
        built.files.map((f) => <CodeFigure key={f.path} title={f.target ?? f.path} code={f.content ?? ""} collapsible />)
      ) : (
        <p>The registry has not been built for this item yet.</p>
      )}
    </DocsPage>
  )
}
