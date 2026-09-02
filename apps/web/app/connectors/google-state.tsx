"use client"

import * as React from "react"

import { claimCheck } from "@/lib/agents/claim-check"
import { forgetSession, loadSession, rememberSession } from "@/lib/agents/connect-session"

// One question, asked once, answered for the whole page.
//
// The vault is the only place that knows whether this browser holds a grant, so
// the card's chip and the card's button must not ask it separately — a chip
// rendered on the server saying "Not connected" beside a button saying
// "Connected in this browser" is the page contradicting itself in one row, and
// on this surface being right about who is connected is the entire product.
//
// Asking once also costs less than asking four times. The check and the connect
// are the same call — the vault returns a token when a grant exists and an
// authorize URL when it does not — so every extra caller opened an
// authorization session that nobody walked through. Two services, two calls,
// shared by the two cards and the two table rows that used to make four.

export type GoogleService = "drive" | "calendar"

export type GoogleState =
  | { kind: "checking" }
  | { kind: "connected" }
  | { kind: "ready" }
  | { kind: "error"; message: string }

const SERVICES: GoogleService[] = ["drive", "calendar"]

type Value = {
  state: Record<GoogleService, GoogleState>
  connect: (service: GoogleService) => Promise<void>
}

const Context = React.createContext<Value | null>(null)

async function askOnce(service: GoogleService, sessionUri: string | undefined, force = false) {
  const response = await fetch(`/api/connectors/${service}/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The session this browser already opened, so the vault answers about that
    // one instead of starting another nobody will walk through.
    body: JSON.stringify({ claimCheck: claimCheck(), sessionUri, force }),
  })
  const json = (await response.json()) as {
    connected?: boolean
    authorizeUrl?: string
    sessionUri?: string
    sessionStatus?: string
    error?: string
  }
  if (json.error) throw new Error(json.error)
  if (json.connected) forgetSession(service)
  // A pending answer carries no new session: the one being held is the one in
  // flight, so it stays held — the reader may be finishing consent in another
  // tab, and the next check is the one that finds the token.
  else if (json.sessionUri) rememberSession(service, json.sessionUri)
  return {
    connected: Boolean(json.connected),
    authorizeUrl: json.authorizeUrl,
    sessionStatus: json.sessionStatus,
  }
}

// A session outlives nothing and localStorage outlives everything, so a stale
// one would brick the surface for good: the stored uri fails, the failure is
// stored, and no click can ever get past it. One retry without it, once, and
// the browser starts a fresh session like it did before any of this.
async function ask(service: GoogleService) {
  const held = loadSession(service)
  try {
    return await askOnce(service, held)
  } catch (error) {
    if (!held) throw error
    forgetSession(service)
    return await askOnce(service, undefined)
  }
}

export function GoogleConnections({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Record<GoogleService, GoogleState>>({
    drive: { kind: "checking" },
    calendar: { kind: "checking" },
  })

  const set = React.useCallback(
    (service: GoogleService, next: GoogleState) =>
      setState((previous) => ({ ...previous, [service]: next })),
    []
  )

  React.useEffect(() => {
    let live = true
    for (const service of SERVICES)
      ask(service)
        .then(
          (r) =>
            live &&
            set(
              service,
              r.connected ? { kind: "connected" } : { kind: "ready" }
            )
        )
        .catch(
          (e) =>
            live &&
            set(service, {
              kind: "error",
              message: e instanceof Error ? e.message : String(e),
            })
        )
    return () => {
      live = false
    }
  }, [set])

  const connect = React.useCallback(
    async (service: GoogleService) => {
      try {
        const r = await ask(service)
        if (r.connected) return set(service, { kind: "connected" })
        if (r.authorizeUrl) window.location.href = r.authorizeUrl
      } catch (e) {
        set(service, {
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [set]
  )

  const value = React.useMemo(() => ({ state, connect }), [state, connect])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useGoogle(service: GoogleService) {
  const context = React.useContext(Context)
  if (!context) throw new Error("useGoogle outside GoogleConnections")
  return {
    state: context.state[service],
    connect: () => context.connect(service),
  }
}
