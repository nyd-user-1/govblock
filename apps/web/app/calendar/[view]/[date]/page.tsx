import { redirect } from "next/navigation"

// The calendar kept its view and its date in this address until 2026-09-21;
// it holds them itself now, so an old link lands on the calendar.
export default function CalendarViewPage() {
  redirect("/calendar")
}
