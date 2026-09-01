"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"

// One scoped read. It holds until the jurisdiction is known — the prerendered
// HTML is shared by every visitor, so issuing a request before then would ask
// Congress on behalf of a Texas reader — and then follows the scope.
//
// `fallback` is what to show while the first answer is in flight. It is the
// committed Congress fixture at every call site, so it may only stand in under
// Congress: the same rule as use-policy's error path, and for the same reason.
// Under any other jurisdiction the caller gets an empty list and says so.
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
  return {
    data: data ?? (pending && state === "US" ? fallback : data),
    pending,
    state,
    session,
    resolved,
  }
}
