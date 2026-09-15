"use client"

import * as React from "react"

import { printingExpression, versionCodeOfName, versionName } from "@/lib/typeset/versions"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { VersionCode } from "@/components/workspace/version-code"
import { Chip } from "@/components/chip"
import { cn } from "@govblock/ui/lib/utils"

// A bill's versions, the same shape on every reader (Brendan, 2026-09-15):
// one row per printing, newest first, its stage as a chip that explains
// itself, its name, the date at the right, and under it the printing's
// address in the store as a copy chip. A row opens that printing.

const dayOf = (v: TextVersion) => {
  const raw = v.date ?? v.fetched_at
  return raw ? String(raw).slice(0, 10) : null
}

export function VersionsList({ versions, current, onChoose, work }: { versions: TextVersion[]; current: number | null; onChoose: (documentId: number) => void; onOpenChanges?: (documentId: number) => void; work?: string | null }) {
  if (!versions.length) return <p className="px-3 py-4 text-xs text-muted-foreground">No text on file for this bill yet.</p>
  return (
    <div className="py-1">
      {versions.map((v) => {
        const name = v.commit ? v.commit.message : (v.version ?? "Original")
        const code = v.commit ? null : versionCodeOfName(v.version)
        const day = dayOf(v)
        const expression = v.commit ? null : printingExpression(work ?? null, day, v.version)
        const address = work && expression ? `${work}@${expression}` : null
        const active = current === v.document_id
        return (
          <div
            key={v.document_id}
            role="button"
            tabIndex={0}
            data-active={active}
            onClick={() => onChoose(v.document_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onChoose(v.document_id)
            }}
            className={cn("flex w-full cursor-pointer flex-col gap-1 px-3 py-1.5 text-left text-xs hover:bg-muted", active && "bg-muted/60")}
          >
            <span className="flex items-center gap-2">
              {code && <VersionCode code={code} />}
              <span className={cn("truncate", active && "font-medium text-foreground")}>{code ? versionName(code) : name}</span>
              {day && <span className="ml-auto shrink-0 font-mono text-muted-foreground tabular-nums">{day}</span>}
            </span>
            {address && (
              <Chip copy={address} className="w-fit max-w-full truncate text-[11px]">
                {address}
              </Chip>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The bill's history: what each chamber did and when, newest first. */
export function BillHistoryList({ history }: { history: { date: string; chamber: string; action: string; sequence: number }[] }) {
  if (!history.length) return <p className="px-3 py-4 text-xs text-muted-foreground">No actions on file for this bill yet.</p>
  const rows = [...history].sort((a, b) => b.sequence - a.sequence)
  return (
    <div className="py-1">
      {rows.map((h) => (
        <div key={`${h.sequence}-${h.date}`} className="flex flex-col gap-0.5 px-3 py-1.5 text-xs">
          <span className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted/40 px-1.5 py-px font-mono text-[11px] leading-4">{h.chamber}</span>
            <span className="ml-auto shrink-0 font-mono text-muted-foreground tabular-nums">{String(h.date).slice(0, 10)}</span>
          </span>
          <span className="text-pretty">{h.action}</span>
        </div>
      ))}
    </div>
  )
}
