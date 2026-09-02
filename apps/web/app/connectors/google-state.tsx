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

// Slack rides the same machinery: its route answers the identical shape, so the
// provider treats it as a third service rather than growing a second provider.
export type GoogleService = "drive" | "calendar" | "slack"

export type GoogleState =
  | { kind: "checking" }
  | { kind: "connected" }
  | { kind: "ready" }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; message: string }

const SERVICES: GoogleService[] = ["drive", "calendar", "slack"]

const NAME: Record<GoogleService, string> = {
  drive: "Google Drive",
  calendar: "Google Calendar",
  slack: "Slack",
}

// What this browser last knew to be connected — so the return from a consent
// can say "Connected to Google Drive." for the thing that just changed, the
// way every connector UI a reader has ever used says it.
const CACHE = "govblock:connected-cache"
function cachedConnected(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CACHE) ?? "[]") as string[])
  } catch {
    return new Set()
  }
}
function rememberConnected(service: string, connected: boolean) {
  try {
    const set = cachedConnected()
    if (connected) set.add(service)
    else set.delete(service)
    localStorage.setItem(CACHE, JSON.stringify([...set]))
  } catch {}
}

type Value = {
  state: Record<GoogleService, GoogleState>
  connect: (service: GoogleService) => Promise<void>
}

const Context = React.createContext<Value | null>(null)

async function askOnce(service: GoogleService, sessionUri: string | undefined, force = false) {
  const heldBefore = loadSession(service)
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
    unavailable?: boolean
    reason?: string
    error?: string
  }
  if (json.error) throw new Error(json.error)
  if (json.connected) forgetSession(service)
  // FAILED is the vault's only definitive "this session is dead" — the enum is
  // exactly IN_PROGRESS | FAILED — so it is the one answer that earns a
  // discard. Anything else keeps the session, because it may still be the
  // handle on a consent the reader has finished.
  else if (json.sessionStatus === "FAILED") forgetSession(service)
  // A pending answer carries no new session: the one being held is the one in
  // flight, so it stays held — the reader may be finishing consent in another
  // tab, and the next check is the one that finds the token.
  // Store a new session ONLY when this call is the one that started it — a
  // click — or when the browser had none. A passive check must never overwrite
  // a session it did not open: that session may be the handle on a consent the
  // reader has just finished, and replacing it loses the grant exactly as
  // discarding it does. Same defect as the retry, one line further on.
  else if (json.sessionUri && (force || !heldBefore))
    rememberSession(service, json.sessionUri)
  return {
    connected: Boolean(json.connected),
    authorizeUrl: json.authorizeUrl,
    sessionStatus: json.sessionStatus,
    unavailable: Boolean(json.unavailable),
    reason: json.reason,
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
    // Re-ask without the session, but DO NOT throw the session away.
    //
    // This used to call forgetSession() first, and that made a transient
    // failure permanent: the held session is the only handle we have on a
    // consent the reader has already finished, so dropping it on any error —
    // a 502, a blip, anything — loses a completed grant for good, and every
    // check afterwards opens a fresh session and reads "not connected"
    // forever. A stale session costs one wasted call per check; a discarded
    // one costs the grant.
    //
    // The stale-session case the original guarded against is still handled,
    // and better: `forceAuthentication` on the click means a click never
    // depends on the held session at all, so nothing can be bricked by one.
    return await askOnce(service, undefined)
  }
}

export function GoogleConnections({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Record<GoogleService, GoogleState>>({
    drive: { kind: "checking" },
    calendar: { kind: "checking" },
    slack: { kind: "checking" },
  })

  const set = React.useCallback(
    (service: GoogleService, next: GoogleState) =>
      setState((previous) => ({ ...previous, [service]: next })),
    []
  )

  // Coming back from Google, the vault may not have finished recording the grant
  // in the instant the page mounts. The callback marks the return with
  // ?connected=1, so on exactly that load — and only that one — a service that
  // still reads not-connected is asked once more a moment later. It carries the
  // held session, so it opens nothing and costs nothing; it just gives the
  // write a second to land rather than telling the reader their consent failed.
  const justReturned = React.useRef(false)
  React.useEffect(() => {
    justReturned.current = new URLSearchParams(window.location.search).has("connected")
  }, [])

  // The one word a consent journey owes the reader at the end of it:
  // "Connected to Google Drive." — a toast on the return, for the service that
  // newly reads connected, and on a click that finds a grant already there.
  const [toast, setToast] = React.useState<string | null>(null)
  const toastTimer = React.useRef<number | undefined>(undefined)
  const announce = React.useCallback((service: GoogleService) => {
    setToast(`Connected to ${NAME[service]}.`)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 6000)
  }, [])

  React.useEffect(() => {
    let live = true
    for (const service of SERVICES)
      ask(service)
        .then((r) => {
          if (!live) return
          if (r.unavailable)
            return set(service, { kind: "unavailable", reason: r.reason ?? "Not available yet." })
          if (r.connected && justReturned.current && !cachedConnected().has(service))
            announce(service)
          rememberConnected(service, r.connected)
          set(service, r.connected ? { kind: "connected" } : { kind: "ready" })
          if (!r.connected && justReturned.current)
            window.setTimeout(() => {
              ask(service)
                .then((again) => {
                  if (!live || !again.connected) return
                  announce(service)
                  rememberConnected(service, true)
                  set(service, { kind: "connected" })
                })
                .catch(() => {})
            }, 1500)
        })
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

  // A click FORCES a new authorization. Twice now the intent was to drop the
  // held session on a click and twice the edit silently failed to land, so the
  // click kept using the passive path: it carried the session, the vault
  // answered about THAT session (IN_PROGRESS, no url), and the button had
  // nothing to open — "Opening Google…" for half a second and back to
  // "Connect", no navigation, no explanation.
  //
  // Dropping our copy is not enough on its own either, because the vault
  // remembers a reader's in-flight session server-side. `forceAuthentication`
  // is the parameter for exactly this — "always initiate a new 3LO flow,
  // regardless of any existing session" — and it is what a click means.
  // Passive checks still carry the held session; only a click forces.
  //
  // And whatever happens, the button never reverts in silence: a click that
  // produces no url says what the vault said. A control that appears to do
  // nothing is the one bug a reader cannot report usefully.
  const connect = React.useCallback(
    async (service: GoogleService) => {
      forgetSession(service)
      try {
        const r = await askOnce(service, undefined, true)
        if (r.unavailable)
          return set(service, { kind: "unavailable", reason: r.reason ?? "Not available yet." })
        if (r.connected) {
          announce(service)
          rememberConnected(service, true)
          return set(service, { kind: "connected" })
        }
        if (r.authorizeUrl) {
          window.location.href = r.authorizeUrl
          return
        }
        set(service, {
          kind: "error",
          message: `${service === "slack" ? "Slack" : "Google"} did not return a consent link${r.sessionStatus ? ` (${r.sessionStatus})` : ""}.`,
        })
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
  return (
    <Context.Provider value={value}>
      {children}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
          <span>{toast}</span>
          <button
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </Context.Provider>
  )
}

export function useGoogle(service: GoogleService) {
  const context = React.useContext(Context)
  if (!context) throw new Error("useGoogle outside GoogleConnections")
  return {
    state: context.state[service],
    connect: () => context.connect(service),
  }
}
