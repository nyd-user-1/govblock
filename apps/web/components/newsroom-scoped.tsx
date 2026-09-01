"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { StreamGroup } from "@/lib/policy/stream"
import { usePolicy } from "@/lib/policy/use-policy"
import { NewsroomPage, type Newsroom } from "@/components/newsroom"

// The News Room for whichever jurisdiction is in scope.
//
// The page itself stays a static shell rendered for Congress, and this picks up
// once the scope is known. Reading `?state=` on the server instead would make
// the route dynamic for everybody and uncacheable; going through
// /api/policy/newsroom means CloudFront holds the answer for half an hour *per
// jurisdiction*, so the second visitor to any desk is served from the edge.

export function NewsroomScoped({
  initial,
  initialState,
  initialSession,
  initialOthers,
  desks,
}: {
  initial: Newsroom
  initialState: string
  initialSession: number
  initialOthers: StreamGroup[]
  desks: string[]
}) {
  const { state, session, resolved } = useJurisdiction()

  // Congress is what the server already rendered, so it needs no second read.
  const scoped = resolved && state !== initialState
  const { data, isLoading } = usePolicy<Newsroom>(scoped ? "newsroom" : null, { state })

  const otherDesks = React.useMemo(() => desks.filter((d) => d !== state).slice(0, 3), [desks, state])
  const { data: others } = usePolicy<StreamGroup[]>(
    scoped ? "stream" : null,
    { state },
    { states: otherDesks.join(","), limit: 2 }
  )

  if (!scoped) {
    return (
      <div data-source="server">
        <NewsroomPage data={initial} state={initialState} session={initialSession} others={initialOthers} />
      </div>
    )
  }

  if (!data) {
    return (
      <p className="container-wrapper px-6 py-10 text-sm text-muted-foreground">
        {isLoading ? `Loading the ${stateName(state)} desk…` : `Nothing on file for ${stateName(state)}.`}
      </p>
    )
  }

  return (
    <div data-source="database">
      <NewsroomPage
        data={data}
        state={state}
        session={session ?? initialSession}
        others={others ?? initialOthers.filter((g) => g.state !== state)}
      />
    </div>
  )
}
