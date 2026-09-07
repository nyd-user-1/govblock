import { DashboardWorkspace } from "@/components/workspace/dashboard-workspace"

// Between one dashboard and the next (Brendan, 2026-09-07: "use skeleton to
// go from one dashboard to another"): the same frame, rail and footer, with
// the Dashboard Skeleton on the stage until the page arrives.
export default function DashboardLoading() {
  return <DashboardWorkspace page="skeleton" />
}
