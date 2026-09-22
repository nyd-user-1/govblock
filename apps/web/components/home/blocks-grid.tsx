"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, ChevronLeft, ChevronRight, GripVertical, MoreHorizontal, Plus, Maximize2, Minimize2, RefreshCw, Trash2, TrendingUp } from "lucide-react"

import { BLOCKS, DEFAULT_BLOCKS, blockOf, type BlockKey, type BlockRecord, type BlockSpec } from "@/lib/blocks"
import { EMPTY, readBlocks, useBlocks, writeBlocks, type BlocksSaved } from "@/lib/blocks-store"
import { doorHref, entitled } from "@/lib/entitlements"
import { CONGRESS, stateName } from "@/lib/filters"
import { fmtBill, fmtNumber } from "@/lib/format"
import { TRENDING } from "@/lib/trending"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { LiveFetch } from "@/lib/policy/manual-fetch"
import { policyUrl, usePolicy } from "@/lib/policy/use-policy"
import type { SessionRow } from "@/lib/policy/types"
import { BlockBody, RecordBody } from "@/components/home/block-body"
import { FlagChip } from "@/components/policy/imagery"
import { StatePicker } from "@/components/state-switcher"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@govblock/ui/components/nova/command"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

// Blocks (Brendan, 2026-09-22): the account home's second grid, the Analytics
// grid's own mechanics over the catalogue in lib/blocks.ts. Copied rather than
// shared on purpose — Analytics is settled and this is not, so nothing here
// can move it. The grid, the drag, the span, the menu and the add panel are
// the ones a reader already knows from the section above.
//
// A block is one shape over one table in one jurisdiction. The reader presses
// +, picks a table, and it lands in their grid; the layout and the
// jurisdiction live in this browser, as Analytics' do. What a block draws is
// components/home/block-body.tsx, which knows two shapes and nothing else.

const COLUMNS = 4

export type { Block } from "@/lib/blocks-store"
type Saved = BlocksSaved
type Block = BlocksSaved["blocks"][number]

const FRESH: Saved = EMPTY

const fresh = (): Saved => ({
  blocks: DEFAULT_BLOCKS.map((key, i) => ({ id: `b${i + 1}`, key, span: i === 0 ? 2 : 1 })),
  state: CONGRESS,
})

function load(): Saved {
  const saved = readBlocks()
  if (!saved) return fresh()
  return { blocks: saved.blocks.filter((b) => blockOf(b.key)), state: saved.state }
}

type Found = { id: string; label: string; detail: string; state: string }

