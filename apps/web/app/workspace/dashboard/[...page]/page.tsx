import type { Metadata } from "next"

import { menuLabel } from "@/components/admin/items"
import { DashboardWorkspace } from "@/components/workspace/dashboard-workspace"
import { dashboardPage } from "@/lib/workspace/dashboard"

// /workspace/dashboard/<page> — one Admin page per route: committee,
// database, apps/users, settings/plan and the rest, named as the rail names
// them (Brendan, 2026-09-07). Sales, the rail's empty id, is /sales.
type Props = { params: Promise<{ page: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params
  return { title: menuLabel(dashboardPage(page)) }
}

export default async function DashboardPage({ params }: Props) {
  const { page } = await params
  return <DashboardWorkspace page={dashboardPage(page)} />
}
