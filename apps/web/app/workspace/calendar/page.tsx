import type { Metadata } from "next"

import { CalendarWorkspace } from "@/components/workspace/calendar-workspace"

// /workspace/calendar — the dashboard's Calendar, the month on the record's
// hearings, as its own page of the workspace (Brendan, 2026-09-07: "grab the
// dashboard calendar and literally use that and place it in the shell").
export const metadata: Metadata = { title: "Calendar", description: "The month on the record: every hearing under the jurisdiction and session in scope, with the bills it takes up." }

export default function CalendarPage() {
  return <CalendarWorkspace />
}
