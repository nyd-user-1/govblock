"use client"

import * as React from "react"

import { CalendarProvider } from "@/components/calendar/calendar-provider"
import { useWorkspaceSource } from "@/components/calendar/hearing-source"
import { CalendarPane, ViewToggle, useCalendarTitle } from "@/components/workspace/calendar-embed"
import { useAccount } from "@/lib/auth/use-account"

// The account home's Calendar (Brendan, 2026-09-21), under Analytics: the one
// calendar — /workspace/calendar's — without its rail, at the page's width.
// The month stands in the card's head while the weeks scroll under it; a
// double click on a day adds an event, for a reader who has signed in; until
// then nothing on it can be added or changed. It reads as the page opens, as the
// tiles above it do, and leaves the keyboard to the page: the calendar's
// shortcuts belong to the surface that is nothing but a calendar.

function Frame() {
  const month = useCalendarTitle()
  return (
    <div className="flex h-[680px] flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <p className="text-sm font-medium">{month}</p>
        <div className="ml-auto">
          <ViewToggle />
        </div>
      </div>
      <CalendarPane />
    </div>
  )
}

export function HomeCalendar() {
  const { signedIn } = useAccount()
  return (
    <section id="calendar" className="scroll-mt-24">
      <h2 className="mb-4 text-lg font-semibold">Calendar</h2>
      {/* No LiveFetch (2026-09-22): the calendar waits for the page's refresh button, as every other panel here does. */}
      <CalendarProvider embedded shortcuts={false} readOnly={!signedIn} useSource={useWorkspaceSource}>
        <Frame />
      </CalendarProvider>
    </section>
  )
}
