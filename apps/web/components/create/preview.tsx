"use client"

import * as React from "react"

import { BillCard, CommitteeCard, MemberCard, type Bill, type Committee, type Member } from "@/components/create/entity-card"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

export type Entity = "bill" | "member" | "committee"
const PAGE = 6

// The preview: a paged grid of one component — the card — in whichever
// version is chosen. The kind switch sits top-left, the pager bottom-right, in
// livingston-v3's pill. Switching kinds shows the skeleton for a beat.
export function Preview({
  entity,
  setEntity,
  state,
  bills,
  members,
  committees,
  loading,
}: {
  entity: Entity
  setEntity: (e: Entity) => void
  state: string
  bills: Bill[]
  members: Member[]
  committees: Committee[]
  loading: boolean
}) {
  const [page, setPage] = React.useState(0)
  const items = entity === "bill" ? bills : entity === "member" ? members : committees
  const pages = Math.max(1, Math.ceil(items.length / PAGE))
  const current = Math.min(page, pages - 1)
  React.useEffect(() => setPage(0), [entity, bills.length, members.length, committees.length])
  const slice = items.slice(current * PAGE, current * PAGE + PAGE)

  return (
    <div className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
      <div className="relative z-0 mx-auto flex w-full flex-1 flex-col overflow-hidden">
        <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
        <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto p-6 pt-14 pb-16">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PAGE }).map((_, i) => (
                <Skeleton key={i} className="h-[26rem] rounded-2xl bg-card/80" />
              ))}
            </div>
          ) : slice.length ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {entity === "bill" && (slice as Bill[]).map((b) => <BillCard key={b.bill_id} bill={b} state={state} />)}
              {entity === "member" && (slice as Member[]).map((m) => <MemberCard key={m.people_id} member={m} state={state} />)}
              {entity === "committee" && (slice as Committee[]).map((c) => <CommitteeCard key={`${c.chamber}/${c.committee_name}`} committee={c} state={state} />)}
            </div>
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>
          )}
        </div>
      </div>

      <div className="dark absolute top-3 left-3 z-20 flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl backdrop-blur-xl">
        {(["bill", "member", "committee"] as Entity[]).map((e) => (
          <Button key={e} variant="ghost" size="sm" data-active={entity === e} className="h-7 min-w-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground" onClick={() => setEntity(e)}>
            {e === "bill" ? "Bills" : e === "member" ? "Members" : "Committees"}
          </Button>
        ))}
      </div>

      {pages > 1 && (
        <div className="dark absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl backdrop-blur-xl">
          {pages <= 8 ? (
            Array.from({ length: pages }).map((_, i) => (
              <Button key={i} variant="ghost" size="sm" data-active={i === current} className="h-7 min-w-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground" onClick={() => setPage(i)}>
                {String(i + 1).padStart(2, "0")}
              </Button>
            ))
          ) : (
            <>
              <Button variant="ghost" size="sm" className={cn("h-7 rounded-lg px-2.5 text-xs", current === 0 && "opacity-40")} onClick={() => setPage(Math.max(0, current - 1))}>
                ‹
              </Button>
              <span className="px-1 text-xs font-medium text-muted-foreground tabular-nums">
                {String(current + 1).padStart(2, "0")} / {String(pages).padStart(2, "0")}
              </span>
              <Button variant="ghost" size="sm" className={cn("h-7 rounded-lg px-2.5 text-xs", current === pages - 1 && "opacity-40")} onClick={() => setPage(Math.min(pages - 1, current + 1))}>
                ›
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
