"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import { CheckIcon, XIcon } from "lucide-react"

import { fmtBill, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import type { SessionRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { DATASETS, type Dataset } from "@/lib/workspace/datasets"
import type { WorkspacePin } from "@/lib/workspace/pins"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/nova/native-select"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"
import { cn } from "@govblock/ui/lib/utils"

// The home page's "Add metric" panel, for the workspace (Brendan, 2026-09-13):
// off the empty slots and the header's +, a titled panel closed by its X or
// by a choice. What it adds is a card — a dataset, a session of one, or a
// bill in a session — chosen in that order, each step narrowing the next.

type Kind = "dataset" | "session" | "bill"

const KINDS: { key: Kind; label: string }[] = [
  { key: "dataset", label: "Dataset" },
  { key: "session", label: "Session" },
  { key: "bill", label: "Bill" },
]

/** The datasets with sessions to choose from: the chambers, not the departments. */
const CHAMBERS = DATASETS.filter((d): d is Dataset & { state: string; chamber: string } => !!d.state && !!d.chamber)

/** A session's name as the folder shows it: "2025-2026", not "2025-2026 Regular Session". */
export const sessionName = (row: SessionRow) =>
  (row.title ?? String(row.session_id))
    .replace(/\s*(Regular|General)\s+Session$/i, "")
    .replace(/\s*Session$/i, "")
    .trim() || String(row.session_id)

type SearchBill = { bill_id: number; bill_number: string; title: string; body?: string | null; state?: string | null }

function Row({ added, onClick, children, hint }: { added: boolean; onClick: () => void; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <li className="m-0 p-0">
      <button type="button" disabled={added} onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent">
        <span className="min-w-0 flex-1">{children}</span>
        {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
        {added && <CheckIcon className="size-4 shrink-0 text-emerald-600" aria-label="On your workspace" />}
      </button>
    </li>
  )
}

function useDebounced(value: string, wait = 250) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), wait)
    return () => window.clearTimeout(timer)
  }, [value, wait])
  return debounced
}

