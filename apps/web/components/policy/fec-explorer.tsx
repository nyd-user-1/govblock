"use client"

// Ported from livingston-v3 components/policy/fec-explorer.tsx. The four
// filters sit in the block shell's sidebar since 2026-09-03 — Brendan: "Let
// the dashboard block become the corresponding FEC items" — and take their
// first values from the rail: its FEC cycle, its party, its chamber as the
// office. The data is the 2026-09-01 snapshot of /api/fec/* answered by
// lib/policy/snapshot.

import * as React from "react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import useSWR from "@/lib/policy/swr"

import { stateName } from "@/lib/filters"
import { fmtCompact, fmtNumber } from "@/lib/format"
import { useScope } from "@/lib/policy/scope"
import { BlockShell } from "@/components/policy/block-shell"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { PARTY_BLUE, PARTY_OTHER, PARTY_RED } from "@/lib/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@govblock/ui/components/nova/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@govblock/ui/components/nova/chart"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@govblock/ui/components/nova/table"

// The FEC explorer — everything on this page comes from Parquet files on S3
// through /api/fec/candidates. No Postgres is touched, by design: it is the
// worked example of an S3 serving layer, and the "What we hold" panel at the
// bottom is the manifest those files were written with.

type Row = {
  cand_id: string
  name: string
  ici: string | null
  party: string | null
  receipts: number
  disbursements: number
  cash_on_hand: number
  seat: string
  office: string
  fec_url: string
}

type Meta = {
  cycle: number
  cycles: number[]
  state: string | null
  matched: number
  cycleRows: number
  totalReceipts: number
  totalDisbursements: number
  totalCashOnHand: number
  byParty: { party: string; candidates: number; receipts: number }[]
  byOffice: { office: string; candidates: number }[]
  source: string
  builtAt: string
}

type Payload = { meta: Meta; rows: Row[] }
type Manifest = {
  cycles: { cycle: number; rows: number; bytes: number; key: string }[]
  totalRows: number
  totalBytes: number
  columns: { name: string; type: string }[]
  builtAt: string
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    let message = response.statusText
    try {
      message = (await response.json()).error ?? message
    } catch {}
    throw new Error(message)
  }
  return response.json()
}

const PARTY_COLOR: Record<string, string> = {
  DEM: PARTY_BLUE,
  REP: PARTY_RED,
  OTHER: PARTY_OTHER,
}
const PARTY_LABEL: Record<string, string> = {
  DEM: "Democratic",
  REP: "Republican",
  OTHER: "Other",
}
const ICI_LABEL: Record<string, string> = {
  I: "Incumbent",
  C: "Challenger",
  O: "Open seat",
}

const chartConfig = {
  receipts: { label: "Receipts" },
} satisfies ChartConfig

function Tile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="cn-font-heading text-2xl tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      )}
    </Card>
  )
}

const PAGE = 25

// The rail speaks LegiScan's party letters and chamber names; the FEC speaks
// its own. Translate rather than make the reader choose twice.
const FEC_PARTY: Record<string, string> = { D: "DEM", R: "REP", I: "OTHER", L: "OTHER", G: "OTHER", N: "OTHER" }
const FEC_OFFICE: Record<string, string> = { House: "House", Assembly: "House", Senate: "Senate" }

