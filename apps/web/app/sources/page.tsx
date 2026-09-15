import type { Metadata } from "next"
import { ExternalLinkIcon } from "lucide-react"

import { FEDERAL, FEDERAL_AGENCIES, LAW_PUBLISHERS, MAPS, MODEL_LEGISLATION, MONEY, NEW_YORK_AGENCIES, NEWS, SERVICES, STATES, type Source } from "@/lib/sources"
import { FormSeal } from "@/components/policy/forms-seal"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { RecordAvatar } from "@/components/policy/record-item"

// /sources (Brendan, 2026-09-15): every source as a gallery, one card each,
// in place of the source line at the foot of every record page.

export const metadata: Metadata = { title: "Sources" }

const host = (url: string) => new URL(url).host.replace(/^www\./, "")

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 no-underline transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <div className="flex items-center justify-between">
        {source.form ? (
          <FormSeal gov={source.form.gov} agency={source.form.agency} size={36} />
        ) : source.image?.startsWith("/seals/") ? (
          <RecordAvatar src={source.image} alt={source.name} size={36} />
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
        <span className="text-sm font-semibold text-foreground">{source.name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{host(source.url)}</span>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {source.provides.map((item) => (
          <span key={item} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </a>
  )
}

function Gallery({ title, sources }: { title: string; sources: Source[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        {title} <span className="text-base font-normal text-muted-foreground tabular-nums">{sources.length}</span>
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {sources.map((source) => (
          <SourceCard key={source.key} source={source} />
        ))}
      </div>
    </section>
  )
}

export default function SourcesPage() {
  return (
    <div className="container-wrapper">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-10 md:px-6 md:py-14">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Sources</h1>
        <Gallery title="Congress" sources={FEDERAL} />
        <Gallery title="State legislatures" sources={STATES} />
        <Gallery title="State law" sources={LAW_PUBLISHERS} />
        <Gallery title="Money and lobbying" sources={MONEY} />
        <Gallery title="Federal agencies" sources={FEDERAL_AGENCIES} />
        <Gallery title="New York agencies" sources={NEW_YORK_AGENCIES} />
        <Gallery title="Model legislation" sources={MODEL_LEGISLATION} />
        <Gallery title="News" sources={NEWS} />
        <Gallery title="Maps" sources={MAPS} />
        <Gallery title="APIs and services" sources={SERVICES} />
      </div>
    </div>
  )
}
