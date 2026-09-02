"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { claimCheck } from "@/lib/agents/claim-check"
import { loadSession, rememberSession } from "@/lib/agents/connect-session"
import { cn } from "@/lib/utils"

// Save to Drive — the report as a document in the reader's own Drive.
//
// The bytes are the ones already on the page. The route uploads with a Google
// Docs mimeType so Drive converts the markdown on the way in and what lands is
// a document they can open and edit, not a file they have to download.
//
// Like the calendar button, it does not ask the vault whether they are
// connected until they click: the check and the connect are one call, and a
// thread with six replies would open six authorization sessions for a reader
// who never asked for any. A reader who is not connected goes to /connectors,
// where what connecting means is written down.

type Result =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "saved"; url: string }
  | { kind: "error"; message: string }

export function SaveToDrive({
  name,
  markdown,
  className,
}: {
  /** The document's name in their Drive — the thread's subject reads best. */
  name: string
  markdown: string
  className?: string
}) {
  const [state, setState] = React.useState<Result>({ kind: "idle" })

  const save = async () => {
    setState({ kind: "working" })
    try {
      const response = await fetch("/api/connectors/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimCheck: claimCheck(),
          sessionUri: loadSession("drive"),
          action: "drive",
          name,
          markdown,
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

  const base = "rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"

  if (state.kind === "saved")
    return (
      <a
        href={state.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        title="Saved to your Drive — open it"
        className={cn(base, "inline-flex items-center gap-1 text-emerald-600 no-underline dark:text-emerald-500", className)}
      >
        <Check className="size-4" />
        <span className="sr-only">Open the document in your Drive</span>
      </a>
    )

  if (state.kind === "error")
    // Said where the click was, not swallowed — and it is about us: the vault,
    // the scope, or Drive's own answer, quoted.
    return (
      <span
        title={state.message}
        className={cn("max-w-40 truncate rounded-md p-1.5 text-xs text-destructive", className)}
      >
        {state.message}
      </span>
    )

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={state.kind === "working"}
      aria-label="Save this report to your Google Drive"
      title="Save this report to your Google Drive"
      className={cn(base, "disabled:opacity-60", className)}
    >
      {/* The brand mark, as on /connectors — a Drive action should look like
          Drive rather than like a generic upload arrow. */}
      <img
        src="/logos/google-drive.svg"
        alt=""
        data-not-typeset=""
        className={cn("block size-4 object-contain", state.kind === "working" && "animate-pulse")}
      />
    </button>
  )
}