export function FecExplorer() {
  const { state, resolved, filters } = useScope()
  const [scopeAll, setScopeAll] = React.useState(false)
  const [cycle, setCycle] = React.useState<number | null>(null)
  const [office, setOffice] = React.useState("")
  const [party, setParty] = React.useState("")
  const [ici, setIci] = React.useState("")
  // The rail's choices land here whenever they change; the sidebar can still
  // move off them for a look, and the next rail change brings it back. Applied
  // while rendering, against the last rail values seen, so no effect fires a
  // second render.
  const [seen, setSeen] = React.useState({ cycle: filters.cycle, party: filters.party, chamber: filters.chamber })
  if (seen.cycle !== filters.cycle || seen.party !== filters.party || seen.chamber !== filters.chamber) {
    setSeen({ cycle: filters.cycle, party: filters.party, chamber: filters.chamber })
    if (seen.cycle !== filters.cycle) setCycle(filters.cycle ? Number(filters.cycle) : null)
    if (seen.party !== filters.party) setParty(filters.party ? (FEC_PARTY[filters.party] ?? "OTHER") : "")
    if (seen.chamber !== filters.chamber) setOffice(filters.chamber ? (FEC_OFFICE[filters.chamber] ?? "") : "")
  }
  const [sort, setSort] = React.useState("receipts")
  const [dir, setDir] = React.useState<"asc" | "desc">("desc")
  const [page, setPage] = React.useState(0)

  const scope = scopeAll ? "US" : state
  const query = new URLSearchParams({
    state: scope,
    limit: String(PAGE),
    offset: String(page * PAGE),
    sort,
    dir,
  })
  if (cycle) query.set("cycle", String(cycle))
  if (office) query.set("office", office)
  if (party) query.set("party", party)
  if (ici) query.set("ici", ici)

  const { data, error, isLoading } = useSWR<Payload>(
    resolved ? `/api/fec/candidates?${query}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  )
  const { data: manifest } = useSWR<Manifest>("/api/fec/manifest", fetcher, {
    revalidateOnFocus: false,
  })

  const meta = data?.meta
  const pages = meta ? Math.ceil(meta.matched / PAGE) : 0
  React.useEffect(() => setPage(0), [scope, cycle, office, party, ici])

  const sortBy = (key: string) => {
    if (sort === key) setDir(dir === "desc" ? "asc" : "desc")
    else {
      setSort(key)
      setDir("desc")
    }
  }


  const item = (label: string, active: boolean, onClick: () => void, hint?: string) => (
    <SidebarMenuItem key={label}>
      <SidebarMenuButton isActive={active} onClick={onClick} className="justify-between gap-2">
        <span className="truncate">{label}</span>
        {hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
  const rail = (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Cycle</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {(meta?.cycles ?? manifest?.cycles.map((c) => c.cycle) ?? []).map((year) => item(`${year - 1}–${year}`, year === meta?.cycle, () => setCycle(year)))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Scope</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item(stateName(state), !scopeAll, () => setScopeAll(false))}
            {item("All states", scopeAll, () => setScopeAll(true))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Office</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item("Every office", office === "", () => setOffice(""))}
            {["House", "Senate", "President"].map((value) => item(value, office === value, () => setOffice(value), meta?.byOffice.find((o) => o.office === value) ? fmtNumber(meta.byOffice.find((o) => o.office === value)!.candidates) : undefined))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Party</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item("Every party", party === "", () => setParty(""))}
            {(["DEM", "REP", "OTHER"] as const).map((value) => item(PARTY_LABEL[value], party === value, () => setParty(value), meta?.byParty.find((p) => p.party === value) ? fmtNumber(meta.byParty.find((p) => p.party === value)!.candidates) : undefined))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Incumbency</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item("Incumbent, challenger or open", ici === "", () => setIci(""))}
            {(["I", "C", "O"] as const).map((value) => item(ICI_LABEL[value], ici === value, () => setIci(value)))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )

  return (
    <BlockShell
      rail={rail}
      title={
        <>
          <span>Finance — {scopeAll ? "all states" : stateName(scope)}</span>
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {meta ? `${meta.cycle - 1}–${meta.cycle}` : "…"}
          </Badge>
        </>
      }
      actions={<span className="hidden text-xs text-muted-foreground lg:inline">Read from Parquet on S3. No database is in the path.</span>}
    >
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {error && <p className="text-sm text-muted-foreground">{error.message}</p>}
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Candidates"
          value={meta ? fmtNumber(meta.matched) : "—"}
          hint={meta ? `of ${fmtNumber(meta.cycleRows)} filed this cycle` : ""}
        />
        <Tile
          label="Total receipts"
          value={meta ? fmtCompact(meta.totalReceipts) : "—"}
        />
        <Tile
          label="Total disbursements"
          value={meta ? fmtCompact(meta.totalDisbursements) : "—"}
        />
        <Tile
          label="Cash on hand"
          value={meta ? fmtCompact(meta.totalCashOnHand) : "—"}
          hint="at the close of the reporting period"
        />
      </div>

      {/* Receipts by party */}
      <Card>
        <CardHeader>
          <CardTitle>Receipts by party</CardTitle>
          <CardDescription>
            {meta
              ? meta.byOffice
                  .map((o) => `${o.office} ${fmtNumber(o.candidates)}`)
                  .join(" · ")
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meta?.byParty.length ? (
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart
                data={meta.byParty.map((row) => ({
                  ...row,
                  label: PARTY_LABEL[row.party] ?? row.party,
                }))}
                layout="vertical"
                margin={{ left: 8, right: 8 }}
              >
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <XAxis type="number" dataKey="receipts" hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => fmtCompact(Number(value))}
                    />
                  }
                />
                <Bar dataKey="receipts" radius={4}>
                  {meta.byParty.map((row) => (
                    <Cell
                      key={row.party}
                      fill={PARTY_COLOR[row.party] ?? PARTY_OTHER}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </CardContent>
      </Card>

      {/* The candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
          <CardDescription>
            {meta
              ? `${fmtNumber(meta.matched)} matching · page ${page + 1} of ${Math.max(pages, 1)}`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => sortBy("name")}>
                    Candidate
                  </button>
                </TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => sortBy("receipts")}>
                    Receipts
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => sortBy("disbursements")}>
                    Spent
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => sortBy("cash_on_hand")}>
                    On hand
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((row) => (
                <TableRow key={row.cand_id}>
                  <TableCell>
                    <a
                      href={row.fec_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 font-medium"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background:
                            PARTY_COLOR[
                              (row.party ?? "").toUpperCase().startsWith("DEM")
                                ? "DEM"
                                : (row.party ?? "")
                                      .toUpperCase()
                                      .startsWith("REP")
                                  ? "REP"
                                  : "OTHER"
                            ],
                        }}
                      />
                      {row.name}
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.seat}
                  </TableCell>
                  <TableCell>
                    {row.ici ? (
                      <Badge variant="outline" className="font-normal">
                        {ICI_LABEL[row.ici] ?? row.ici}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCompact(row.receipts)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCompact(row.disbursements)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCompact(row.cash_on_hand)}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.rows.length && !isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No candidates match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {pages > 1 && (
          <CardContent className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page * PAGE + 1}–
              {Math.min((page + 1) * PAGE, meta?.matched ?? 0)} of{" "}
              {fmtNumber(meta?.matched ?? 0)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </CardContent>
        )}
      </Card>

      {/* What we hold — the manifest the files were written with. */}
      <Card>
        <CardHeader>
          <CardTitle>What we hold</CardTitle>
          <CardDescription>
            {manifest
              ? `${manifest.cycles.length} cycles · ${fmtNumber(manifest.totalRows)} rows · ${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MB of Parquet · ${manifest.columns.length} columns · built ${new Date(manifest.builtAt).toLocaleString()}`
              : "Reading the manifest…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {(manifest?.cycles ?? []).map((entry) => (
              <button
                key={entry.cycle}
                type="button"
                onClick={() => setCycle(entry.cycle)}
                className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted ${
                  entry.cycle === meta?.cycle ? "border-ring bg-muted" : ""
                }`}
              >
                <span className="font-medium tabular-nums">
                  {entry.cycle - 1}–{entry.cycle}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {fmtNumber(entry.rows)} rows
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {(entry.bytes / 1024).toFixed(0)} KB
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] break-all text-muted-foreground">
            {meta?.source ??
              "s3://livingston-fec-bulk-638175140432/parquet/candidate_summary"}
            /cycle=&lt;YYYY&gt;/part-0.parquet
          </p>
        </CardContent>
      </Card>
    </div>
    </BlockShell>
  )
}
