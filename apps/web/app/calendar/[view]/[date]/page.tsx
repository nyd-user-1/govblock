import { type Metadata } from "next"
import { notFound } from "next/navigation"
import { parseDate } from "@internationalized/date"

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Day, week and month views, drag and drop, and keyboard shortcuts.",
}

// The calendar itself renders from the `/calendar` layout, which persists
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
