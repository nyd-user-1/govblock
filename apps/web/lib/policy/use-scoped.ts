"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"

// One scoped read. It holds until the jurisdiction is known — the prerendered
// HTML is shared by every visitor, so issuing a request before then would ask
// Congress on behalf of a Texas reader — and then follows the scope.
//
// `fallback` is the committed Congress fixture, and the hook is the only thing
// allowed to decide whether it may stand in: **only under Congress**. Under any
// other jurisdiction `data` is undefined until that jurisdiction's own rows
// arrive, so the surface renders its own loading or empty state. A caller that
// cannot use `fallback` directly — the several cards whose fixture is shaped
// differently from the API — must gate on `congress` rather than reaching for
// the fixture itself. Congress's rows under another state's name are a lie, and
// a quieter one than an empty card.
export function useScoped<T>(
  resource: string,
  fallback: T,
  extra: Record<string, string | number | undefined> = {}
) {
  const { state, session, resolved } = useJurisdiction()
  const { data, isLoading } = usePolicy<T>(
    resolved ? resource : null,
    { state, session: session ? String(session) : undefined },
    extra
  )
  const pending = !resolved || isLoading
  const congress = state === "US"
  return {
    data: data ?? (pending && congress ? fallback : data),
    /** Whether a committed Congress fixture may stand in for missing rows. */
    congress,
    pending,
    state,
    session,
    resolved,
  }
}
