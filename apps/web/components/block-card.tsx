"use client"

import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import type { Committee, MemberRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// A block, as it sits in the rail of a public page (Brendan, 2026-09-04):
// the card chrome with the ⋮ block menu, and the jurisdiction's two chambers
// with their counts — members for the Member Block, committees for the
// Committee Block — each a link into the records. The same card a signed-in
// reader can take to /create. Members are the sitting ones, as the tree's
// Members folder counts them.

function chambers<T extends { chamber?: string | null }>(rows: T[] | undefined) {
  const count = (name: string) => (rows ?? []).filter((r) => (r.chamber ?? "").toLowerCase() === name.toLowerCase()).length
  return [
    { name: "House", n: count("House") + count("Assembly") },
    { name: "Senate", n: count("Senate") },
  ]
}

export function MemberBlock({ state, session }: { state: string; session?: number | null }) {
  const { data } = usePolicy<MemberRow[]>("members", { state, session: session ? String(session) : undefined })
  return (
    <CardFrame id="member-block" className="shrink-0">
      <CardHeader>
        <CardTitle>Member Block</CardTitle>
        <CardDescription>Bills organized by Member</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {chambers(data?.filter((m) => m.active)).map((c) => (
            <Item key={c.name} variant="outline" size="sm" render={<Link href={`/docs/directory?state=${state}&chamber=${c.name}`} />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={c.name} size={28} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{c.name}</ItemTitle>
              </ItemContent>
              <span className="text-sm font-semibold tabular-nums">{data ? fmtNumber(c.n) : "…"}</span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}

export function CommitteeBlock({ state, session }: { state: string; session?: number | null }) {
  const { data } = usePolicy<Committee[]>("committees", { state, session: session ? String(session) : undefined })
  return (
    <CardFrame id="committee-block" className="shrink-0">
      <CardHeader>
        <CardTitle>Committee Block</CardTitle>
        <CardDescription>Bills organized by committee</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {chambers(data).map((c) => (
            <Item key={c.name} variant="outline" size="sm" render={<Link href={`/docs/committees?state=${state}&chamber=${c.name}`} />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={c.name} size={28} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{c.name}</ItemTitle>
              </ItemContent>
              <span className="text-sm font-semibold tabular-nums">{data ? fmtNumber(c.n) : "…"}</span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}
