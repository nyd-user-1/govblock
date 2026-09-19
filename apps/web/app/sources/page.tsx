import type { Metadata } from "next"
import { ExternalLinkIcon } from "lucide-react"

import { FEDERAL, FEDERAL_AGENCIES, LAW_PUBLISHERS, MAPS, MODEL_LEGISLATION, MONEY, NEW_YORK_AGENCIES, NEWS, SERVICES, STATES, type Source } from "@/lib/sources"
import { FormSeal } from "@/components/policy/forms-seal"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { RecordAvatar } from "@/components/policy/record-item"
import { assetUrl } from "@/lib/assets"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H2 } from "@/components/typeset"
import { GalleryGrid, SourceTags } from "@/components/sources/source-gallery"

// /sources (Brendan, 2026-09-15): every source as a gallery, one card each,
// in place of the source line at the foot of every record page. On the house
// layout since 2026-09-18 — the centre column between the two rails, as
// /bills and /mentions are — with the galleries in the right rail's contents.

const title = "Sources"
const description = "Every source the record is read from, one card each: who publishes it, and what GovBlock takes from it."

export const metadata: Metadata = { title, description }

const host = (url: string) => new URL(url).host.replace(/^www\./, "")

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 no-underline transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <div className="flex h-9 items-center justify-between">
        {source.form ? (
          <FormSeal gov={source.form.gov} agency={source.form.agency} size={36} />
        ) : source.image?.startsWith("/seals/") ? (
          <RecordAvatar src={assetUrl(source.image)} alt={source.name} size={36} />
        ) : source.image ? (
          <img src={source.image} alt="" className="size-9 rounded-md object-contain" />
        ) : source.chamber ? (
          <ChamberSeal state={source.state ?? "US"} chamber={source.chamber} size={36} />
        ) : source.state ? (
          <FlagChip state={source.state} width={40} className="rounded-sm" />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">{source.name.slice(0, 2)}</span>
        )}
        <ExternalLinkIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 min-h-10 text-sm font-semibold text-foreground">{source.name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{host(source.url)}</span>
      </div>
      <SourceTags items={source.provides} />
    </a>
  )
}

const GALLERIES: { title: string; sources: Source[] }[] = [
  { title: "Congress", sources: FEDERAL },
  { title: "State legislatures", sources: STATES },
  { title: "State law", sources: LAW_PUBLISHERS },
  { title: "Money and lobbying", sources: MONEY },
  { title: "Federal agencies", sources: FEDERAL_AGENCIES },
  { title: "New York agencies", sources: NEW_YORK_AGENCIES },
  { title: "Model legislation", sources: MODEL_LEGISLATION },
  { title: "News", sources: NEWS },
  { title: "Maps", sources: MAPS },
  { title: "APIs and services", sources: SERVICES },
]

const anchor = (title: string) => title.toLowerCase().replace(/\s+/g, "-")

function Gallery({ title, sources }: { title: string; sources: Source[] }) {
  return (
    <GalleryGrid
      heading={
        <H2 id={anchor(title)} className="my-0!">
          {title} <span className="text-base font-normal text-muted-foreground tabular-nums">{sources.length}</span>
        </H2>
      }
    >
      {sources.map((source) => (
        <SourceCard key={source.key} source={source} />
      ))}
    </GalleryGrid>
  )
}

export default function SourcesPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/sources"
      previous={{ name: "Tags", url: "/tags" }}
      next={{ name: "Mentions", url: "/mentions" }}
      rail={<DocsTableOfContents toc={GALLERIES.map((g) => ({ title: g.title, url: `#${anchor(g.title)}`, depth: 2 }))} />}
    >
      {GALLERIES.map((g) => (
        <Gallery key={g.title} title={g.title} sources={g.sources} />
      ))}
    </DocsPage>
  )
}
