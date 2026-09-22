"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, GripVertical, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react"

import { BLOCKS, DEFAULT_BLOCKS, blockOf, type BlockKey, type BlockSpec } from "@/lib/blocks"
import { doorHref, entitled } from "@/lib/entitlements"
import { CONGRESS, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { LiveFetch } from "@/lib/policy/manual-fetch"
import { usePolicy } from "@/lib/policy/use-policy"
import type { SessionRow } from "@/lib/policy/types"
import { BlockBody } from "@/components/home/block-body"
import { FlagChip } from "@/components/policy/imagery"
import { StatePicker } from "@/components/state-switcher"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
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
const KEY = "govblock:home-blocks"

export type Block = { id: string; key: BlockKey; span: 1 | 2 }
type Saved = { blocks: Block[]; state: string }

const FRESH: Saved = { blocks: [], state: CONGRESS }

const fresh = (): Saved => ({
  blocks: DEFAULT_BLOCKS.map((key, i) => ({ id: `b${i + 1}`, key, span: i === 0 ? 2 : 1 })),
  state: CONGRESS,
})

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const saved = JSON.parse(raw) as Partial<Saved>
    const blocks = (saved.blocks ?? []).filter((b) => blockOf(b.key))
    return { blocks, state: saved.state ?? CONGRESS }
  } catch {
    return fresh()
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Storage refused; the layout holds for this page only.
  }
}

/** The add panel: the tables not on the grid yet, one to a row, each saying what it shows. */
function AddBlock({ unused, onAdd, trigger, align = "end" }: { unused: BlockSpec[]; onAdd: (key: BlockKey) => void; trigger: React.ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent align={align} className="w-80 p-0" aria-label="Add a block">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Add a block</p>
          <p className="text-xs text-muted-foreground">One shape over one table, in the jurisdiction above.</p>
        </div>
        {unused.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Every block is on the grid.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {unused.map((spec) => (
              <button
                key={spec.key}
                type="button"
                onClick={() => {
                  onAdd(spec.key)
                  setOpen(false)
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="text-sm font-medium">{spec.label}</span>
                  {/* The table it stands over, said plainly: the reader is choosing data, not a widget. */}
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">{spec.table}</span>
                </span>
                <span className="text-xs text-muted-foreground">{spec.description}</span>
              </button>
            ))}
          </div>
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
  onSpan,
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
  onSpan: (span: 1 | 2) => void
  onRemove: () => void
  onRefresh: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const spec = blockOf(block.key)
  const [grabbed, setGrabbed] = React.useState<{ x: number; span: 1 | 2 } | null>(null)
  if (!spec) return null
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "group/tile relative flex flex-col rounded-lg border bg-background p-4 transition-opacity",
        block.span === 2 && "col-span-2",
        dragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={spec.href(state)} className="text-sm font-medium no-underline hover:underline">
            {spec.label}
          </Link>
          <p className="font-mono text-[11px] text-muted-foreground">{spec.table}</p>
        </div>
        <button
          type="button"
          aria-label={`Move ${spec.label}`}
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
              <button type="button" aria-label={`${spec.label} menu`} className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/tile:opacity-100">
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-max min-w-44">
            <DropdownMenuItem onClick={onRefresh} className="whitespace-nowrap">
              <RefreshCw /> Refresh
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={spec.href(state)} />} className="whitespace-nowrap">
              <ArrowUpRight /> Open {spec.label.toLowerCase()}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onRemove} className="whitespace-nowrap">
              <Trash2 /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <BlockBody spec={spec} state={state} session={session} nonce={nonce} />
      </div>
      {/* The corner drags the tile between one column and two, as the analytics tiles do. */}
      <span
        role="separator"
        aria-label={`Resize ${spec.label}`}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setGrabbed({ x: e.clientX, span: block.span })
        }}
        onPointerMove={(e) => {
          if (!grabbed || !columnWidth) return
          const moved = e.clientX - grabbed.x
          const want = Math.min(2, Math.max(1, grabbed.span + Math.round(moved / columnWidth))) as 1 | 2
          if (want !== block.span) onSpan(want)
        }}
        onPointerUp={() => setGrabbed(null)}
        onPointerCancel={() => setGrabbed(null)}
        className="absolute right-1 bottom-1 hidden h-4 w-4 cursor-col-resize rounded-sm opacity-0 transition-opacity group-hover/tile:opacity-100 lg:block"
      >
        <span className="absolute right-1 bottom-1 h-2 w-2 border-r-2 border-b-2 border-muted-foreground/40" />
      </span>
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

  React.useEffect(() => {
    setSaved(load())
    setReady(true)
  }, [])
  React.useEffect(() => {
    if (ready) save(saved)
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
  const add = (key: BlockKey) => update({ blocks: [...blocks, { id: `b${Date.now().toString(36)}`, key, span: 1 }] })
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
              onSpan={(span) => setBlock(block.id, { span })}
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
