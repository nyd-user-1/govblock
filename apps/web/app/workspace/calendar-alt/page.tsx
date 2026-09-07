import type { Metadata } from "next"

import { CalendarAltWorkspace } from "@/components/workspace/calendar-alt-workspace"

// /workspace/calendar-alt — the calendar block from /blocks/calendar as a
// page of the workspace, kept beside the calendar proper (Brendan,
// 2026-09-07): what the committees have calendared, as cards or a table.
export const metadata: Metadata = { title: "Calendar (alt)", description: "What the committees have calendared, as cards or a table, under the jurisdiction and session in scope." }

export default function CalendarAltPage() {
  return <CalendarAltWorkspace />
}
