"use client"

import * as React from "react"
import { CheckIcon, CodeIcon, CopyIcon, FileTextIcon } from "lucide-react"

import { fmtNumber, truncate } from "@/lib/format"
import type { Bill } from "@/lib/policy/types"
import { ago, Timeline, type TimelineRow } from "@/components/create/timeline"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// A bill's History tab: the commit list GitHub gives a file, with the versions
// as the commits — and, on the same rail, the bill's actions, which are its
// status history. The switch at the top picks which (Brendan, 2026-09-03).
//
// A version has no date of its own in LegiScan's Documents table, so its day
// is the night the text was fetched and the row says so.

function CopyId({ id }: { id: number }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Copy the document id"
      onClick={() => {
        void navigator.clipboard?.writeText(String(id))
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function BillHistory({ bill, versions, onOpenText, onOpenChanges }: { bill: Bill; versions: TextVersion[]; onOpenText: (documentId: number) => void; onOpenChanges: (documentId: number) => void }) {
  const [which, setWhich] = React.useState<"versions" | "actions">("versions")
  const actions = React.useMemo(() => [...(bill.history ?? [])].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : Number(b.sequence) - Number(a.sequence))), [bill.history])

  const toggle = (value: "versions" | "actions", label: string) => (
    <button type="button" data-active={which === value} onClick={() => setWhich(value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
      {label}
    </button>
  )

  const versionRows: TimelineRow[] = versions.map((v, index) => {
    const nth = String(versions.length - index).padStart(2, "0")
    return {
      key: `v-${v.document_id}`,
      date: v.fetched_at,
      title: (
        <span>
          <span className="mr-2 font-mono text-xs text-muted-foreground">{nth}</span>
          {v.version ?? "Original"} — {truncate(bill.title, 110)}
        </span>
      ),
      meta: (
        <span>
          {bill.body ?? ""}
          {bill.body ? " · " : ""}
          {fmtNumber(v.chars)} characters · fetched {ago(v.fetched_at) || "on an unknown date"}
        </span>
      ),
      onClick: () => onOpenChanges(v.document_id),
      actions: (
        <>
          <span className="mr-1 font-mono text-xs text-muted-foreground tabular-nums">{v.document_id}</span>
          <CopyId id={v.document_id} />
          <Tip label="Browse the text at this version">
            <Button variant="ghost" size="icon-sm" aria-label="Browse the text at this version" onClick={() => onOpenText(v.document_id)}>
              <FileTextIcon />
            </Button>
          </Tip>
          <Tip label="What this version changed">
            <Button variant="ghost" size="icon-sm" aria-label="What this version changed" onClick={() => onOpenChanges(v.document_id)}>
              <CodeIcon />
            </Button>
          </Tip>
        </>
      ),
    }
  })

  const actionRows: TimelineRow[] = actions.map((a) => ({
    key: `a-${a.date}-${a.sequence}`,
    date: a.date,
    title: a.action,
    meta: `${a.chamber} · step ${a.sequence}`,
    actions: <span className="font-mono text-xs text-muted-foreground tabular-nums">{String(a.sequence).padStart(3, "0")}</span>,
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-6 pt-6">
        <h2 className="text-lg font-semibold">History</h2>
        <span className="text-sm text-muted-foreground">
          for <span className="font-medium text-foreground">{bill.bill_number}</span>
        </span>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {toggle("versions", `Versions · ${versions.length}`)}
          {toggle("actions", `Actions · ${actions.length}`)}
        </div>
      </div>
      {which === "versions" ? (
        <Timeline rows={versionRows} noun="Versions fetched" end={versions.length ? "End of the versions on file for this bill" : "No text on file for this bill yet"} />
      ) : (
        <Timeline rows={actionRows} noun="Actions" end={actions.length ? "End of the record for this bill" : "No actions recorded for this bill yet"} />
      )}
    </div>
  )
}
