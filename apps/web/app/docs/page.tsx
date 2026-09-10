import type { Metadata } from "next"
import Link from "next/link"

import { DocsPage } from "@/components/docs-page"

// /docs is documentation again (Brendan, 2026-09-10). It used to bounce to the
// bills page, because the record lived here and there was nothing else to land
// on. The record has moved to the root and this is what is left: how to read
// the data, how to install the parts, and what changed.

const title = "Docs"
const description =
  "How to build on GovBlock: the API the pages are drawn from, the parts you can install into your own app, the bulk datasets, and what has changed."

export const metadata: Metadata = { title, description }

const SECTIONS = [
  {
    href: "/docs/api",
    title: "API",
    body: "Every resource the site reads, on the same public routes the pages use.",
  },
  {
    href: "/docs/blocks",
    title: "Blocks",
    body: "The registry, and the blocks the site is built from with their props and their source.",
  },
  {
    href: "/docs/datasets",
    title: "Bulk Datasets",
    body: "The whole record as files, per jurisdiction, for work too big for the API.",
  },
  {
    href: "/docs/changelog",
    title: "Changelog",
    body: "What shipped, newest first.",
  },
]

export default function DocsIndex() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs"
      next={{ name: "API", url: "/docs/api" }}
    >
      <div
        data-not-typeset="true"
        className="mt-8 grid gap-6 sm:grid-cols-2"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col gap-1 rounded-xl border p-5 transition-colors hover:bg-accent/50"
          >
            <span className="font-medium underline-offset-4 group-hover:underline">
              {section.title}
            </span>
            <span className="text-sm text-muted-foreground">{section.body}</span>
          </Link>
        ))}
      </div>
    </DocsPage>
  )
}
