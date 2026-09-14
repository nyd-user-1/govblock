import type { Metadata } from "next"

import { ErdCanvas } from "@/components/erd/canvas"
import { buildGraph } from "@/lib/erd/model"

// /erd (Brendan, 2026-09-14): the policy database, every relation on one
// canvas, grouped by what it serves. An inventory page like /routes. The
// shape is read from Aurora by scripts/erd/snapshot.mjs and committed, so
// the page costs the database nothing; run the script after a schema change.

export const metadata: Metadata = { title: "ERD", description: "Every table in the policy database and how they join." }

export default function ErdPage() {
  const graph = buildGraph()
  const tables = graph.tables.filter((t) => t.kind === "table").length
  const views = graph.tables.length - tables
  const declared = graph.links.filter((l) => l.declared).length
  const inferred = graph.links.length - declared
  const schemas = new Set(graph.tables.map((t) => t.schema)).size
  const rows = graph.tables.reduce((n, t) => n + (t.rows ?? 0), 0)
  return (
    <div className="container-wrapper px-4 py-6 md:px-6">
      <div className="container flex flex-col gap-4 px-0">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">ERD</h1>
          <p className="text-muted-foreground">
            {tables} tables and {views} views in {schemas} schemas, {(rows / 1e6).toFixed(0)}M rows. {declared} links the database declares, {inferred} read off column names. Snapshot of{" "}
            {graph.generatedAt.slice(0, 10)}.
          </p>
        </header>
        <div className="h-[calc(100svh-var(--header-height)-9rem)] min-h-[560px]">
          <ErdCanvas graph={graph} />
        </div>
      </div>
    </div>
  )
}
