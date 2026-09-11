import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { SURFACES, type Surface } from "@/lib/workspace/path"
import { Designer } from "@/components/create/designer"

// The workspace's surfaces beside the data (Brendan, 2026-09-07; named
// surfaces, not rooms, 2026-09-11): the Agentic Inbox,
// the finance explorer, the forms and the documents, each at its own path
// now that /create is retired.
const TITLES: Record<Surface, string> = { inbox: "Agentic Inbox", finance: "Finance", forms: "Forms", documents: "Documents" }

export function generateStaticParams() {
  return SURFACES.map((surface) => ({ surface }))
}

export async function generateMetadata({ params }: { params: Promise<{ surface: string }> }): Promise<Metadata> {
  const { surface } = await params
  return { title: TITLES[surface as Surface] ?? "Workspace" }
}

export default async function SurfacePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params
  if (!(SURFACES as readonly string[]).includes(surface)) notFound()
  // Finance moved under the dashboards (Brendan, 2026-09-07).
  if (surface === "finance") redirect("/workspace/dashboard/finance")
  return <Designer route={{ surface: surface as Surface }} />
}
