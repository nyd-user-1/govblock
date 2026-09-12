"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { TopicsCardBody, type TopicRow } from "@/components/cards/topics-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Topics, on the home page — LegiScan's subject tags where the jurisdiction
// has them, the committee a bill sits in where it does not.
export function TopicsCard() {
  const { data, state, congress } = useScoped<{ value: string; count: number }[]>("subjects", null as unknown as { value: string; count: number }[])
  const rows = React.useMemo<TopicRow[]>(() => (data ? data.slice(0, 8).map((r) => ({ label: r.value, bills: r.count })) : congress ? F.topics.rows : []), [data, congress])
  return (
    <CardFrame id="subjects">
      {/* No line under the chips (Brendan, 2026-09-09): it named LegiScan for every jurisdiction, and under Congress the terms are CRS's. */}
      <TopicsCardBody rows={rows} state={state} title={<CardAnchor>Topics</CardAnchor>} action={<ComponentActions rows={rows} id="topics" />} topicHref={(row) => `/bills?state=${state}&committee=${encodeURIComponent(row.label)}`} href={`/tags?state=${state}`} />
    </CardFrame>
  )
}
