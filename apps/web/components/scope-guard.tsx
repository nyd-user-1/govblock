"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import { askOfPath, doorHref, entitled, reasonFor, type Ask, type Reason, type Verdict } from "@/lib/entitlements"
import { DEFAULT_STATE, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { SessionRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { FlagChip } from "@/components/policy/imagery"
import { useScopeMark } from "@/components/scope-mark"
import { Button } from "@govblock/ui/components/nova/button"

// The gate over every page (Brendan, 2026-09-13): what the bills page has
// worn since 2026-09-11 — the page there to be seen, blurred and inert, and
// a card over it with the two ways on — for any page whose scope the reader
// may not open. The scope is the path's when the path names one (a state's
// bills, a session under a dataset), the record's when the page marks it (a
// bill by id), and the header's otherwise. No dialog: a dialog closes on a
// click past it, and this must not ("that's not a very good gate"). And no
// close cross (Brendan, 2026-09-14: "a gate that doesn't gate"), except for
// an admin, who sees the card everyone else meets and may put it aside.

/** The nearest Congress: the same kind of page, for the jurisdiction everyone may open. */
function congressHref(pathname: string): string {
  const [head] = pathname.split("/").filter(Boolean)
  switch (head) {
    case "bills":
      return "/bills/us"
    case "desk":
      return "/desk/us"
    case "news":
    case "laws":
    case "legislative-subjects":
    case "policy-areas":
      return `/${head}`
    case "workspace":
      return pathname.startsWith("/workspace/data") ? "/workspace/data" : "/workspace"
    default:
      return "/"
  }
}

export function ScopeOverlay({ reason, state, verdict, onDecline, onClose, children }: { reason: Reason; state: string; verdict: Verdict; /** No thanks / Back: the page before this one (Brendan, 2026-09-13), and the browser forgets the state. */ onDecline: () => void; /** The x, for an admin only (2026-09-14): the card goes, the page stays. Absent, there is no x. */ onClose?: () => void; children: React.ReactNode }) {
  // A state's card (Brendan, 2026-09-13): the state's flag before the title
  // wherever a state is named, signed out or in. Signed out it is an
  // invitation, with No thanks / Sign Up for the two ways on.
  const named = reason.kind === "state"
  const invitation = named && verdict === "sign-in"
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div inert aria-hidden className="pointer-events-none flex min-h-[60vh] min-h-0 flex-1 flex-col select-none opacity-60 blur-[3px]">
        {children}
      </div>
      <div role="dialog" aria-modal="true" aria-labelledby="scope-gate-title" data-not-typeset="true" className="absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-16">
        <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg">
          {onClose && (
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="absolute top-3 right-3 size-7 text-muted-foreground">
              <XIcon />
            </Button>
          )}
          <h2 id="scope-gate-title" className="mt-0 flex items-center gap-3 pr-8 text-xl font-semibold">
            {named && <FlagChip state={state} width={28} className="shrink-0" />}
            <span>{reason.title}</span>
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">{reason.body}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onDecline}>
              {invitation ? "No thanks" : "Back"}
            </Button>
            <Button render={<Link href={doorHref(verdict)} />} nativeButton={false}>
              {verdict === "plan" ? (reason.kind === "state" ? `Add ${stateName(state)}` : "See plans") : invitation ? "Sign Up" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScopeGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const j = useJurisdiction()
  const mark = useScopeMark()
  const fromPath = React.useMemo(() => askOfPath(pathname), [pathname])
  // The header's scope is what the header shows (`state`), never what the
  // browser merely remembered: a stale memory falls back to Congress in the
  // jurisdiction hook and draws no card. The URL's `?state=` survives that
  // fallback, so a shared link still meets the card.
  const state = (mark?.state ?? fromPath.state ?? j.state).toUpperCase()
  const session = mark?.session ?? fromPath.session ?? null
  const entity = mark?.entity ?? fromPath.entity
  // The current session of the jurisdiction asked for: the header's when it
  // is the same one, the page's own knowledge when it marked one, a read of
  // its own otherwise — and only when a session is actually in question.
  const sameAsHeader = state === j.state
  const { data: rows } = usePolicy<SessionRow[]>(session != null && mark?.current == null && !sameAsHeader ? "sessions" : null, { state })
  const current = React.useMemo(() => {
    if (session == null) return null
    if (mark?.current != null) return mark.current
    const list = sameAsHeader ? j.sessions : (rows ?? [])
    const pick = list.find((r) => Number(r.bills) > 0) ?? list[0]
    return pick ? Number(pick.session_id) : null
  }, [session, mark?.current, sameAsHeader, j.sessions, rows])

  const exempt = fromPath.exempt && !mark
  const ask = React.useMemo<Ask>(() => ({ state, session, current, entity }), [state, session, current, entity])
  // The card is judged as everyone else would be judged: an admin meets the
  // same card (2026-09-14), with the rule itself already open for them.
  const admin = j.reader.admin === true
  const verdict: Verdict = exempt ? "open" : entitled({ ...j.reader, admin: false }, ask)
  // The x, the admin's alone on production, everyone's on a dev server
  // (Brendan, 2026-09-14): the card closes for this page and this scope,
  // and comes back on the next one. The gate itself stands in both.
  const dismissible = admin || process.env.NODE_ENV === "development"
  const [closed, setClosed] = React.useState<string | null>(null)
  const key = `${pathname}|${state}|${session ?? ""}|${entity}`
  // Nothing until the account is known: a flash of the gate at a signed-in
  // New Yorker is worse than a moment without it. And nothing until the
  // session in question can be compared with the current one.
  const show = verdict !== "open" && j.readerReady && (session == null || current != null) && !(dismissible && closed === key)
  if (!show) return <>{children}</>
  const reason = reasonFor(j.reader, ask)
  // No thanks, Back: the page the reader came from, with Congress remembered;
  // a link opened cold, with nothing behind it, goes to the same kind of page for Congress.
  const decline = () => {
    j.setState(DEFAULT_STATE, { force: true })
    if (window.history.length > 1) router.back()
    else router.push(congressHref(pathname))
  }
  return (
    <ScopeOverlay reason={reason} state={state} verdict={verdict} onDecline={decline} onClose={dismissible ? () => setClosed(key) : undefined}>
      {children}
    </ScopeOverlay>
  )
}
