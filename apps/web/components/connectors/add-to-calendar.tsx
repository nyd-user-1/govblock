"use client"

import * as React from "react"
import { IconCalendarPlus, IconExternalLink } from "@tabler/icons-react"

import { claimCheck } from "@/lib/agents/claim-check"
import { hearingWhen, instantWhen, type When } from "@/lib/policy/hearing-when"
import { cn } from "@/lib/utils"

// Add to calendar — the reader's own calendar, on their own grant.
//
// It does not check whether they are connected before they ask. The check and
// the connect are one call at the vault, and a check opens an authorization
// session; a month page with forty hearing rows would open forty of them for a
// reader who never clicked. So the first click is the check: the route answers
// with the event or with "not connected", and a reader who is not connected
// goes to /connectors, which is the page that explains what connecting means
// rather than a redirect they did not ask for.
//
// Nothing here costs a model run. The house cost line is for work that spends
// tokens, and this spends one Google API call.

type Result =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "added"; url: string }
  | { kind: "error"; message: string }

export function AddToCalendar({
  summary,
  description,
  when,
  url,
  className,
  label = "Add to calendar",
}: {
  summary: string
  description?: string
  when: When
  /** Where the hearing lives on our side; it rides in the event. Relative. */
  url?: string
  className?: string
  label?: string
}) {
  const [state, setState] = React.useState<Result>({ kind: "idle" })

  const add = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setState({ kind: "working" })
    try {
      const response = await fetch("/api/connectors/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimCheck: claimCheck(),
          action: "calendar",
          summary,
          description,
          start: when.start,
          end: when.end,
          timeZone: when.timeZone,
          url: url && url.startsWith("/") ? `${window.location.origin}${url}` : url,
        }),
      })
      const json = (await response.json()) as {
        connected?: boolean
        authorizeUrl?: string
        url?: string
        error?: string
      }
      if (json.connected === false) {
        window.location.href = "/connectors"
        return
      }
      if (json.error) throw new Error(json.error)
      setState({ kind: "added", url: json.url ?? "" })
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) })
    }
  }

  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs whitespace-nowrap no-underline transition-colors"

  if (state.kind === "added")
    return state.url ? (
      <a
        href={state.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(base, "text-emerald-600 hover:bg-muted dark:text-emerald-500", className)}
      >
        On your calendar
        <IconExternalLink className="size-3.5" />
      </a>
    ) : (
      <span className={cn(base, "text-emerald-600 dark:text-emerald-500", className)}>
        On your calendar
      </span>
    )

  if (state.kind === "error")
    // What we lack, said where the click happened, rather than a silent failure.
    return (
      <span className={cn(base, "text-destructive", className)} title={state.message}>
        {state.message.slice(0, 60)}
      </span>
    )

  return (
    <button
      type="button"
      aria-label={label || "Add this hearing to your calendar"}
      onClick={add}
      disabled={state.kind === "working"}
      title={
        when.allDay
          ? "Adds an all-day entry — the calendar we hold gives this hearing no time."
          : `Adds ${when.start.replace("T", " ")}${when.timeZone ? ` ${when.timeZone.split("/")[1].replace("_", " ")}` : ""}`
      }
      className={cn(
        base,
        "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60",
        className
      )}
    >
      <IconCalendarPlus className="size-3.5" />
      {state.kind === "working" ? "Adding…" : label}
      {!label && <span className="sr-only">Add this hearing to your calendar</span>}
    </button>
  )
}

export { hearingWhen, instantWhen }
