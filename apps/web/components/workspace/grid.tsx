"use client"

import * as React from "react"
import { EllipsisVerticalIcon, GripVerticalIcon } from "lucide-react"

import { useLocal } from "@/lib/policy/use-local"
import { arrange, COLORS, DEFAULT_SIZE, readLayout, reorder, sameSize, SIZE_CHOICES, type Color, type Columns, type Layout, type Size } from "@/lib/workspace/datasets"
import { Button } from "@govblock/ui/components/nova/button"
import { Button as MenuButton } from "@govblock/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@govblock/ui/components/dropdown-menu"
import { cn } from "@govblock/ui/lib/utils"

// The standard card grid under /workspace (Brendan, 2026-09-07): four
// columns, a fixed row, every card the same chrome — a badge at the top
// left opposite the ⋮ menu, the media, the title, a line or two, two footer
// buttons, the resize corner. The menu carries the record's own actions
// first, then Rearrange, Size, Color, Reset Component, Reset layout, Delete
// Component. Sizes are spans on the grid; the corner drags them; Rearrange
// drags the cards into a new order; the layout lives in this browser under
// the grid's key. Datasets, bills, members, committees, roll calls: what
// changes per kind is the media, the text, the two buttons and the first
// group of menu items, never the chrome.

const COLS: Record<Size["cols"], string> = { 1: "", 2: "md:col-span-2", 3: "md:col-span-2 xl:col-span-3", 4: "md:col-span-2 xl:col-span-4" }
const ROWS: Record<Size["rows"], string> = { 1: "", 2: "row-span-2" }

export type GridAction = { label: string; onClick?: () => void; disabled?: boolean; title?: string; /** A menu in place of a plain button: the trigger is rendered by the item. */ render?: React.ReactNode }

export type GridItem = {
  key: string
  /** The group the card belongs to, for the rail's jump links. */
  group?: string
  /** Top left, opposite the ⋮: the datasets' lock. Absent inside a dataset. */
  badge?: React.ReactNode
  media: React.ReactNode
  title: string
  description?: string | null
  meta?: string | null
  /** The two footer buttons; a card without them is opened by clicking it. */
  actions?: [GridAction, GridAction]
  /** What a click on the card does when it has no buttons. */
  onOpen?: () => void
  /** The record's own menu entries, above the layout verbs. Mounted only while the menu is open. */
  menu?: React.ReactNode
  /** A colour the record itself chooses, when the reader has not. */
  color?: Color
}

type Metrics = { columns: number; columnWidth: number; rowHeight: number }

