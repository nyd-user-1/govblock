"use client"

import * as React from "react"

import { claimCheck } from "@/lib/agents/claim-check"
import { Button } from "@govblock/ui/components/nova/button"

// Connect, and the state of being connected, asked of the vault rather than
// remembered here.
//
// One call answers both: the vault returns a token when this browser already
// has a grant and an authorize URL when it does not. So the button knows the
// truth on mount and there is no local flag to drift out of step with what
// Google actually holds. The cost is that a not-connected check opens an
// authorization session nobody walks through; it expires unused, and the
// alternative — a second source of truth about who is connected — is worse.

type State = "checking" | "connected" | "ready" | "working" | { error: string }

export function ConnectButton({ service, label }: { service: "drive" | "calendar"; label?: string }) {
  const [state, setState] = React.useState<State>("checking")

  const ask = React.useCallback(async (): Promise<{ connected: boolean; authorizeUrl?: string }> => {
    const response = await fetch(`/api/connectors/${service}/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimCheck: claimCheck() }),
    })
    const json = (await response.json()) as { connected?: boolean; authorizeUrl?: string; error?: string }
    if (json.error) throw new Error(json.error)
    return { connected: Boolean(json.connected), authorizeUrl: json.authorizeUrl }
  }, [service])

  React.useEffect(() => {
    let live = true
    ask()
      .then((r) => live && setState(r.connected ? "connected" : "ready"))
      .catch((e) => live && setState({ error: e instanceof Error ? e.message : String(e) }))
    return () => {
      live = false
    }
  }, [ask])

  if (state === "checking")
    return <span className="text-xs text-muted-foreground">Checking…</span>

  if (state === "connected")
    return <span className="text-xs text-muted-foreground">Connected in this browser</span>

  if (typeof state === "object")
    return (
      // What we lack, not what Google lacks — and visible, so an unwired
      // connector is a thing someone remembers to finish.
      <span className="text-xs text-destructive">{state.error}</span>
    )

  return (
    <Button
      size="sm"
      disabled={state === "working"}
      onClick={async () => {
        setState("working")
        try {
          const r = await ask()
          if (r.connected) return setState("connected")
          if (r.authorizeUrl) window.location.href = r.authorizeUrl
        } catch (e) {
          setState({ error: e instanceof Error ? e.message : String(e) })
        }
      }}
    >
      {state === "working" ? "Opening Google…" : (label ?? "Connect")}
    </Button>
  )
}
