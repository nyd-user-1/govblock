import Link from "next/link"

import { BLOCKS } from "@/lib/blocks"
import { fmtNumber } from "@/lib/format"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"
import { TRENDING } from "@/lib/trending"
import { FlagChip } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"

// The root's last section (Brendan, 2026-09-22): four blocks as they stand on
// a reader's own home page, and the way to build one.
//
// It is a sample, not a grid: nothing here can be dragged, resized or removed,
// and nothing here asks the database anything. The root reads nothing (the
// rule in lib/policy/db.ts), so the figures are the frozen ones the page
// already carries — the jurisdictions' table and the trending pass — which is
// also what makes the section honest: these are real counts, not a mock.

const bills = JURISDICTIONS_TABLE.reduce((total, row) => total + row.bills, 0)
const laws = JURISDICTIONS_TABLE.reduce((total, row) => total + row.laws, 0)
const members = JURISDICTIONS_TABLE.reduce((total, row) => total + row.members, 0)
const busiest = [...JURISDICTIONS_TABLE].sort((a, b) => b.bills - a.bills).slice(0, 3)

function Card({ label, table, value, lead, children }: { label: string; table: string; value: string; lead: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-56 flex-col rounded-lg border bg-background p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {/* The table it stands over: a block is a shape over a table, and the sample says so. */}
          <p className="font-mono text-[11px] text-muted-foreground">{table}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-col">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="mt-1 text-sm text-muted-foreground">{lead}</span>
      </div>
      {children && <div className="mt-3 flex flex-col gap-2">{children}</div>}
    </div>
  )
}

export function BlocksSample() {
  const spec = (key: string) => BLOCKS.find((b) => b.key === key)
  return (
    <section id="blocks" className="mx-auto flex w-full max-w-160 min-w-0 scroll-mt-24 flex-col gap-6 px-4 pb-16 md:px-0">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-4xl font-bold tracking-tight">Blocks</h2>
        <p className="text-xl tracking-tight text-muted-foreground">One shape over one table, in one jurisdiction.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card label="Bills" table="Bills" value={fmtNumber(bills)} lead="bills on file">
          {busiest.map((row) => (
            <div key={row.state} className="flex items-center gap-2 text-sm">
              <FlagChip state={row.state} width={16} />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{fmtNumber(row.bills)}</span>
            </div>
          ))}
        </Card>
        <Card label="Laws" table="Laws" value={fmtNumber(laws)} lead="sections of standing law" />
        <Card label="Members" table="People" value={fmtNumber(members)} lead="legislators sitting" />
        <Card label="Jurisdictions" table="Bills" value={fmtNumber(JURISDICTIONS_TABLE.length)} lead="legislatures on file">
          {TRENDING.slice(0, 3).map((item) => (
            <div key={item.term} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{item.term}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{item.places}</span>
            </div>
          ))}
        </Card>
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          {BLOCKS.length} blocks over {new Set(BLOCKS.map((b) => b.table)).size} tables. Choose the ones you want, in the jurisdiction you work in, and they stand on your home page.
        </p>
        <Button render={<Link href="/sign-up" />} nativeButton={false}>
          Build your own
        </Button>
      </div>
      <p className="sr-only">{spec("bills")?.description}</p>
    </section>
  )
}
