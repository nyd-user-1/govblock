import type { Metadata } from "next"

import { DashboardWorkspace } from "@/components/workspace/dashboard-workspace"

// /workspace/dashboard — the menu of every dashboard (Brendan, 2026-09-07:
// the Admin experience's pages, each at its own route beneath this one).
export const metadata: Metadata = { title: "Dashboards", description: "Every dashboard over the record: the session, its bills, members, committees, traffic and pipeline, each its own page." }

export default function DashboardsPage() {
  return <DashboardWorkspace />
}
