import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { chamberImage } from "@/lib/imagery"
import { FlagChip } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Separator } from "@govblock/ui/components/nova/separator"

// Ported from livingston-v3 components/policy/newsroom.tsx. Sera's shape — a
// lead story, sections beneath it, a sidebar of other desks — carrying what a
// legislature actually produces. Every item is the thing it names.

export type BillRow = {
  bill_id: number
  bill_number: string
  title: string
  description?: string | null
  status_desc?: string | null
  last_action?: string | null
  last_action_date?: string | null
  committee?: string | null
  body?: string | null
  sponsor?: string | null
}

export type Newsroom = {
  lead: BillRow | null
  enacted: BillRow[]
  passed: BillRow[]
  committee: BillRow[]
  introduced: BillRow[]
  rollCalls: { roll_call_id: number; date: string; chamber: string | null; description: string; yea: number; nay: number; bill_id: number; bill_number: string; title: string }[]
  hearings: { date: string; time: string | null; description: string; bill_id: number; bill_number: string; committee: string | null }[]
  since: string
}

function Byline({ bill, state }: { bill: BillRow; state: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <img src={chamberImage(state, bill.body)} alt="" aria-hidden="true" width={16} height={16} className="size-4 rounded-[2px] object-contain" />
      <span className="font-mono">{bill.bill_number}</span>
      {bill.last_action_date && <span>· {fmtDate(bill.last_action_date)}</span>}
      {bill.committee && <span>· {bill.committee}</span>}
      {bill.sponsor && <span>· {bill.sponsor}</span>}
    </span>
  )
}

function Story({ bill, state, size = "default" }: { bill: BillRow; state: string; size?: "default" | "lead" }) {
  return (
    <article className="flex flex-col gap-1.5">
      <Link href={`/docs/bills/${bill.bill_id}`} className="no-underline hover:underline">
        <h3 className={size === "lead" ? "cn-font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl" : "cn-font-heading text-base leading-snug font-medium text-balance"}>
          {size === "lead" ? bill.title : truncate(bill.title, 120)}
        </h3>
      </Link>
      {size === "lead" && bill.last_action && <p className="text-sm text-muted-foreground">{bill.last_action}</p>}
      <Byline bill={bill} state={state} />
    </article>
  )
}

function Section({ title, bills, state, empty }: { title: string; bills: BillRow[]; state: string; empty: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="cn-font-heading text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h2>
      {bills.length ? (
        <div className="flex flex-col gap-5">
          {bills.map((bill) => (
            <Story key={bill.bill_id} bill={bill} state={state} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="cn-font-heading text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{children}</h2>
)

export function NewsroomPage({
  data,
  state,
  session,
  others,
}: {
  data: Newsroom
  state: string
  session: number
  others: { state: string; session: number; bills: BillRow[] }[]
}) {
  return (
    <div className="container-wrapper flex-1 px-4 py-10 md:px-6">
      <div className="container flex flex-col gap-10 px-0">
        <header className="flex flex-col gap-2 border-b pb-6">
          <span className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            <FlagChip state={state} />
            {stateName(state)} · {session} session
          </span>
          <h1 className="cn-font-heading text-4xl font-semibold tracking-tight">News</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">What the legislature did, newest first. Every headline is the bill it names.</p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-10">
            {data.lead ? (
              <section className="flex flex-col gap-3 border-b pb-8">
                <Badge variant="outline" className="w-fit font-normal">
                  {data.lead.status_desc ?? "Latest"}
                </Badge>
                <Story bill={data.lead} state={state} size="lead" />
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing has moved in {stateName(state)} this session yet.</p>
            )}
            <Section title="Signed and vetoed" bills={data.enacted} state={state} empty="Nothing has been signed or vetoed yet." />
            <Separator />
            <Section title="Passed a chamber" bills={data.passed} state={state} empty="No bill has passed a chamber in the last fortnight." />
            <Separator />
            <Section title="In committee" bills={data.committee} state={state} empty="No committee action in the last fortnight." />
            <Separator />
            <Section title="Newly introduced" bills={data.introduced} state={state} empty="No new bills in the last fortnight." />
          </div>

          <aside className="flex flex-col gap-10">
            <section className="flex flex-col gap-4">
              <Heading>Roll calls</Heading>
              {data.rollCalls.length ? (
                <div className="flex flex-col gap-4">
                  {data.rollCalls.map((call) => {
                    const total = Math.max(call.yea + call.nay, 1)
                    return (
                      <Link key={call.roll_call_id} href={`/docs/bills/${call.bill_id}`} className="flex flex-col gap-1.5 no-underline">
                        <span className="text-sm font-medium">
                          {call.bill_number} · {truncate(call.description ?? "", 40)}
                        </span>
                        <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span className="h-full" style={{ width: `${(call.yea / total) * 100}%`, background: "var(--chart-2)" }} />
                          <span className="h-full" style={{ width: `${(call.nay / total) * 100}%`, background: "var(--chart-5)" }} />
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {fmtNumber(call.yea)}–{fmtNumber(call.nay)} · {fmtDate(call.date, false)}
                          {call.chamber ? ` · ${call.chamber}` : ""}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recorded votes yet.</p>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <Heading>Coming up</Heading>
              {data.hearings.length ? (
                <div className="flex flex-col gap-3">
                  {data.hearings.map((hearing, index) => (
                    <Link key={`${hearing.bill_id}-${index}`} href={`/docs/bills/${hearing.bill_id}`} className="flex flex-col no-underline">
                      <span className="text-sm font-medium">{truncate(hearing.description ?? "", 44)}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(hearing.date, false)}
                        {hearing.time ? ` · ${hearing.time}` : ""} · {hearing.bill_number}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing is calendared ahead.</p>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <Heading>Other desks</Heading>
              <div className="flex flex-col gap-4">
                {others.map((desk) => (
                  <div key={desk.state} className="flex flex-col gap-1.5">
                    <Link href={`/newsroom?state=${desk.state}`} className="flex items-center gap-2 text-sm font-medium no-underline hover:underline">
                      <FlagChip state={desk.state} />
                      {stateName(desk.state)}
                    </Link>
                    {desk.bills.slice(0, 2).map((bill) => (
                      <Link key={bill.bill_id} href={`/docs/bills/${bill.bill_id}`} className="text-xs text-muted-foreground no-underline hover:underline">
                        {bill.bill_number} · {truncate(bill.title, 56)}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
