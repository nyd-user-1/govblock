"use client"

import * as React from "react"

import { PX_PER_MINUTE } from "@/lib/calendar/layout"

export function NowIndicator() {
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!now) {
    return null
  }

  const top = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
      style={{ top: `${top}px` }}
    >
      <div className="absolute -start-1 -top-[5px] size-2 rounded-full bg-red-500" />
    </div>
  )
}
