import { CalendarShell } from "@/components/calendar/calendar-shell"

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CalendarShell>{children}</CalendarShell>
}
