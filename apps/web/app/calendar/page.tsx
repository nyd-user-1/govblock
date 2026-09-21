import type { Metadata } from "next"

import { CalendarWorkspace } from "@/components/workspace/calendar-workspace"

// /calendar (Brendan, 2026-09-21): the workspace's calendar as a showpiece —
// every committee hearing by day, week and month, and nothing to add, move,
// edit or delete. The working copy is /workspace/calendar, and the account
// home's Calendar section.
export const metadata: Metadata = { title: "Calendar", description: "Every committee hearing on the calendar, by day, week and month." }

export default function CalendarIndexPage() {
  return <CalendarWorkspace showpiece />
}
