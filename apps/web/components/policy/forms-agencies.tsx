"use client"

import * as React from "react"

import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useUrlParams } from "@/lib/policy/url-state"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { agencyName, FormSeal } from "@/components/policy/forms-seal"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Agencies — who hands the form out, and how many of theirs we hold. The
// Chambers card's shape, with the counts this page's rows actually have: the
// row filters the list beside it, and clicking the chosen one clears the filter.
//
// The counts follow the Forms/All documents toggle, because a card that said
// 176,284 US DOL documents while the list beside it showed none of them would
// be describing a different page.

type Facet = { value: string; count: number }
type Answer = { facets: { agency: Facet[] }; empty?: string }

export function FormsAgenciesCard({ compact = false }: { compact?: boolean }) {
  const { state, resolved } = useJurisdiction()
  const { agency, all } = useUrlParams(["agency", "all"] as const)
  const [answer, setAnswer] = React.useState<Answer | null>(null)

  React.useEffect(() => {
    if (!resolved) return
    // `limit=1` — the card wants the facets, not the rows, and the facets are
    // computed without the agency filter so choosing one never empties this.
    const params = new URLSearchParams({ state, limit: "1" })
    if (all === "1") params.set("all", "1")
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/policy/forms?${params}`)
        if (!response.ok) return
        const data = (await response.json()) as Answer
        if (!cancelled) setAnswer(data)
      } catch {
        // The list beside this card carries the failure message; a card that
        // says it twice is noise.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolved, state, all])

  const agencies = answer?.facets?.agency ?? []
  if (!resolved || answer?.empty) return null

  return (
    <CardFrame id="forms-agencies" size={compact ? "sm" : "default"}>
      <CardHeader>
        <CardTitle>Agencies</CardTitle>
        <CardDescription>Who hands the form out</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {agencies.map((row) => {
            const chosen = agency === row.value
            // A link, as the Chambers card does it: real navigation, reachable
            // from the keyboard, and `history.pushState` is what `url-state`
            // listens to, so the list beside it follows without a round trip.
            const params = new URLSearchParams({ state })
            if (!chosen) params.set("agency", row.value)
            if (all === "1") params.set("all", "1")
            return (
              <Item
                key={row.value}
                variant="muted"
                size={compact ? "sm" : "default"}
                data-active={chosen || undefined}
                className="data-[active=true]:bg-accent"
                render={<Link href={`/docs/forms?${params}`} className="no-underline" />}
              >
                <ItemMedia>
                  <FormSeal gov={govOf(state, row.value)} agency={row.value} size={compact ? 28 : 36} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{agencyName(govOf(state, row.value), row.value)}</ItemTitle>
                </ItemContent>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtNumber(row.count)}</span>
              </Item>
            )
          })}
          {!agencies.length && <p className="py-2 text-sm text-muted-foreground">No agencies in scope.</p>}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}

// New York's forms come from two govs and the card lists them together, so the
// three city agencies are named as the city's. Everything else under NY is the
// state's, and everything under Congress is federal.
const NYC_AGENCIES = new Set(["HRA", "HPD", "DHS"])
function govOf(state: string, agency: string) {
  if (state === "US") return "US"
  return NYC_AGENCIES.has(agency) ? "NYC" : "NYS"
}
