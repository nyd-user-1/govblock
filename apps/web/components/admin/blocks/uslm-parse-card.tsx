"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { ArrowUpRightIcon, PlayIcon } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// USLM parse (window 1, 2026-09-14): a bill id in, the XML reader's build run
// on the server with every cache skipped (/api/typeset/uslm-parse), and out
// come the node counts by type, the elements the reader did not know, the
// build's times and sizes, and the bill in the XML view.

type Counted = Record<string, number>
type Located = Record<string, { count: number; path: string }>

type Result = {
  bill: string
  work: string | null
  expression: string | null
  version: string | null
  fidelity: string
  dialect: string
  sourceUrl: string | null
  timings: { fetchMs: number; frontMs: number; docMs: number; htmlMs: number; totalMs: number }
  bytes: { source: number; json: number; html: number }
  front: { coverage: number; unknown: Counted } | null
  report: { nodes: Counted; marks: Counted; unknown: Located; violations: Located; unwrapped: Counted; skipped: Counted; notes: string[] }
  href: string
}

const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} MB` : `${Math.round(n / 1000)} KB`)
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`)

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Counts({ title, rows, empty }: { title: string; rows: [string, React.ReactNode, string?][]; empty: string }) {
  return (
    <div className="min-w-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead>{title}</TableHead>
            <TableHead className="w-20 text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map(([name, count, path]) => (
              <TableRow key={name}>
                <TableCell className="max-w-72">
                  <span className="font-mono text-xs">{name}</span>
                  {path && <span className="block truncate text-[11px] text-muted-foreground">{path}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{count}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function UslmParseCard() {
  const [bill, setBill] = React.useState("2058568")
  const [version, setVersion] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [result, setResult] = React.useState<Result | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const run = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setPending(true)
    setError(null)
    try {
      const params = new URLSearchParams({ bill: bill.trim() })
      if (version.trim()) params.set("version", version.trim())
      const response = await fetch(`/api/typeset/uslm-parse?${params}`)
      const body = await response.json()
      if (!response.ok) throw new Error([body.error, body.detail].filter(Boolean).join(" "))
      setResult(body)
    } catch (e) {
      setResult(null)
      setError((e as Error).message || "The parse failed.")
    } finally {
      setPending(false)
    }
  }

  const r = result?.report
  const sorted = (c: Counted | undefined) => Object.entries(c ?? {}).sort((a, b) => b[1] - a[1])
  const located = (l: Located | undefined): [string, React.ReactNode, string][] => Object.entries(l ?? {}).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => [k, v.count, v.path])

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardAnchor>USLM parse</CardAnchor>
        <CardAction>
          <CardTools>
            <form onSubmit={run} className="flex items-center gap-2">
              <Input value={bill} onChange={(e) => setBill(e.target.value)} inputMode="numeric" aria-label="Bill id" placeholder="Bill id" className="h-8 w-28" />
              <Input value={version} onChange={(e) => setVersion(e.target.value)} inputMode="numeric" aria-label="Document id" placeholder="Document id" className="h-8 w-32 max-md:hidden" />
              <Button type="submit" size="sm" className="gap-1" disabled={pending || !/^\d+$/.test(bill.trim())}>
                <PlayIcon className={cn("size-3.5", pending && "animate-pulse")} />
                {pending ? "Running" : "Run"}
              </Button>
            </form>
          </CardTools>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!result && !error && pending && <p className="text-sm text-muted-foreground"><LoadingFlag /></p>}
        {result && r && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">{result.bill}</span>
              <span className="text-muted-foreground">{result.version ?? "no printing"}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {result.work}
                {result.expression ? `@${result.expression}` : ""}
              </span>
              <span className={cn("text-xs", result.fidelity === "plain-text" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                {result.fidelity} · {result.dialect}
                {result.front ? ` · ${Math.round(result.front.coverage * 1000) / 10}% known` : ""}
              </span>
              <Button variant="outline" size="sm" className="ml-auto gap-1" render={<Link href={result.href} />}>
                Open in XML view
                <ArrowUpRightIcon className="size-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <Figure label="Fetch" value={ms(result.timings.fetchMs)} />
              <Figure label="Front end" value={ms(result.timings.frontMs)} />
              <Figure label="uslmToDoc" value={ms(result.timings.docMs)} />
              <Figure label="HTML" value={ms(result.timings.htmlMs)} />
              <Figure label="Total" value={ms(result.timings.totalMs)} />
              <Figure label={result.fidelity === "plain-text" ? "Text" : "XML"} value={kb(result.bytes.source)} />
              <Figure label="JSON" value={kb(result.bytes.json)} />
              <Figure label="HTML" value={kb(result.bytes.html)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Counts title="Node" rows={sorted(r.nodes).map(([k, v]) => [k, v.toLocaleString()])} empty="No nodes." />
              <Counts title="Mark" rows={sorted(r.marks).map(([k, v]) => [k, v.toLocaleString()])} empty="No marks." />
              <div className="flex min-w-0 flex-col gap-4">
                <Counts title="Unknown element" rows={located(r.unknown)} empty="Every element was known." />
                <Counts title="Rank violation" rows={located(r.violations)} empty="No level out of rank." />
                <Counts title="Read through / skipped" rows={[...sorted(r.unwrapped).map(([k, v]): [string, React.ReactNode] => [k, v]), ...sorted(r.skipped).map(([k, v]): [string, React.ReactNode] => [`${k} (skipped)`, v])]} empty="Nothing." />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
