import { chamberFromNumber } from "@/lib/imagery"
import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtBill, fmtDate, fmtLongDate, fmtNumber, truncate } from "@/lib/format"
import type { Desk } from "@/lib/policy/desk"
import { STAGES } from "@/lib/policy/desk"
import type { NewsBrief, NewsStory } from "@/lib/policy/news"
import type { StreamGroup } from "@/lib/policy/stream"
import { BillsScope } from "@/components/bills-scope"
import { CalendarCard } from "@/components/cards/calendar"
import { DeskRefreshable } from "@/components/desk-refresh"
import { FlagChip } from "@/components/policy/imagery"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

// One jurisdiction's desk (Brendan, 2026-09-11, from his devtools mockup):
// the eyebrow under the page's title, then the stages in the order a bill
// meets them — Recent Bills, In Committee, On the Floor, Engrossed, Sent to
// the Governor, Signed or Vetoed — five to a stage, each row the record's
// standard item. No lead story: the stages are the sort. The right rail: the
// other desks, the calendar, the weekly briefs, the press and the roll
// calls, five each. Every item is the thing it names.

const codeOf = (state: string) => state.toUpperCase()
export const deskName = (state: string) => (state === "US" ? "Congress Desk" : `${stateName(state)} Desk`)

/** Under the title, in the description's place: the flag and where the desk reads from. */
export function DeskEyebrow({ state }: { state: string }) {
  return (
    <span className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
      <FlagChip state={state} />
      From top {codeOf(state)} sources
    </span>
  )
}

function StageHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="cn-font-heading text-2xl font-semibold tracking-tight md:text-3xl">{children}</h2>
}

/** The rail's small-caps label. */
function RailHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="cn-font-heading text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{children}</h2>
}

/** A stage's shape, blank: five of the standard rows. */
function StageSkeleton() {
  return (
    <div className="mt-6 mb-8 flex flex-col divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-3 md:px-4">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5 rounded" />
            <Skeleton className="h-3 w-2/5 rounded" />
            <Skeleton className="mt-1 h-4 w-11/12 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A rail list's shape, blank: five two-line rows, with the bar where the roll calls have one. */
function RailSkeleton({ bar = false }: { bar?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-11/12 rounded" />
          {bar && <Skeleton className="h-1.5 w-full rounded-full" />}
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}

function StageRows({ desk, stageKey }: { desk: Desk; stageKey: (typeof STAGES)[number]["key"] }) {
  const bills = desk.stages[stageKey]
  const state = desk.state
  if (!bills.length) return <p className="text-sm text-muted-foreground">No bill has reached this stage yet this session.</p>
  return (
    <RecordList>
      {bills.map((bill) => (
        <RecordItem
          key={bill.bill_id}
          href={`/bills/${bill.bill_id}`}
          avatar={<RecordSeal state={state} chamber={bill.body ?? chamberFromNumber(bill.bill_number)} />}
          title={fmtBill(bill.bill_number, state)}
          lead={bill.last_action}
          meta={[bill.event_date ? fmtDate(bill.event_date) : bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.status_desc, bill.committee ? `${bill.committee} Committee` : null, bill.sponsor]}
          description={truncate(bill.title, 240)}
        />
      ))}
    </RecordList>
  )
}

/** The centre: the stages. Sits in the docs page's column (Brendan, 2026-09-11: the site's layout, left rail and right rail, on the desk too). */
export function DeskBody({ desk }: { desk: Desk }) {
  const state = desk.state
  return (
    <div data-not-typeset="true" className="flex flex-col gap-10">
      {STAGES.map((stage, i) => (
        <React.Fragment key={stage.key}>
          {i > 0 && <Separator />}
          {stage.key === "signed" ? (
            <DeskRefreshable state={state} kind="stage" title={stage.title} skeleton={<StageSkeleton />}>
              <StageRows desk={desk} stageKey={stage.key} />
            </DeskRefreshable>
          ) : (
            <section className="flex flex-col gap-5">
              <StageHeading>{stage.title}</StageHeading>
              <StageRows desk={desk} stageKey={stage.key} />
            </section>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

/** The right rail: the other desks, the calendar, the briefs, the press, the roll calls. */
export function DeskRail({ desk, others, headlines, briefs }: { desk: Desk; others: StreamGroup[]; headlines: NewsStory[]; briefs: NewsBrief[] }) {
  const state = desk.state
  const code = codeOf(state)
  return (
    <aside className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <RailHeading>Other desks</RailHeading>
        <div className="flex flex-col gap-4">
          {others.slice(0, 5).map((other) => (
            <div key={other.state} className="flex flex-col gap-1.5">
              <Link href={`/desk/${other.state.toLowerCase()}`} className="flex items-center gap-2 text-sm font-medium no-underline hover:underline">
                <FlagChip state={other.state} />
                {stateName(other.state)}
              </Link>
              {other.bills.slice(0, 2).map((bill) => (
                <Link key={bill.bill_id} href={`/bills/${bill.bill_id}`} className="text-xs text-muted-foreground no-underline hover:underline">
                  {fmtBill(bill.bill_number, other.state)} · {truncate(bill.title, 56)}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <RailHeading>Calendar</RailHeading>
        <BillsScope state={state}>
          <CalendarCard compact />
        </BillsScope>
      </section>

      <section className="flex flex-col gap-4">
        <RailHeading>Weekly briefs</RailHeading>
        {briefs.length ? (
          <div className="flex flex-col gap-3">
            {briefs.slice(0, 5).map((brief) => (
              <Link key={brief.id} href={`/briefing?state=${code}`} className="flex flex-col no-underline">
                <span className="text-sm font-medium">{truncate(brief.title ?? brief.content, 90)}</span>
                <span className="text-xs text-muted-foreground">{fmtLongDate(brief.completed_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brief written for this desk yet.{" "}
            <Link href={`/briefing?state=${code}`} className="text-foreground underline-offset-4 hover:underline">
              Send the Reporter
            </Link>
            .
          </p>
        )}
      </section>

      <DeskRefreshable state={state} kind="rail" title="In the press" skeleton={<RailSkeleton />}>
        {headlines.length ? (
          <div className="flex flex-col gap-3">
            {headlines.slice(0, 5).map((story) => (
              <Link key={story.id} href={`/news/${state.toLowerCase()}/${story.id}`} className="flex flex-col no-underline">
                <span className="text-sm font-medium">{truncate(story.title, 90)}</span>
                <span className="text-xs text-muted-foreground">
                  {story.source_name ?? "Source"}
                  {story.published_at ? ` · ${fmtDate(story.published_at, false)}` : ""}
                </span>
              </Link>
            ))}
            <Link href={`/news/${state.toLowerCase()}`} className="text-xs text-muted-foreground no-underline hover:underline">
              All {stateName(state)} headlines
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing from the press on file yet.</p>
        )}
      </DeskRefreshable>

      <DeskRefreshable state={state} kind="rail" title="Roll calls" skeleton={<RailSkeleton bar />}>
        {desk.rollCalls.length ? (
          <div className="flex flex-col gap-4">
            {desk.rollCalls.slice(0, 5).map((call) => {
              const total = Math.max(call.yea + call.nay, 1)
              return (
                <Link key={call.roll_call_id} href={`/bills/${call.bill_id}`} className="flex flex-col gap-1.5 no-underline">
                  <span className="text-sm font-medium">
                    {fmtBill(call.bill_number, state)} · {truncate(call.description ?? "", 40)}
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
      </DeskRefreshable>
    </aside>
  )
}