function Chooser({ have, onAdd }: { have: (pin: WorkspacePin) => boolean; onAdd: (pin: WorkspacePin) => void }) {
  const [kind, setKind] = React.useState<Kind>("dataset")
  const [query, setQuery] = React.useState("")
  const [chamberKey, setChamberKey] = React.useState(CHAMBERS[0].key)
  const chamber = CHAMBERS.find((d) => d.key === chamberKey) ?? CHAMBERS[0]
  const { data: sessions } = usePolicy<SessionRow[]>(kind === "dataset" ? null : "sessions", { state: chamber.state }, { titles: 1 })
  const [sessionId, setSessionId] = React.useState<number | null>(null)
  const session = sessionId ?? sessions?.[0]?.session_id ?? null
  const term = useDebounced(query.trim())
  const { data: found } = usePolicy<{ bills: SearchBill[] }>(kind === "bill" && term.length >= 2 && session ? "search" : null, { state: chamber.state, session: session ? String(session) : undefined }, { q: term, limit: 8 })

  const datasets = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? DATASETS.filter((d) => d.title.toLowerCase().includes(q) || (d.state && stateName(d.state).toLowerCase().includes(q))) : DATASETS).slice(0, 12)
  }, [query])

  const chamberSelect = (
    <NativeSelect
      value={chamber.key}
      onChange={(e) => {
        setChamberKey(e.target.value)
        setSessionId(null)
      }}
      aria-label="Dataset"
    >
      {CHAMBERS.map((d) => (
        <NativeSelectOption key={d.key} value={d.key}>
          {d.title}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            data-active={kind === k.key}
            onClick={() => {
              setKind(k.key)
              setQuery("")
            }}
            className="flex-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
          >
            {k.label}
          </button>
        ))}
      </div>
      {kind === "dataset" && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a dataset…" aria-label="Find a dataset" autoFocus />}
      {kind === "session" && chamberSelect}
      {kind === "bill" && (
        <>
          {chamberSelect}
          <NativeSelect value={session ? String(session) : ""} onChange={(e) => setSessionId(Number(e.target.value) || null)} aria-label="Session" disabled={!sessions?.length}>
            {(sessions ?? []).map((row) => (
              <NativeSelectOption key={row.session_id} value={String(row.session_id)}>
                {sessionName(row)}
              </NativeSelectOption>
            ))}
            {!sessions?.length && <NativeSelectOption value="">Loading sessions…</NativeSelectOption>}
          </NativeSelect>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A number or a title…" aria-label="Find a bill" autoFocus />
        </>
      )}
      <ul className="-mx-3 m-0 -mb-2 max-h-72 min-h-40 list-none divide-y overflow-y-auto border-t p-0">
        {kind === "dataset" &&
          datasets.map((d) => {
            const pin: WorkspacePin = { kind: "dataset", key: d.key }
            return (
              <Row key={d.key} added={have(pin)} onClick={() => onAdd(pin)} hint={d.state ? stateName(d.state) : "Federal"}>
                <span className="block truncate">{d.title}</span>
              </Row>
            )
          })}
        {kind === "dataset" && !datasets.length && <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground">No dataset by that name.</li>}
        {kind === "session" &&
          (sessions ?? []).map((row) => {
            const pin: WorkspacePin = { kind: "session", state: chamber.state, chamber: chamber.chamber, session: Number(row.session_id), title: sessionName(row), bills: row.bills ?? null }
            return (
              <Row key={row.session_id} added={have(pin)} onClick={() => onAdd(pin)} hint={row.bills != null ? `${fmtNumber(row.bills)} bills` : undefined}>
                {sessionName(row)}
              </Row>
            )
          })}
        {kind === "session" && !sessions && <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground"><LoadingFlag width={28} /></li>}
        {kind === "bill" &&
          (found?.bills ?? []).map((b) => {
            const pin: WorkspacePin = { kind: "bill", state: chamber.state, chamber: b.body ?? chamber.chamber, session, billId: b.bill_id, number: b.bill_number, title: b.title }
            return (
              <Row key={b.bill_id} added={have(pin)} onClick={() => onAdd(pin)}>
                <span className="block font-medium">{fmtBill(b.bill_number, chamber.state)}</span>
                <span className="block truncate text-xs text-muted-foreground">{b.title}</span>
              </Row>
            )
          })}
        {kind === "bill" && term.length < 2 && <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground">Type a bill number or a few words of its title.</li>}
        {kind === "bill" && term.length >= 2 && found && !found.bills.length && <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground">Nothing by that name in {sessionName(sessions?.find((s) => Number(s.session_id) === Number(session)) ?? { session_id: session ?? 0, bills: 0, title: "" })}.</li>}
        {kind === "bill" && term.length >= 2 && !found && <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground"><LoadingFlag width={28} /></li>}
      </ul>
    </>
  )
}

/** The panel off a + or an empty slot: a card to add, closed by its X or by the choice. */
export function AddToWorkspace({ trigger, align = "start", have, onAdd, className }: { trigger: React.ReactElement; align?: "start" | "end"; have: (pin: WorkspacePin) => boolean; onAdd: (pin: WorkspacePin) => void; className?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align={align} className={cn("flex w-80 flex-col gap-2 rounded-xl p-3 pt-1.5", className)}>
        <div className="-mr-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Add to workspace</span>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Close" onClick={() => setOpen(false)}>
            <XIcon />
          </Button>
        </div>
        {open && (
          <Chooser
            have={have}
            onAdd={(pin) => {
              onAdd(pin)
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The empty slot on the grid (Brendan, 2026-09-13): the home page's dashed tile, a + in it, the panel off it. */
export function EmptySlot({ have, onAdd }: { have: (pin: WorkspacePin) => boolean; onAdd: (pin: WorkspacePin) => void }) {
  return (
    <AddToWorkspace
      have={have}
      onAdd={onAdd}
      trigger={
        <button type="button" aria-label="Add a card" className="flex h-full w-full items-center justify-center rounded-[min(var(--radius-4xl),24px)] border border-dashed text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      }
    />
  )
}
