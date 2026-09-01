"use client"

// Ported from livingston-v3 components/policy/fec-explorer.tsx. The four
// filters are our Select (v3 used NativeSelect); the data is the 2026-09-01
// snapshot of /api/fec/* answered by lib/policy/snapshot.

import * as React from "react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import useSWR from "@/lib/policy/swr"

import { stateName } from "@/lib/filters"
import { fmtCompact, fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@govblock/ui/components/nova/select"
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

export function FecExplorer() {
  const { state, resolved } = useJurisdiction()
  const [scopeAll, setScopeAll] = React.useState(false)
  const [cycle, setCycle] = React.useState<number | null>(null)
  const [office, setOffice] = React.useState("")
  const [party, setParty] = React.useState("")
  const [ici, setIci] = React.useState("")
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

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="cn-font-heading text-xl font-semibold">
          Finance — {scopeAll ? "all states" : stateName(scope)}
        </h2>
        <p className="text-sm text-muted-foreground">
          Every figure here is read from Parquet on S3. No database is in the
          path.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(meta?.cycle ?? "")}
          onValueChange={(value) => setCycle(Number(value))}
          items={Object.fromEntries((meta?.cycles ?? []).map((year) => [String(year), `${year - 1}–${year}`]))}
        >
          <SelectTrigger size="sm" aria-label="Election cycle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          {(meta?.cycles ?? []).map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year - 1}–{year}
            </SelectItem>
          ))}
        </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={scopeAll ? "default" : "outline"}
          onClick={() => setScopeAll((value) => !value)}
        >
          {scopeAll ? "All states" : stateName(state)}
        </Button>
        <Select value={office} onValueChange={(value) => setOffice(value)} items={{ "": "Every office", House: "House", Senate: "Senate", President: "President" }}>
          <SelectTrigger size="sm" aria-label="Office">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value="">Every office</SelectItem>
          <SelectItem value="House">House</SelectItem>
          <SelectItem value="Senate">Senate</SelectItem>
          <SelectItem value="President">President</SelectItem>
        </SelectContent>
        </Select>
        <Select value={party} onValueChange={(value) => setParty(value)} items={{ "": "Every party", DEM: "Democratic", REP: "Republican", OTHER: "Other" }}>
          <SelectTrigger size="sm" aria-label="Party">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value="">Every party</SelectItem>
          <SelectItem value="DEM">Democratic</SelectItem>
          <SelectItem value="REP">Republican</SelectItem>
          <SelectItem value="OTHER">Other</SelectItem>
        </SelectContent>
        </Select>
        <Select value={ici} onValueChange={(value) => setIci(value)} items={{ "": "Incumbent, challenger or open", I: "Incumbent", C: "Challenger", O: "Open seat" }}>
          <SelectTrigger size="sm" aria-label="Incumbency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value="">Incumbent, challenger or open</SelectItem>
          <SelectItem value="I">Incumbent</SelectItem>
          <SelectItem value="C">Challenger</SelectItem>
          <SelectItem value="O">Open seat</SelectItem>
        </SelectContent>
        </Select>
      </div>

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
  )
}
