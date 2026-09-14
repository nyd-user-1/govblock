import type { Metadata } from "next"
import Link from "next/link"
import { CheckIcon, LeafIcon, SproutIcon, TreeDeciduousIcon, TreePineIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// /pricing (Brendan, 2026-09-13). Four plans, per seat, and the table under
// them. The prices are Brendan's floor: the market checked the same day —
// Plural at $59 a seat a month for every state, BillTrack50 at $84 a month
// for one state and $420 for all of them with unlimited users, Quorum and
// FiscalNote unpublished and quoted higher — sits under it, so the floor
// stands. Checkout is not wired: every button goes to the account.
export const metadata: Metadata = { title: "Pricing", description: "Congress and your home state are free. A plan opens the rest, one state at a time or all fifty." }

const STATE_ADD_ON = 49

type Plan = { name: string; icon: React.ReactNode; blurb: string; price: number; cta: string; href: string; dark?: boolean; popular?: boolean; points: string[] }

const PLANS: Plan[] = [
  { name: "Free", icon: <LeafIcon />, blurb: "Congress and your home state, as they move.", price: 0, cta: "Get started for free", href: "/auth#sign-up", points: ["1 seat", "Congress and your home state", "Bills, members, committees, calendar"] },
  { name: "Team", icon: <TreeDeciduousIcon />, blurb: `The whole record for the states you work. Add a state for $${STATE_ADD_ON} a month.`, price: 99, cta: "Purchase Now", href: "/auth#sign-up", points: ["Per seat", `Congress, your home state, and any state for $${STATE_ADD_ON} a month`, "Every session for 20 years"] },
  { name: "Pro", icon: <SproutIcon />, blurb: "All fifty states, the District and Congress, for 20 years.", price: 399, cta: "Purchase Now", href: "/auth#sign-up", popular: true, points: ["Per seat", "All 50 states, D.C. and Congress", "Every alert, every agent, the API"] },
  { name: "Custom", icon: <TreePineIcon />, blurb: "A whole office on the record, with the support to match.", price: 799, cta: "Purchase Plan", href: "/auth#sign-up", dark: true, points: ["Custom seats", "Single sign-on and a dedicated contact", "Custom agents and data feeds"] },
]

type Row = { feature: string; cells: (string | boolean)[] }
const ROWS: Row[] = [
  { feature: "Seats", cells: ["1 seat", "Per seat", "Per seat", "Custom"] },
  { feature: "Jurisdictions", cells: ["Congress and your home state", `Congress, home, and any state at $${STATE_ADD_ON} a month`, "All 50 states, D.C. and Congress", "All 50 states, D.C. and Congress"] },
  { feature: "Sessions", cells: ["The current session", "20 years", "20 years", "20 years"] },
  { feature: "Bills, members, committees, calendar", cells: [true, true, true, true] },
  { feature: "Search across every state", cells: [true, true, true, true] },
  { feature: "The brief and the news", cells: ["Congress and home", true, true, true] },
  { feature: "Roll calls, amendments, nominations, hearings", cells: [false, true, true, true] },
  { feature: "The Record, laws, reports", cells: [false, true, true, true] },
  { feature: "Lobbying, money, departments, forms", cells: [false, true, true, true] },
  { feature: "Alerts", cells: [false, "10", "Unlimited", "Unlimited"] },
  { feature: "Typeset: read, outline, compare, mark up", cells: [false, true, true, true] },
  { feature: "Agents: Clerk, Parliamentarian, Treasurer, Whip, Librarian, Filer, Reporter", cells: [false, "3 of 7", "All 7", "All 7, and custom agents"] },
  { feature: "Datasets and downloads", cells: [false, true, true, true] },
  { feature: "API", cells: [false, false, true, "Higher limits"] },
  { feature: "The map", cells: ["Congress and home", true, true, true] },
  { feature: "Support", cells: ["Community", "Email", "Priority", "Dedicated, with single sign-on"] },
]

function Cell({ value }: { value: string | boolean }) {
  if (value === false) return <span className="text-muted-foreground">–</span>
  return (
    <span className="inline-flex items-center gap-2">
      <CheckIcon className="size-4 shrink-0 text-emerald-600" aria-hidden />
      {value === true ? "Yes" : value}
    </span>
  )
}

export default function PricingPage() {
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-16 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">Select a plan that opens the record you need</h1>
        <p className="max-w-3xl text-lg text-balance text-muted-foreground">
          Congress and your home state are free. A plan opens every other state, every session for twenty years, and the tools that read them for you. Every plan is priced per seat.{" "}
          <Link href="/pricing/api" className="underline underline-offset-4">
            The API
          </Link>{" "}
          is priced by the year and the number of states.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <section key={plan.name} className="flex flex-col gap-6 rounded-2xl border bg-card p-6">
            <div className="flex items-start justify-between">
              <span className={cn("flex size-16 items-center justify-center rounded-full [&_svg]:size-7", plan.dark ? "bg-foreground text-background" : "bg-muted text-foreground")}>{plan.icon}</span>
              {plan.popular && <Badge variant="outline">Most Popular</Badge>}
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="text-sm text-muted-foreground">{plan.blurb}</p>
            </div>
            <p className="flex items-baseline gap-1">
              <span className="text-lg text-muted-foreground">$</span>
              <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
              <span className="text-muted-foreground">per month</span>
            </p>
            <Button render={<Link href={plan.href} />} nativeButton={false} variant={plan.dark ? "default" : "secondary"} className="w-full">
              {plan.cta}
            </Button>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
              {plan.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div id="compare" className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">Compare features by plan</h2>
            <p className="text-muted-foreground">What each plan opens, side by side.</p>
          </div>
          <Button render={<Link href="mailto:hello@nysgpt.com" />} nativeButton={false}>
            Book a call
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[26%]">Feature</TableHead>
                {PLANS.map((plan) => (
                  <TableHead key={plan.name}>{plan.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.feature} className="h-14">
                  <TableCell className="font-medium">{row.feature}</TableCell>
                  {row.cells.map((cell, i) => (
                    <TableCell key={i}>
                      <Cell value={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
