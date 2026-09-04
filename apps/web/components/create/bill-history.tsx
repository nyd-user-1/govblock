"use client"

import * as React from "react"
import { CheckIcon, CodeIcon, CopyIcon, FileTextIcon } from "lucide-react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { dateOfRecord } from "@/lib/policy/date-of-record"
import type { Bill } from "@/lib/policy/types"
import { versionId } from "@/lib/policy/forks"
import { handleFor } from "@/lib/policy/handle"
import { ago, Timeline, type TimelineRow } from "@/components/create/timeline"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// A bill's History tab: the commit list GitHub gives a file, with the versions
// as the commits — and, on the same rail, the bill's actions, which are its
// status history. The switch at the top picks which (Brendan, 2026-09-03).
//
// A version's day is its date of record — the document's own date where the
// source gave one, else the action on the bill's record that produced it
// (`date-of-record.ts`). Never the night the text was fetched.

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
    const date = dateOfRecord(v, bill)
    return {
      key: `v-${v.document_id}`,
      date,
      title: (
        <span>
          <span className="mr-2 font-mono text-xs text-muted-foreground">{nth}</span>
          {v.commit ? v.commit.message : `${v.version ?? "Original"} — ${truncate(bill.title, 110)}`}
        </span>
      ),
      meta: v.commit ? (
        <span>
          <span className="font-medium text-foreground">{v.commit.owner ? handleFor(v.commit.owner) : v.commit.author}</span> committed {ago(v.fetched_at)} · {fmtNumber(v.chars)} characters
        </span>
      ) : (
        <span>
          {date ? fmtDate(date) : "Date of record unknown"} · {fmtNumber(v.chars)} characters
        </span>
      ),
      onClick: () => onOpenChanges(v.document_id),
      actions: (
        <>
          <span className="mr-1 font-mono text-xs text-muted-foreground tabular-nums">{versionId(v)}</span>
          <CopyId id={v.commit ? v.commit.id : v.document_id} />
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
        <Timeline rows={versionRows} noun="Versions" end={versions.length ? "End of the versions on file for this bill" : "No text on file for this bill yet"} />
      ) : (
        <Timeline rows={actionRows} noun="Actions" end={actions.length ? "End of the record for this bill" : "No actions recorded for this bill yet"} />
      )}
    </div>
  )
}
