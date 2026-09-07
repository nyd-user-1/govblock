import type { Metadata } from "next"

import { WorkspaceRoute } from "@/components/workspace/workspace-route"

// /workspace/data/us/house/2025/bill/hb9329 and every path beneath a dataset
// (Brendan, 2026-09-07): the browser /create was, with the location in the
// path. The page is static and shared; the path is read in the browser.
export const metadata: Metadata = { title: "Data", description: "A dataset, its sessions, and every bill, member, committee and roll call in it." }

export default async function WorkspaceDataPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return <WorkspaceRoute segments={path} />
}
