import type { Metadata } from "next"

import { AppWorkspace } from "@/components/workspace/app-workspace"

// /workspace — Workspace, the root of every workspace path (Brendan, 2026-09-11):
// one card per workspace, Data to Map.
export const metadata: Metadata = { title: "Workspace", description: "Every workspace as a card: Data, Dashboards, the Agentic Inbox, Calendar, Forms, Documents, Typeset, Blocks and Map." }

export default function AppPage() {
  return <AppWorkspace />
}
