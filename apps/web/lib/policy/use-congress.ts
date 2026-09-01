"use client"

import * as React from "react"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { policyUrl, usePolicy } from "@/lib/policy/use-policy"
import { resolveCongress } from "@/lib/policy/snapshot"
import { familyCount, rowsOf, scopedRows } from "@/lib/policy/congress"

export type Scope = { param: string; value: string | number }

/**
 * One read of a congress.gov family, scoped to one bill, member or committee.
 *
 * Three answers can come back and only one of them is the truth about the
 * thing on screen:
 *
 * 1. The route answered about *this* entity — a bare array (it could not have
 *    answered without the id), an envelope echoing the scope, or rows that name
 *    the entity themselves. Those rows win.
 * 2. The route answered about the whole congress, or about this entity with
 *    nothing in it because the link between the two is not harvested yet. Then
 *    the committed record for this entity answers instead: it came from the
 *    same API, for this bill or this committee, so it is real — only possibly
 *    older than Aurora.
 * 3. Neither has anything. The section says so.
 *
 * The order matters and is the whole point of the lane: the page reads Aurora
 * the moment Aurora knows, and its own records until then, and it never shows
 * one bill's rows under another bill's heading to bridge the gap.
 */
export function useCongress<T>(
  resource: string | null,
  key: string,
  scope: Scope | null,
  extra: Record<string, string | number | undefined> = {},
  names?: (row: T) => boolean
) {
  const { state, resolved } = useJurisdiction()
  const on = resolved && state === "US" && !!resource
  const { data } = usePolicy<unknown>(on ? resource : null, { state }, extra)

  const live = React.useMemo(
    () => (scope ? scopedRows<T>(data, key, scope, names) : rowsOf<T>(data, key)),
    [data, key, scope, names]
  )

  const url = on && resource ? policyUrl(resource, { state }, extra) : null
  const [committed, setCommitted] = React.useState<unknown>(undefined)
  const wanted = !!url && live.length === 0
  React.useEffect(() => {
    if (!wanted || !url) {
      setCommitted(undefined)
      return
    }
    let cancelled = false
    void resolveCongress(url).then((answer) => {
      if (!cancelled) setCommitted(answer)
    })
    return () => {
      cancelled = true
    }
  }, [url, wanted])

  const held = React.useMemo(
    () => (scope ? scopedRows<T>(committed, key, scope, names) : rowsOf<T>(committed, key)),
    [committed, key, scope, names]
  )

  const rows = live.length ? live : held
  return {
    rows,
    count: familyCount(live.length ? data : committed, rows),
    /** Which of the two answered, for a report and for a reader who asks. */
    source: live.length ? ("aurora" as const) : held.length ? ("committed" as const) : ("none" as const),
    onCongress: on,
  }
}
