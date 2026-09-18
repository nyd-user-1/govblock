"use client"

import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@govblock/ui/components/animate-ui/components/animate/tabs"
import { ChamberSeal } from "@/components/policy/imagery"
import { TableBlock } from "@/components/policy/table-block"
import { Table } from "@/components/typeset"

// A congress's sessions two ways (Brendan, 2026-09-17): the table, and the
// same sessions as cards, with the glossary's tabs above the block at its left.

export type SessionRow = {
  key: string
  href: string
  chamber: "House" | "Senate"
  session: string
  sitting: string
  rolls: number
  onBills: number
  votes: number
}

export function SessionViews({ rows }: { rows: SessionRow[] }) {
  return (
    <Tabs defaultValue="table" className="gap-0">
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="cards">Cards</TabsTrigger>
      </TabsList>
      <TableBlock rows={rows.length}>
        <TabsContents>
          <TabsContent value="table">
            <Table>
              <thead>
                <tr>
                  <th className="w-[22%]">Chamber</th>
                  <th className="w-[22%]">Session</th>
                  <th className="w-[24%]">Sitting</th>
                  <th className="w-[10%] text-right">Rolls</th>
                  <th className="w-[10%] text-right">On bills</th>
                  <th className="w-[12%] pr-8 text-right">Votes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <Link href={r.href}>{r.chamber}</Link>
                    </td>
                    <td>{r.session}</td>
                    <td className="whitespace-nowrap">{r.sitting}</td>
                    <td className="text-right tabular-nums">{fmtNumber(r.rolls)}</td>
                    <td className="text-right tabular-nums">{fmtNumber(r.onBills)}</td>
                    <td className="pr-8 text-right tabular-nums">{fmtNumber(r.votes)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TabsContent>
          <TabsContent value="cards">
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((r) => (
                <Link key={r.key} href={r.href} className="flex items-center gap-4 rounded-xl border bg-background p-4 no-underline transition-colors hover:bg-muted/50">
                  <ChamberSeal state="US" chamber={r.chamber} size={48} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">
                      {r.chamber} · {r.session}
                    </span>
                    <span className="text-sm text-muted-foreground">{r.sitting}</span>
                    <span className="text-sm tabular-nums">
                      {fmtNumber(r.votes)} votes · {fmtNumber(r.onBills)} on bills
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>
        </TabsContents>
      </TableBlock>
    </Tabs>
  )
}
