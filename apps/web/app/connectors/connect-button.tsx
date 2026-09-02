"use client"

import { StatusChip } from "./status-chip"
import { useGoogle, type GoogleService } from "./google-state"
import { Button } from "@govblock/ui/components/nova/button"

// Connect, and the state of being connected, asked of the vault rather than
// remembered here — and asked once for the page, in GoogleConnections, so this
// button and the chip beside it cannot disagree about who is connected.

export function ConnectButton({
  service,
  label,
}: {
  service: GoogleService
  label?: string
}) {
  const { state, connect } = useGoogle(service)

  if (state.kind === "checking")
    return <span className="text-xs text-muted-foreground">Checking…</span>
  if (state.kind === "connected")
    return (
      <span className="text-xs text-muted-foreground">
        Connected in this browser
      </span>
    )
  if (state.kind === "error")
    // What we lack, not what Google lacks — and visible, so an unwired
    // connector is a thing someone remembers to finish.
    return <span className="text-xs text-destructive">{state.message}</span>

  return (
    <Button
      size="sm"
      disabled={state.kind === "working"}
      onClick={() => void connect()}
    >
      {state.kind === "working" ? "Opening Google…" : (label ?? "Connect")}
    </Button>
  )
}

// The bottom row of a Google card: the live status on the left, the thing to
// click on the right. Both read the one answer.
export function ConnectRow({ service, label }: { service: GoogleService; label?: string }) {
  const { state, connect } = useGoogle(service)

  if (state.kind === "error")
    return <span className="text-xs text-destructive">{state.message}</span>

  if (state.kind === "connected")
    return <StatusChip state="connected" label="Connected in this browser" />

  // flex-wrap, not truncate: "Not connected" and Connect want 173.8px of a
  // 170.7px row, and a chip clipped to "Not connect…" is the same defect as the
  // name clipped to "Go…", one element over. Wrapping costs a line only on the
  // cards that need one.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <StatusChip
        state={state.kind === "checking" ? "unknown" : "available"}
        className="shrink-0"
      />
      <Button
        size="sm"
        className="shrink-0"
        disabled={state.kind !== "ready"}
        onClick={() => void connect()}
      >
        {state.kind === "working" ? "Opening Google…" : (label ?? "Connect")}
      </Button>
    </div>
  )
}

// The Status cell in the table, for the two connectors the server cannot answer
// for. Same answer as the card's, because it is literally the same answer.
export function ConnectStatus({ service }: { service: GoogleService }) {
  const { state } = useGoogle(service)
  return (
    <StatusChip
      state={
        state.kind === "connected"
          ? "connected"
          : state.kind === "checking"
            ? "unknown"
            : "available"
      }
    />
  )
}
