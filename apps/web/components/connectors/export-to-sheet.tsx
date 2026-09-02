"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { claimCheck } from "@/lib/agents/claim-check"
import { loadSession, rememberSession } from "@/lib/agents/connect-session"
import { cn } from "@/lib/utils"

// Export to Sheets — the rows on the page, as a spreadsheet in the reader's own
// Drive.
//
// It is the ride-along made real. `drive.file` covers every file this app
// creates in Google's editors, and Drive converts a CSV upload into a Sheet on
// the way in, so this needs no Sheets API, no second scope and no second
// consent: a reader who connected Drive can already do this and the Sheets card
// says exactly that.

type Result =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "saved"; url: string }
  | { kind: "error"; message: string }

export function ExportToSheet({
  name,
  rows,
  label = "Export to Sheets",
  className,
}: {
  name: string
  /** Header row first. */
  rows: () => string[][]
  label?: string
  className?: string
}) {
  const [state, setState] = React.useState<Result>({ kind: "idle" })

  const go = async () => {
    setState({ kind: "working" })
    try {
      const response = await fetch("/api/connectors/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimCheck: claimCheck(),
          sessionUri: loadSession("drive"),
          action: "sheet",
          name,
          rows: rows(),
        }),
      })
      const json = (await response.json()) as {
        connected?: boolean
        sessionUri?: string
        url?: string
        error?: string
      }
      if (json.connected === false) {
        // Carry the session forward so the connect the reader is about to walk
        // through is the one this browser will ask about afterwards.
        rememberSession("drive", json.sessionUri)
        window.location.href = "/connectors"
        return
      }
      if (json.error) throw new Error(json.error)
      setState({ kind: "saved", url: json.url ?? "" })
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) })
    }
  }

  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap no-underline"

  if (state.kind === "saved")
    return (
      <a
        href={state.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(base, "text-emerald-600 hover:bg-muted dark:text-emerald-500", className)}
      >
        <Check className="size-3.5" />
        Open the sheet
      </a>
    )

  if (state.kind === "error")
    return (
      <span title={state.message} className={cn(base, "max-w-60 truncate text-destructive", className)}>
        {state.message}
      </span>
    )

  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={state.kind === "working"}
      className={cn(
        base,
        "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60",
        className
      )}
    >
      <img
        src="/logos/google-sheets.svg"
        alt=""
        data-not-typeset=""
        className={cn("block size-3.5 object-contain", state.kind === "working" && "animate-pulse")}
      />
      {state.kind === "working" ? "Exporting…" : label}
    </button>
  )
}
