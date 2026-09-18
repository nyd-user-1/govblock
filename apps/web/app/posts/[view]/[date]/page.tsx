import { notFound } from "next/navigation"
import { parseDate } from "@internationalized/date"

// The calendar itself renders from the `/posts` layout, which persists
// while the month view rewrites the date in the URL as it scrolls. This page
// only validates the route.
export default async function CalendarViewPage({
  params,
}: {
  params: Promise<{ view: string; date: string }>
}) {
  const { view, date } = await params

  if (!["day", "week", "month"].includes(view)) {
    notFound()
  }

  try {
    parseDate(date)
  } catch {
    notFound()
  }

  return null
}
