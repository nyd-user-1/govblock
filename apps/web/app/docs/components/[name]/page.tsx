import type { Metadata } from "next"
import * as React from "react"
import { promises as fs } from "node:fs"
import path from "node:path"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CodeFigure } from "@/components/code-block"
import { ComponentPreview } from "@/components/docs/previews"
import { InstallCommand } from "@/components/docs/install-command"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2, H3, Table } from "@/components/typeset"
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
      <H2 id="installation">Installation</H2>
      <InstallCommand name={name} data={item.data} />
      <p>
        First time here? Name the registry once in <code>components.json</code>, and every <code>@44gov</code> command resolves: <Link href="/docs/installation#registry">Installation</Link>.
      </p>
      {(() => {
        const deps = (built?.registryDependencies ?? []).filter((d) => d !== "utils")
        const npm = built?.dependencies ?? []
        const next = built?.files?.some((f) => /from "next\//.test(f.content ?? "")) ?? false
        if (!deps.length && !npm.length && !next) return null
        return (
          <>
            <H3 id="dependencies">Dependencies</H3>
            <ul>
              {deps.length > 0 && (
                <li>
                  Registry:{" "}
                  {deps.map((d, i) => (
                    <React.Fragment key={d}>
                      {i > 0 && ", "}
                      {d.startsWith("@44gov/") ? (
                        <Link href={`/docs/components/${d.slice(7)}`}>
                          <code>{d}</code>
                        </Link>
                      ) : (
                        <code>{d}</code>
                      )}
                    </React.Fragment>
                  ))}
                  . Installed with it; a shadcn primitive comes in your project&rsquo;s own style.
                </li>
              )}
              {npm.length > 0 && (
                <li>
                  npm:{" "}
                  {npm.map((d, i) => (
                    <React.Fragment key={d}>
                      {i > 0 && ", "}
                      <code>{d}</code>
                    </React.Fragment>
                  ))}
                </li>
              )}
              {next && (
                <li>
                  Framework: links are <code>next/link</code>. In another framework, swap the import for your router&rsquo;s Link; nothing else is Next-specific.
                </li>
              )}
            </ul>
          </>
        )
      })()}

      <H2 id="usage">Usage</H2>
      <CodeFigure code={`import { ${item.exports.join(", ")} } from "@/${item.target}"\n\n${item.usage}`} />
      {item.usageOwn && (
        <>
          <p>Or with rows of your own, in the same shape:</p>
          <CodeFigure code={item.usageOwn} />
        </>
      )}

      {item.data && (
        <>
          <H2 id="data">Data</H2>
          <p>
            With <em>Add the data set</em> on, <code>{item.data.item}</code> lands beside the component as <code>lib/44gov/data/{item.data.file}.json</code>, read from the same record the site reads, and the usage above works as pasted. Replace the file with rows of your own in the same shape, or hand the component a live source; switched off, only the component installs.
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
          Exports{" "}
          {item.exports.map((e, i) => (
            <React.Fragment key={e}>
              {i > 0 && ", "}
              <code>{e}</code>
            </React.Fragment>
          ))}
          .
        </p>
      )}
      {item.functions?.length ? (
        <>
          <H3 id="functions">Functions</H3>
          {item.functions.map((fn) => (
            <React.Fragment key={fn.signature}>
              <CodeFigure code={fn.signature} lang="ts" />
              <p>{fn.description}</p>
            </React.Fragment>
          ))}
        </>
      ) : null}

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
