import type { Metadata } from "next"
import Link from "next/link"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"

// /pricing/api (Brendan, 2026-09-13): the API's own price list, on LegiScan's
// schedule (LegiScan_Price_List.pdf at the repo root) — a row per number of
// states, Public free, Pull and Push priced by the year, Push twice Pull.
// The schedule steps $100 a state, with a $25 lift at 12, 23, 34 and 45.
export const metadata: Metadata = { title: "API pricing", description: "The GovBlocks API, priced by the year and the number of states." }

/** Pull, by the year, for n states: LegiScan's ladder, to the dollar. */
function pull(n: number) {
  const lifts = [12, 23, 34, 45].filter((at) => n >= at).length
  return 1000 + 100 * (n - 1) + 25 * lifts
}

const usd = (v: number) => `$${v.toLocaleString("en-US")}`

const ROWS = Array.from({ length: 50 }, (_, i) => i + 1).map((n) => ({ states: n === 50 ? "50+" : String(n), pull: pull(n), push: pull(n) * 2 }))

const NOTES = [
  "Total number of states covered; Congress counts as a single state. All fees are by the year; multi-year terms are discounted, and subscriptions over $500 may be paid in installments.",
  "Public is the same record every reader has, at the public rate limits, with GovBlocks attribution.",
  "Pull is a keyed JSON interface at higher limits. GovBlocks attribution is required; white-label data is an add-on scaled by state count, from $250 to $8,000, and royalties may apply.",
  "Push sends updates every 4 hours. Every 15 minutes is an add-on scaled by state count, from $250 to $4,000.",
  "A single text-training snapshot of the record from 2010 to the present is available for a one-time fee of $5,000, or $500 for educational use.",
  "Pull and Push subscriptions include one Pro seat.",
]

export default function ApiPricingPage() {
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-12 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">API pricing</h1>
        <p className="max-w-3xl text-lg text-balance text-muted-foreground">
          The record as JSON, by the year and by the number of states. Public is free. Pull is a keyed interface at higher limits. Push sends every change to you.{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            Plans for readers
          </Link>{" "}
          are priced separately.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table className="max-w-3xl">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">
                States<sup>1</sup>
              </TableHead>
              <TableHead>
                Public<sup>2</sup>
              </TableHead>
              <TableHead>
                Pull<sup>3</sup>
              </TableHead>
              <TableHead>
                Push<sup>3, 4</sup>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.states} className="h-10">
                <TableCell className="font-medium tabular-nums">{row.states}</TableCell>
                <TableCell>Free</TableCell>
                <TableCell className="tabular-nums">{usd(row.pull)}</TableCell>
                <TableCell className="tabular-nums">{usd(row.push)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ol className="m-0 flex max-w-3xl list-none flex-col gap-2 p-0 text-sm text-muted-foreground">
        {NOTES.map((note, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 tabular-nums">{i + 1}.</span>
            <span>{note}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
