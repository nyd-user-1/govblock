import type { Metadata } from "next"

import { ErdCanvas } from "@/components/erd/canvas"
import { buildGraph } from "@/lib/erd/model"

// /erd (Brendan, 2026-09-14): the policy database, every relation on one
// canvas, grouped by what it serves. The shape is read from Aurora by
// scripts/erd/snapshot.mjs and committed, so the page costs the database
// nothing; run the script after a schema change.
//
// On DashboardPage since 2026-09-20 — a canvas is a full-screen tool, and it
// had been drawing itself into a fixed slice of the viewport under a heading.
// The canvas wears the shell itself, since the rail and the header hold its
// own controls.

export const metadata: Metadata = { title: "ERD", description: "Every table in the policy database and how they join." }

export default function ErdPage() {
  return <ErdCanvas graph={buildGraph()} />
}