/** The second step's list: the site's own search, narrowed to the table the reader picked. */
function useRecords(spec: BlockSpec | null, state: string, term: string) {
  const [rows, setRows] = React.useState<Found[]>([])
  const [loading, setLoading] = React.useState(false)
  const query = term.trim()
  React.useEffect(() => {
    if (!spec?.pick || query.length < 2) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(policyUrl("search", { state }, { q: query, limit: 8 }))
        const data = response.ok ? ((await response.json()) as SearchAnswer) : null
        if (cancelled) return
        const kind = spec.pick!.kind
        setRows(
          kind === "bills"
            ? (data?.bills ?? []).map((b) => ({ id: String(b.bill_id), label: fmtBill(b.bill_number, b.state ?? state), detail: b.title, state: b.state ?? state }))
            : kind === "members"
              ? (data?.members ?? []).map((m) => ({ id: String(m.people_id), label: m.name, detail: [m.party, m.chamber].filter(Boolean).join(" · "), state: m.state ?? state }))
              : (data?.committees ?? []).map((c) => ({ id: c.committee, label: c.committee, detail: `${fmtNumber(c.bills)} bills`, state: c.state ?? state }))
        )
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [spec, state, query])
  return { rows, loading }
}

type SearchAnswer = {
  bills?: { bill_id: number; bill_number: string; title: string; state?: string }[]
  members?: { people_id: number; name: string; party: string; chamber: string; state?: string }[]
  committees?: { committee: string; bills: number; state?: string }[]
}

/**
 * The add panel, in two steps (Brendan, 2026-09-22: "how do we use this to add a particular bill?"). The first is the
 * table — the ones not on the grid yet, each saying what it shows. The second, for a table whose records the search
 * can find, is the whole table or one record of it, typed for by name or number. The second step is the site's own
 * search narrowed to that table, so picking a bill here is picking a bill anywhere.
 */
function AddBlock({ unused, state, onAdd, trigger, align = "end" }: { unused: BlockSpec[]; state: string; onAdd: (key: BlockKey, record?: BlockRecord) => void; trigger: React.ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<BlockSpec | null>(null)
  const [term, setTerm] = React.useState("")
  const { rows, loading } = useRecords(step, state, term)

  const close = () => {
    setOpen(false)
    setStep(null)
    setTerm("")
  }
  const take = (key: BlockKey, record?: BlockRecord) => {
    onAdd(key, record)
    close()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setStep(null)
          setTerm("")
        }
      }}
    >
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent align={align} className="w-80 p-0" aria-label="Add a block">
        {step ? (
          <>
            <div className="flex items-center gap-2 border-b px-2 py-2">
              <button type="button" onClick={() => setStep(null)} aria-label="Back to the tables" className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ChevronLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{step.label}</p>
                <p className="truncate text-xs text-muted-foreground">The whole table, or one of them</p>
              </div>
            </div>
            <button type="button" onClick={() => take(step.key)} className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
              <FlagChip state={state} width={16} />
              <span className="min-w-0 flex-1 truncate">All of {state === CONGRESS ? "Congress" : stateName(state)}</span>
            </button>
            <Command loop shouldFilter={false} className="rounded-none! border-0">
              <CommandInput placeholder={`Find a ${step.label.replace(/s$/, "").toLowerCase()}…`} value={term} onValueChange={setTerm} autoFocus />
              <CommandList className="max-h-64">
                <CommandEmpty>{loading ? "Looking…" : term.trim().length < 2 ? "" : "Nothing found."}</CommandEmpty>
                {/* Before a word is typed, what the country is legislating about (Brendan, 2026-09-22): a block can be
                    added without running a search first. A term fills the field and the records follow. */}
                {term.trim().length < 2 && (
                  <CommandGroup heading="Trending">
                    {TRENDING.map((item) => (
                      <CommandItem key={item.term} value={item.term} onSelect={() => setTerm(item.term)} className="gap-2">
                        <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{item.term}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(item.bills)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {rows.map((row) => (
                  <CommandItem key={`${row.state}-${row.id}`} value={`${row.label} ${row.detail}`} onSelect={() => take(step.key, { id: row.id, label: row.label, state: row.state })} className="gap-2">
                    <FlagChip state={row.state} width={16} />
                    <span className="shrink-0 font-medium">{row.label}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.detail}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </>
        ) : (
          <>
            <div className="border-b px-3 py-2">
              <p className="text-sm font-medium">Add a block</p>
              <p className="text-xs text-muted-foreground">One shape over one table, whole or a single record.</p>
            </div>
            {unused.length === 0 && BLOCKS.every((b) => !b.pick) ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Every block is on the grid.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto p-1">
                {/* A table whose records can be picked stays on the list even once its own block is up: a reader may want the table and three of its bills. */}
                {BLOCKS.filter((spec) => spec.pick || unused.some((u) => u.key === spec.key)).map((spec) => (
                  <button
                    key={spec.key}
                    type="button"
                    onClick={() => (spec.pick ? setStep(spec) : take(spec.key))}
                    className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="text-sm font-medium">{spec.label}</span>
                      {/* The table it stands over, said plainly: the reader is choosing data, not a widget. */}
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{spec.table}</span>
                      {spec.pick && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{spec.description}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function BlockTile({
  block,
  state,
  session,
  nonce,
  columnWidth,
  dragging,
  onSize,
  onRemove,
  onRefresh,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  block: Block
  state: string
  session: number | null
  nonce: number
  columnWidth: number
  dragging: boolean
  onSize: (size: { span: 1 | 2; rows: 1 | 2 }) => void
  onRemove: () => void
  onRefresh: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const spec = blockOf(block.key)
  const [grabbed, setGrabbed] = React.useState<{ x: number; y: number; span: 1 | 2; rows: 1 | 2 } | null>(null)
  if (!spec) return null
  // A block over one record wears that record's name and leads to its page; over the table, the table's.
  const record = block.record
  const title = record ? record.label : spec.label
  const href = record && spec.pick ? spec.pick.href(record) : spec.href(state)
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "group/tile relative flex flex-col rounded-lg border bg-background p-4 transition-opacity",
        block.span === 2 && "col-span-2",
        block.rows === 2 && "row-span-2",
        dragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* A record opens where it stands — the tile grows to two by two and draws as the record's page opens; a table's block leads to its page, which is the whole table. */}
          {record ? (
            <button
              type="button"
              onClick={() => onSize({ span: block.rows === 2 ? 1 : 2, rows: block.rows === 2 ? 1 : 2 })}
              aria-expanded={block.rows === 2}
              className="max-w-full truncate text-left text-sm font-medium hover:underline"
            >
              {title}
            </button>
          ) : (
            <Link href={href} className="truncate text-sm font-medium no-underline hover:underline">
              {title}
            </Link>
          )}
        </div>
        <button
          type="button"
          aria-label={`Move ${title}`}
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/tile:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label={`${title} menu`} className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/tile:opacity-100">
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-max min-w-44">
            <DropdownMenuItem onClick={onRefresh} className="whitespace-nowrap">
              <RefreshCw /> Refresh
            </DropdownMenuItem>
            {record && (
              <DropdownMenuItem onClick={() => onSize({ span: block.rows === 2 ? 1 : 2, rows: block.rows === 2 ? 1 : 2 })} className="whitespace-nowrap">
                {block.rows === 2 ? <Minimize2 /> : <Maximize2 />} {block.rows === 2 ? "Collapse" : "Expand"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<Link href={href} />} className="whitespace-nowrap">
              <ArrowUpRight /> Open {record ? record.label : spec.label.toLowerCase()}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onRemove} className="whitespace-nowrap">
              <Trash2 /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {record ? <RecordBody spec={spec} record={record} session={session} nonce={nonce} large={block.rows === 2} /> : <BlockBody spec={spec} state={state} session={session} nonce={nonce} />}
      </div>
      {/* The corner: the analytics tile's own, to the pixel — drag it right to widen the tile to two columns, left to bring it back. */}
      <button
        type="button"
        aria-label={block.span === 2 ? "Drag to narrow" : "Drag to widen"}
        title="Drag to resize"
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setGrabbed({ x: e.clientX, y: e.clientY, span: block.span, rows: block.rows ?? 1 })
        }}
        onPointerMove={(e) => {
          if (!grabbed || !columnWidth) return
          const span = Math.min(2, Math.max(1, grabbed.span + Math.round((e.clientX - grabbed.x) / columnWidth))) as 1 | 2
          // A row is the grid's own 224px and the gap under it.
          const rows = Math.min(2, Math.max(1, grabbed.rows + Math.round((e.clientY - grabbed.y) / 240))) as 1 | 2
          if (span !== block.span || rows !== (block.rows ?? 1)) onSize({ span, rows })
        }}
        onPointerUp={() => setGrabbed(null)}
        onPointerCancel={() => setGrabbed(null)}
        className="absolute right-1 bottom-1 size-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M14 2 2 14M14 8l-6 6M14 14h0" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
    </div>
  )
}

export function BlocksGrid() {
  return (
    <LiveFetch>
      <Grid />
    </LiveFetch>
  )
}

function Grid() {
  const [saved, setSaved] = React.useState<Saved>(FRESH)
  const router = useRouter()
  const { reader } = useJurisdiction()
  const [picking, setPicking] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [nonce, setNonce] = React.useState(0)
  const grid = React.useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = React.useState(0)
  const [dragging, setDragging] = React.useState<string | null>(null)

  const stored = useBlocks()
  React.useEffect(() => {
    setSaved(load())
    setReady(true)
  }, [])
  // A block added from a record page elsewhere on the site lands here without a reload.
  React.useEffect(() => {
    if (ready && stored) setSaved((current) => (JSON.stringify(stored) === JSON.stringify(current) ? current : stored))
  }, [stored, ready])
  React.useEffect(() => {
    if (ready) writeBlocks(saved)
  }, [saved, ready])
  React.useEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = () => setColumnWidth(el.getBoundingClientRect().width / COLUMNS)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { blocks, state } = saved
  const { data: sessionRows } = usePolicy<SessionRow[]>("sessions", { state })
  const sessions = Array.isArray(sessionRows) ? sessionRows : []
  const session = (sessions.find((row) => Number(row.bills) > 0) ?? sessions[0])?.session_id ?? null

  const update = (next: Partial<Saved>) => setSaved((current) => ({ ...current, ...next }))
  const setBlock = (id: string, patch: Partial<Block>) => update({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  const remove = (id: string) => update({ blocks: blocks.filter((b) => b.id !== id) })
  const moveTo = (id: string, onto: string) => {
    const from = blocks.findIndex((b) => b.id === id)
    const to = blocks.findIndex((b) => b.id === onto)
    if (from < 0 || to < 0 || from === to) return
    const next = [...blocks]
    next.splice(to, 0, ...next.splice(from, 1))
    update({ blocks: next })
  }
  const add = (key: BlockKey, record?: BlockRecord) => update({ blocks: [...blocks, { id: `b${Date.now().toString(36)}`, key, span: 1, ...(record ? { record } : {}) }] })
  const unused = BLOCKS.filter((spec) => !blocks.some((b) => b.key === spec.key))

  // The header's rule (lib/policy/jurisdiction.tsx): a jurisdiction the reader may not open leads to the door.
  const active = reader.home && reader.home !== CONGRESS ? [CONGRESS, reader.home] : [CONGRESS]
  const pick = (code: string) => {
    setPicking(false)
    const allowed = entitled(reader, { state: code })
    if (allowed !== "open") return router.push(doorHref(allowed))
    update({ state: code })
  }

  const used = blocks.reduce((sum, b) => sum + b.span, 0) % COLUMNS
  const blanks = used === 0 ? 0 : COLUMNS - used

  return (
    <section id="blocks" className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Blocks</h2>
        <div className="ml-auto flex items-center gap-2">
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger
              render={
                <Button variant="outline" aria-label={`Jurisdiction: ${stateName(state)}. Change jurisdiction`}>
                  <FlagChip state={state} /> {state === CONGRESS ? "U.S. Congress" : stateName(state)}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-64 p-0" aria-label="Jurisdictions">
              <StatePicker state={state} active={active} onSelect={pick} className="rounded-lg!" />
            </PopoverContent>
          </Popover>
          <AddBlock
            unused={unused}
            state={state}
            onAdd={add}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Add a block">
                <Plus />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw />
          </Button>
        </div>
      </div>
      <div ref={grid} className="grid auto-rows-[224px] grid-cols-4 gap-4">
        {ready &&
          blocks.map((block) => (
            <BlockTile
              key={block.id}
              block={block}
              state={state}
              session={session}
              nonce={nonce}
              columnWidth={columnWidth}
              dragging={dragging === block.id}
              onSize={(size) => setBlock(block.id, size)}
              onRemove={() => remove(block.id)}
              onRefresh={() => setNonce((n) => n + 1)}
              onDragStart={() => setDragging(block.id)}
              onDragEnter={() => dragging && dragging !== block.id && moveTo(dragging, block.id)}
              onDragEnd={() => setDragging(null)}
            />
          ))}
        {ready &&
          Array.from({ length: blocks.length === 0 ? COLUMNS : blanks }, (_, i) => (
            <AddBlock
              key={`blank-${i}`}
              align="start"
              unused={unused}
              state={state}
              onAdd={add}
              trigger={
                <button type="button" aria-label="Add a block" className="flex h-full w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground/60 transition-colors hover:border-ring hover:text-foreground">
                  <Plus className="size-6" />
                </button>
              }
            />
          ))}
      </div>
    </section>
  )
}
