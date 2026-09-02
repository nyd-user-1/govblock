"use client"

import * as React from "react"

import { StatusChip } from "./status-chip"
import { useGoogle, type GoogleService } from "./google-state"
import { Button } from "@govblock/ui/components/nova/button"

// Connect, and the state of being connected, asked of the vault rather than
// remembered here — and asked once for the page, in GoogleConnections, so this
// button and the chip beside it cannot disagree about who is connected.
//
// One component now, not two: the All-connectors table is gone and the cards
// are the only surface, so the standalone button went with it.

// The bottom row of a Google card: the live status on the left, the thing to
// click on the right. Both read the one answer.
//
// The pending state is LOCAL, and that is the point. The connected answer is
// shared — one call for the whole page — but "Opening Google…" belongs to the
// card that was clicked; sharing it marched Drive, Docs and Sheets into the
// pending state together because all three ride the same grant, which told the
// reader three things were happening when one was.
export function ConnectRow({
  service,
  idleLabel,
}: {
  service: GoogleService
  /** What the chip says when there is no grant. A ride-along says its truth. */
  idleLabel?: string
}) {
  const { state, connect } = useGoogle(service)
  const [busy, setBusy] = React.useState(false)

  if (state.kind === "error")
    return <span className="text-xs text-destructive">{state.message}</span>

  if (state.kind === "connected")
    return <StatusChip state="connected" label="Connected in this browser" />

  if (state.kind === "unavailable")
    return <StatusChip state="unavailable" label="Not available yet" title={state.reason} />

  // No "Not connected" chip: the Connect button already says it. The chip slot
  // carries only a truth the button cannot — a ride-along's "Included in Drive",
  // or the checking pulse before the vault has answered.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {state.kind === "checking" ? (
        <StatusChip state="unknown" className="shrink-0" />
      ) : idleLabel ? (
        <StatusChip state="available" label={idleLabel} className="shrink-0" />
      ) : (
        <span />
      )}
      <Button
        size="sm"
        className="shrink-0"
        disabled={state.kind !== "ready" || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await connect()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? (service === "slack" ? "Opening Slack…" : "Opening Google…") : "Connect"}
      </Button>
    </div>
  )
}
