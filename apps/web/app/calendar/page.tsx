import { redirect } from "next/navigation"
import { getLocalTimeZone, today } from "@internationalized/date"

export default function CalendarIndexPage() {
  redirect(`/calendar/month/${today(getLocalTimeZone()).toString()}`)
}
