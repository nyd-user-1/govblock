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
export function ConnectRow({ service }: { service: GoogleService }) {
  const { state, connect } = useGoogle(service)
  const [busy, setBusy] = React.useState(false)

  if (state.kind === "error")
    return <span className="text-xs text-destructive">{state.message}</span>

  // Connected reads like Discord's card: green dot, the word, and Manage —
  // which opens the place the grant is actually managed and revoked.
  if (state.kind === "connected")
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusChip state="connected" label="Connected" className="shrink-0" />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          render={
            <a
              href={
                service === "slack"
                  ? "https://slack.com/apps/manage"
                  : "https://myaccount.google.com/permissions"
              }
              target="_blank"
              rel="noreferrer"
            />
          }
          nativeButton={false}
        >
          Manage
        </Button>
      </div>
    )

  if (state.kind === "unavailable") return null

  // No chip of any kind on an unconnected card — Brendan's order, verbatim: the
  // card is logo, name, button. The button carries every state it needs.
  return (
    <div className="flex items-center justify-end">
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