function CardActions({
  item,
  size,
  color,
  columns,
  rearranging,
  onSize,
  onColor,
  onColumns,
  onRearranging,
  onResetLayout,
  onDelete,
}: {
  item: GridItem
  size: Size
  color?: Color
  columns: Columns
  rearranging: boolean
  onSize: (size: Size) => void
  onColor: (color: Color | null) => void
  onColumns: (columns: Columns) => void
  onRearranging: (on: boolean) => void
  onResetLayout: () => void
  onDelete: () => void
}) {
  const changed = !sameSize(size, DEFAULT_SIZE) || !!color
  const sizeValue = SIZE_CHOICES.find((c) => sameSize(c.size, size))?.label ?? ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<MenuButton variant="ghost" size="icon-sm" aria-label="Card options" />}>
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-52">
        {item.menu}
        {item.menu && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => onRearranging(!rearranging)}>{rearranging ? "Done rearranging" : "Rearrange"}</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Grid</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-max min-w-44">
            <DropdownMenuRadioGroup value={String(columns)} onValueChange={(value) => onColumns(Number(value) as Columns)}>
              <DropdownMenuRadioItem value="4" className="whitespace-nowrap">
                4 columns
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="8" className="whitespace-nowrap">
                8 columns
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Size</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-max min-w-44">
            <DropdownMenuRadioGroup
              value={sizeValue}
              onValueChange={(label) => {
                const choice = SIZE_CHOICES.find((c) => c.label === label)
                if (choice) onSize(choice.size)
              }}
            >
              {SIZE_CHOICES.map((c) => (
                <DropdownMenuRadioItem key={c.label} value={c.label} className="whitespace-nowrap">
                  {c.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-max min-w-44">
            <DropdownMenuRadioGroup value={color ?? ""} onValueChange={(value) => onColor((value as Color) || null)}>
              {COLORS.map((c) => (
                <DropdownMenuRadioItem key={c.value} value={c.value} className="whitespace-nowrap">
                  <span className={cn("mr-1 inline-block size-3.5 rounded-full", c.swatch)} aria-hidden />
                  {c.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          disabled={!changed}
          onClick={() => {
            onSize(DEFAULT_SIZE)
            onColor(null)
          }}
        >
          Reset Component
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onResetLayout}>Reset layout</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete Component
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GridCard({
  item,
  size,
  color,
  columns,
  onColumns,
  rearranging,
  dragging,
  metrics,
  onSize,
  onColor,
  onRearranging,
  onResetLayout,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  item: GridItem
  size: Size
  color?: Color
  columns: Columns
  onColumns: (columns: Columns) => void
  rearranging: boolean
  dragging: boolean
  metrics: () => Metrics
  onSize: (size: Size) => void
  onColor: (color: Color | null) => void
  onRearranging: (on: boolean) => void
  onResetLayout: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const [resizing, setResizing] = React.useState(false)
  const paint = COLORS.find((c) => c.value === (color ?? item.color))
  // On the eight-column grid a one-column card is half the size: the media
  // shrinks, the title tightens, the lines below it go.
  const compact = columns === 8 && size.cols === 1

  // The corner drag: the pointer's travel, against a column and a row, decides the size.
  const onHandle = (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const start = size
    setResizing(true)
    const move = (e: PointerEvent) => {
      const { columns, columnWidth, rowHeight } = metrics()
      if (!columnWidth || !rowHeight) return
      const cols = Math.max(1, Math.min(4, columns, Math.round(start.cols + (e.clientX - startX) / columnWidth))) as Size["cols"]
      const rows = Math.max(1, Math.min(2, Math.round(start.rows + (e.clientY - startY) / rowHeight))) as Size["rows"]
      if (cols !== size.cols || rows !== size.rows) onSize({ cols, rows })
    }
    const up = () => {
      setResizing(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // The card itself is the first button (Brendan, 2026-09-07): a click
  // anywhere that is not a button, a menu or the corner opens the record.
  const primary = item.actions?.[0]
  const open = item.onOpen ?? (primary && !primary.disabled ? primary.onClick : undefined)
  const openable = !!open && !rearranging
  const onCardClick = (e: React.MouseEvent) => {
    if (!openable) return
    if ((e.target as HTMLElement).closest("button, a, input, [role=menuitem], [role=menu]")) return
    open?.()
  }

  const button = (action: GridAction, index: number) =>
    action.render ?? (
      <Button key={action.label} variant={index === 0 ? "default" : "outline"} className="min-w-0 flex-1 rounded-2xl" disabled={action.disabled} title={action.title} onClick={action.onClick}>
        {action.label}
      </Button>
    )

  return (
    <Card
      data-component={item.key}
      data-group={item.group}
      draggable={rearranging}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", item.key)
        onDragStart()
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => rearranging && e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={onCardClick}
      style={paint ? ({ "--primary": paint.primary, "--primary-foreground": paint.foreground } as React.CSSProperties) : undefined}
      className={cn(
        // A 1px border on hover (Brendan, 2026-09-07); transparent otherwise so nothing shifts.
        "relative h-full min-h-0 overflow-hidden border border-transparent transition-colors hover:border-foreground/50",
        COLS[size.cols],
        ROWS[size.rows],
        openable && "cursor-pointer",
        rearranging && "cursor-grab select-none active:cursor-grabbing",
        dragging && "opacity-40",
        resizing && "ring-2 ring-ring/40"
      )}
    >
      <CardHeader className="items-center">
        {/* The badge sits in line with the ⋮, at the left. */}
        <div className="flex h-7 items-center text-muted-foreground">{item.badge}</div>
        <CardTitle className="sr-only">{item.title}</CardTitle>
        <CardAction className="flex items-center gap-1 self-center">
          {rearranging && (
            <span aria-hidden className="flex size-7 items-center justify-center text-muted-foreground/70" title="Drag to move">
              <GripVerticalIcon className="size-4" />
            </span>
          )}
          <CardActions item={item} size={size} color={color} columns={columns} rearranging={rearranging} onSize={onSize} onColor={onColor} onColumns={onColumns} onRearranging={onRearranging} onResetLayout={onResetLayout} onDelete={onDelete} />
        </CardAction>
      </CardHeader>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col items-center justify-center text-center", compact ? "gap-2" : "gap-4")}>
        <div className={cn("flex items-center justify-center rounded-2xl bg-muted/60", compact ? "p-2" : "p-4")} style={compact ? ({ zoom: 0.6 } as React.CSSProperties) : undefined}>
          {item.media}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className={cn("cn-font-heading font-medium text-balance", compact ? "text-sm" : "text-lg")}>{item.title}</div>
          {!compact && item.description && <CardDescription className="text-pretty">{item.description}</CardDescription>}
          {!compact && item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
        </div>
      </CardContent>
      {item.actions && <CardFooter className="flex items-center gap-2">{item.actions.map(button)}</CardFooter>}
      {/* The corner: drag it right to widen the card, down to make it taller, back to shrink it. */}
      <button type="button" aria-label="Drag to resize" title="Drag to resize" onPointerDown={onHandle} className="absolute right-1 bottom-1 size-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M14 2 2 14M14 8l-6 6M14 14h0" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
    </Card>
  )
}

export function WorkspaceGrid({ storageKey, items, loading, keepOrder, children, className }: { storageKey: string; items: GridItem[]; /** A trailing row of skeletons while more arrive. */ loading?: boolean; /** The items' own order stands (the footer's Filter chip is sorting them); the reader's saved order waits. */ keepOrder?: boolean; children?: React.ReactNode; className?: string }) {
  const [saved, setLayout] = useLocal<Partial<Layout>>(storageKey, {})
  const layout = React.useMemo(() => readLayout(saved), [saved])
  const grid = React.useRef<HTMLDivElement>(null)
  const [rearranging, setRearranging] = React.useState(false)
  const [dragging, setDragging] = React.useState<string | null>(null)

  const cards = React.useMemo(() => (keepOrder ? arrange({ ...layout, order: [] }, items) : arrange(layout, items)), [layout, items, keepOrder])
  const columns: Columns = layout.columns === 8 ? 8 : 4

  // Read at the moment of a drag, so a window that changed width since mount still measures true.
  const metrics = React.useCallback((): Metrics => {
    const el = grid.current
    if (!el) return { columns: 4, columnWidth: 0, rowHeight: 0 }
    const style = getComputedStyle(el)
    const columns = style.gridTemplateColumns.split(" ").filter(Boolean).length || 1
    const gap = parseFloat(style.rowGap) || 0
    return { columns, columnWidth: el.clientWidth / columns, rowHeight: (parseFloat(style.gridAutoRows) || 352) + gap }
  }, [])

  const patch = (change: (current: Layout) => Partial<Layout>) => setLayout((raw) => ({ ...readLayout(raw), ...change(readLayout(raw)) }))
  const setSize = (key: string, size: Size) => patch((c) => ({ sizes: { ...c.sizes, [key]: size } }))
  const setColumns = (columns: Columns) => patch(() => ({ columns }))
  const setColor = (key: string, color: Color | null) =>
    patch((c) => {
      const colors = { ...c.colors }
      if (color) colors[key] = color
      else delete colors[key]
      return { colors }
    })
  const remove = (key: string) => patch((c) => ({ hidden: [...c.hidden.filter((k) => k !== key), key] }))
  const resetLayout = () => {
    patch(() => ({ order: [], sizes: {}, hidden: [], colors: {}, columns: 4 }))
    setRearranging(false)
  }
  const moveBefore = (key: string, before: string) => patch((c) => ({ order: reorder(arrange(c, items), key, before) }))

  return (
    <div className={cn("p-6", className)}>
      {rearranging && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
          Drag a card onto another to move it there.
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setRearranging(false)}>
            Done
          </Button>
        </div>
      )}
      {children}
      <div ref={grid} data-slot="workspace-grid" data-columns={columns} className={cn("grid grid-cols-1 gap-6", columns === 8 ? "auto-rows-[11rem] md:grid-cols-4 xl:grid-cols-8" : "auto-rows-[22rem] md:grid-cols-2 xl:grid-cols-4")}>
        {cards.map((item) => (
          <GridCard
            key={item.key}
            item={item}
            size={layout.sizes[item.key] ?? DEFAULT_SIZE}
            color={layout.colors[item.key]}
            columns={columns}
            onColumns={setColumns}
            rearranging={rearranging}
            dragging={dragging === item.key}
            metrics={metrics}
            onSize={(size) => setSize(item.key, size)}
            onColor={(color) => setColor(item.key, color)}
            onRearranging={setRearranging}
            onResetLayout={resetLayout}
            onDelete={() => remove(item.key)}
            onDragStart={() => setDragging(item.key)}
            onDragEnter={() => dragging && dragging !== item.key && moveBefore(dragging, item.key)}
            onDragEnd={() => setDragging(null)}
          />
        ))}
        {loading && Array.from({ length: 4 }, (_, i) => <div key={`skeleton-${i}`} className="h-full animate-pulse rounded-xl bg-muted/60" />)}
      </div>
      {!cards.length && !loading && <p className="py-12 text-center text-sm text-muted-foreground">Nothing here.</p>}
    </div>
  )
}
