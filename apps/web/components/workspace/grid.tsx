"use client"

import * as React from "react"
import { CheckIcon, EllipsisVerticalIcon, GripVerticalIcon, PlusIcon } from "lucide-react"

import { useLocal } from "@/lib/policy/use-local"
import {
  arrange,
  COLORS,
  DEFAULT_SIZE,
  readLayout,
  reorder,
  sameSize,
  SIZE_CHOICES,
  type CardDetails,
  type Color,
  type Columns,
  type Layout,
  type Size,
} from "@/lib/workspace/datasets"
import { pinKey, useWorkspacePins, type WorkspacePin } from "@/lib/workspace/pins"
import { EditDetailsDialog } from "@/components/project-card"
import { Button } from "@govblock/ui/components/nova/button"
import { Button as MenuButton } from "@govblock/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@govblock/ui/components/card"
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
// columns, a fixed row, every card the same chrome — the + that adds the
// card to /workspace at the top left opposite the grip and the ⋮ (both only
// while the pointer is over the card), the media, the title, a line or two,
// the badge at the bottom left opposite the resize corner (Brendan,
// 2026-09-13: the footer buttons are gone; the card is the button, the menu
// carries the rest). The menu carries the record's own actions first, then
// Edit details, Pin to top, Rearrange, Grid, Size, Reset Component, Reset
// layout, Delete Component. Sizes are spans on the grid; the corner drags
// them; Rearrange drags the cards into a new order; the layout lives in this
// browser under the grid's key. Datasets, bills, members, committees, roll
// calls: what changes per kind is the media, the text, the badge and the
// first group of menu items, never the chrome.

const COLS: Record<Size["cols"], string> = {
  1: "",
  2: "md:col-span-2",
  3: "md:col-span-2 xl:col-span-3",
  4: "md:col-span-2 xl:col-span-4",
  6: "md:col-span-2 xl:col-span-6",
  8: "md:col-span-2 xl:col-span-8",
}
const ROWS: Record<Size["rows"], string> = {
  1: "",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
}

/** How long a press has to last before the card lifts (Brendan, 2026-09-13: a click opens, a hold drags). */
const HOLD_MS = 280

export type GridItem = {
  key: string
  /** The group the card belongs to, for the rail's jump links. */
  group?: string
  /** Bottom left, opposite the corner: the datasets' lock, a bill's sponsor, a session's check. */
  badge?: React.ReactNode
  media: React.ReactNode
  title: string
  description?: string | null
  meta?: string | null
  /** What a click on the card does. */
  onOpen?: () => void
  /** The record's own menu entries, above the layout verbs. Mounted only while the menu is open. */
  menu?: React.ReactNode
  /** The card as it would sit on /workspace: the + at the top left adds it there (Brendan, 2026-09-13). */
  workspace?: WorkspacePin
  /** A colour the record itself chooses, when the reader has not. */
  color?: Color
  /** The size the block needs on the four-column grid; doubled on the eight-column one. */
  defaultSize?: Size
  /** The media fills the card (a live block) rather than sitting in the tile. */
  fill?: boolean
  /** The block IS the cell: no chrome of the grid's around `media`, only the corner and, in Rearrange, the grip. */
  bare?: boolean
  /** A bare block with no ⋮ of its own gets one from the grid at its top right. */
  ownMenu?: boolean
  /** The block's docs page, for the menu's Code item. */
  docs?: string
}

/**
 * A block's default size on this grid. A block that declares the size it
 * needs keeps its pixel size on eight columns, so it doubles; a card that
 * declares none (a dataset, a bill, a member) is half the size there, which
 * is what eight columns is for (Brendan, 2026-09-07).
 */
function defaultFor(item: GridItem, columns: Columns): Size {
  const base = item.defaultSize
  if (!base || columns === 4) return base ?? DEFAULT_SIZE
  return {
    cols: Math.min(8, base.cols * 2) as Size["cols"],
    rows: Math.min(4, base.rows * 2) as Size["rows"],
  }
}

function sizeFor(item: GridItem, columns: Columns, saved?: Size): Size {
  return saved ?? defaultFor(item, columns)
}

type Metrics = { columns: number; columnWidth: number; rowHeight: number }

/**
 * A block standing bare on the grid (Brendan, 2026-09-07: "the cards are the
 * cards") carries no chrome of the grid's; its own ⋮ — card-frame's
 * ComponentActions — reads this and becomes the grid's menu.
 */
export type GridCell = {
  /** The block's docs page, for the Code item. */
  docs?: string
  size: Size
  /** The size the block has by default on this grid; Reset returns to it. */
  base: Size
  color?: Color
  columns: Columns
  rearranging: boolean
  pinned: boolean
  onPin: () => void
  onSize: (size: Size) => void
  onColor: (color: Color | null) => void
  onColumns: (columns: Columns) => void
  onRearranging: (on: boolean) => void
  onResetLayout: () => void
  onDelete: () => void
}

const GridCellContext = React.createContext<GridCell | null>(null)

export function useGridCell(): GridCell | null {
  return React.useContext(GridCellContext)
}

/** The grid's menu items, for a bare block's own ⋮. */
export function GridCellItems({ cell }: { cell: GridCell }) {
  const changed = !sameSize(cell.size, cell.base) || !!cell.color
  const sizeValue =
    SIZE_CHOICES.find((c) => sameSize(c.size, cell.size))?.label ?? ""
  return (
    <>
      {cell.docs && (
        <>
          <DropdownMenuItem render={<a href={cell.docs} />}>
            Code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={cell.onPin}>
        {cell.pinned ? "Unpin" : "Pin to top"}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => cell.onRearranging(!cell.rearranging)}>
        {cell.rearranging ? "Done rearranging" : "Rearrange"}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Grid</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-max min-w-44">
          <DropdownMenuRadioGroup
            value={String(cell.columns)}
            onValueChange={(value) => cell.onColumns(Number(value) as Columns)}
          >
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
              if (choice) cell.onSize(choice.size)
            }}
          >
            {SIZE_CHOICES.map((c) => (
              <DropdownMenuRadioItem
                key={c.label}
                value={c.label}
                className="whitespace-nowrap"
              >
                {c.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-max min-w-44">
          <DropdownMenuRadioGroup
            value={cell.color ?? ""}
            onValueChange={(value) => cell.onColor((value as Color) || null)}
          >
            {COLORS.map((c) => (
              <DropdownMenuRadioItem
                key={c.value}
                value={c.value}
                className="whitespace-nowrap"
              >
                <span
                  className={cn(
                    "mr-1 inline-block size-3.5 rounded-full",
                    c.swatch
                  )}
                  aria-hidden
                />
                {c.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem
        disabled={!changed}
        onClick={() => {
          cell.onSize(cell.base)
          cell.onColor(null)
        }}
      >
        Reset Component
      </DropdownMenuItem>
      <DropdownMenuItem onClick={cell.onResetLayout}>
        Reset layout
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" onClick={cell.onDelete}>
        Delete Component
      </DropdownMenuItem>
    </>
  )
}

/** The card's ⋮ (Brendan, 2026-09-13): the record's own items, then Edit details, Pin to top and Add to Workspace, then the layout verbs. No Color here — the cards have no button left to paint. */
function CardActions({
  item,
  size,
  color,
  columns,
  rearranging,
  pinned,
  inWorkspace,
  onSize,
  onColor,
  onColumns,
  onRearranging,
  onPin,
  onEdit,
  onWorkspace,
  onResetLayout,
  onDelete,
}: {
  item: GridItem
  size: Size
  color?: Color
  columns: Columns
  rearranging: boolean
  pinned: boolean
  inWorkspace: boolean
  onSize: (size: Size) => void
  onColor: (color: Color | null) => void
  onColumns: (columns: Columns) => void
  onRearranging: (on: boolean) => void
  onPin: () => void
  onEdit: () => void
  onWorkspace: () => void
  onResetLayout: () => void
  onDelete: () => void
}) {
  const base = defaultFor(item, columns)
  const changed = !sameSize(size, base) || !!color
  const sizeValue =
    SIZE_CHOICES.find((c) => sameSize(c.size, size))?.label ?? ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <MenuButton
            variant="ghost"
            size="icon-sm"
            aria-label="Card options"
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-52">
        {item.menu}
        {item.menu && <DropdownMenuSeparator />}
        {item.docs && (
          <>
            <DropdownMenuItem render={<a href={item.docs} />}>
              Code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onEdit}>Edit details</DropdownMenuItem>
        <DropdownMenuItem onClick={onPin}>
          {pinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        {item.workspace && (
          <DropdownMenuItem onClick={onWorkspace}>
            {inWorkspace ? "Remove from Workspace" : "Add to Workspace"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRearranging(!rearranging)}>
          {rearranging ? "Done rearranging" : "Rearrange"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Grid</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-max min-w-44">
            <DropdownMenuRadioGroup
              value={String(columns)}
              onValueChange={(value) => onColumns(Number(value) as Columns)}
            >
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
                <DropdownMenuRadioItem
                  key={c.label}
                  value={c.label}
                  className="whitespace-nowrap"
                >
                  {c.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          disabled={!changed}
          onClick={() => {
            onSize(base)
            onColor(null)
          }}
        >
          Reset Component
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onResetLayout}>
          Reset layout
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete Component
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The + at the top left (Brendan, 2026-09-13): the ⋮'s twin, there while the pointer is over the card; a check, always, once the card is on /workspace. */
function WorkspaceButton({
  inWorkspace,
  onClick,
}: {
  inWorkspace: boolean
  onClick: () => void
}) {
  return (
    <MenuButton
      variant="ghost"
      size="icon-sm"
      aria-label={inWorkspace ? "Remove from Workspace" : "Add to Workspace"}
      title={inWorkspace ? "In your workspace" : "Add to Workspace"}
      onClick={onClick}
      className={cn(
        "transition-opacity",
        inWorkspace
          ? "text-emerald-600"
          : "opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
      )}
    >
      {inWorkspace ? <CheckIcon /> : <PlusIcon />}
    </MenuButton>
  )
}

function GridCard({
  item,
  size,
  color,
  columns,
  details,
  pinned,
  inWorkspace,
  onColumns,
  rearranging,
  dragging,
  metrics,
  onSize,
  onColor,
  onRearranging,
  onPin,
  onEdit,
  onWorkspace,
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
  details: CardDetails
  pinned: boolean
  inWorkspace: boolean
  onColumns: (columns: Columns) => void
  rearranging: boolean
  dragging: boolean
  metrics: () => Metrics
  onSize: (size: Size) => void
  onColor: (color: Color | null) => void
  onRearranging: (on: boolean) => void
  onPin: () => void
  onEdit: () => void
  onWorkspace: () => void
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
      const cols = Math.max(
        1,
        Math.min(
          columns,
          Math.round(start.cols + (e.clientX - startX) / columnWidth)
        )
      ) as Size["cols"]
      const rows = Math.max(
        1,
        Math.min(4, Math.round(start.rows + (e.clientY - startY) / rowHeight))
      ) as Size["rows"]
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

  // Rearrange mode makes the whole cell draggable. The grip makes one cell
  // draggable for as long as it is held, so a block can be moved without
  // finding a menu first (Brendan, 2026-09-10) — `draggable` has to be true
  // before the drag starts, which is what pressing the grip sets. A press
  // held anywhere on the card does the same after a beat (Brendan,
  // 2026-09-13: the grip is small; a click opens, a hold lifts), and the
  // release that ends a hold is not a click.
  const [byHandle, setByHandle] = React.useState(false)
  const held = React.useRef(false)
  const holdTimer = React.useRef<number | null>(null)
  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  React.useEffect(() => clearHold, [])
  const isChrome = (target: EventTarget | null) =>
    !!(target as HTMLElement | null)?.closest(
      "button, a, input, textarea, select, [role=menuitem], [role=menu], [data-slot=card-action]"
    )
  const holdProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || rearranging || isChrome(e.target)) return
      held.current = false
      clearHold()
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null
        held.current = true
        setByHandle(true)
      }, HOLD_MS)
    },
    onPointerUp: () => {
      clearHold()
      // A hold that never moved: let go of the lift; the click that follows is swallowed.
      if (held.current) setByHandle(false)
    },
    // A native drag begins with pointercancel: the lift stays until dragend clears it.
    onPointerCancel: clearHold,
    onPointerLeave: () => {
      // Leaving the card before the beat is over is a scroll or a miss, not a hold.
      if (holdTimer.current !== null) clearHold()
    },
  }
  const handleProps = {
    onPointerDown: () => {
      held.current = true
      setByHandle(true)
    },
    onPointerUp: () => setByHandle(false),
  }

  // The card itself is the button (Brendan, 2026-09-07): a click anywhere
  // that is not a button, a menu or the corner opens the record.
  const open = item.onOpen
  const openable = !!open && !rearranging
  const onCardClick = (e: React.MouseEvent) => {
    const wasHeld = held.current
    held.current = false
    if (wasHeld || !openable || isChrome(e.target)) return
    open?.()
  }

  const cell: GridCell = {
    docs: item.docs,
    size,
    base: defaultFor(item, columns),
    color,
    columns,
    rearranging,
    pinned,
    onPin,
    onSize,
    onColor,
    onColumns,
    onRearranging,
    onResetLayout,
    onDelete,
  }

  const dragProps = {
    draggable: rearranging || byHandle,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", item.key)
      onDragStart()
    },
    onDragEnter,
    onDragOver: (e: React.DragEvent) => (rearranging || byHandle) && e.preventDefault(),
    onDrop: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: () => {
      setByHandle(false)
      held.current = false
      onDragEnd()
    },
  }
  const corner = (
    <button
      type="button"
      aria-label="Drag to resize"
      title="Drag to resize"
      onPointerDown={onHandle}
      className="absolute right-1 bottom-1 z-10 size-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path
          d="M14 2 2 14M14 8l-6 6M14 14h0"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </button>
  )

  if (item.bare) {
    return (
      <GridCellContext.Provider value={cell}>
        <div
          data-component={item.key}
          data-group={item.group}
          {...dragProps}
          {...holdProps}
          onClick={onCardClick}
          style={
            paint
              ? ({
                  "--primary": paint.primary,
                  "--primary-foreground": paint.foreground,
                } as React.CSSProperties)
              : undefined
          }
          className={cn(
            "group/cell relative h-full min-h-0 rounded-[min(var(--radius-4xl),24px)] transition-shadow hover:ring-1 hover:ring-foreground/50 **:data-[slot=card]:h-full",
            COLS[size.cols],
            ROWS[size.rows],
            (rearranging || byHandle) && "cursor-grab select-none active:cursor-grabbing",
            byHandle && "ring-2 ring-foreground/30",
            dragging && "opacity-40",
            resizing && "ring-2 ring-ring/40"
          )}
        >
          <div className="h-full min-h-0 overflow-hidden rounded-[min(var(--radius-4xl),24px)]">
            {item.media}
          </div>
          <span
            {...handleProps}
            aria-hidden
            className={cn(
              "absolute top-2 left-2 z-10 flex size-7 cursor-grab items-center justify-center rounded-full bg-background/80 text-muted-foreground/70 shadow-sm transition-opacity active:cursor-grabbing",
              // Always there while rearranging; otherwise it waits for the
              // pointer, so a catalogue of blocks is not a field of handles.
              rearranging
                ? "opacity-100"
                : "opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
            )}
            title="Drag to move"
          >
            <GripVerticalIcon className="size-4" />
          </span>
          {item.ownMenu === false && (
            <div className="absolute top-3 right-3 z-10">
              <CardActions
                item={item}
                size={size}
                color={color}
                columns={columns}
                rearranging={rearranging}
                pinned={pinned}
                inWorkspace={inWorkspace}
                onSize={onSize}
                onColor={onColor}
                onColumns={onColumns}
                onRearranging={onRearranging}
                onPin={onPin}
                onEdit={onEdit}
                onWorkspace={onWorkspace}
                onResetLayout={onResetLayout}
                onDelete={onDelete}
              />
            </div>
          )}
          {corner}
        </div>
      </GridCellContext.Provider>
    )
  }

  const title = details.label || item.title
  const meta = [details.note, item.meta].filter(Boolean).join(" · ")

  return (
    <Card
      data-component={item.key}
      data-group={item.group}
      {...dragProps}
      {...holdProps}
      onClick={onCardClick}
      style={
        paint
          ? ({
              "--primary": paint.primary,
              "--primary-foreground": paint.foreground,
            } as React.CSSProperties)
          : undefined
      }
      className={cn(
        // A 1px border on hover (Brendan, 2026-09-07); transparent otherwise so nothing shifts.
        "group/cell relative h-full min-h-0 overflow-hidden border border-transparent transition-colors hover:border-foreground/50",
        // Half the card, half the padding (Brendan, 2026-09-07): the card's own spacing token, halved, so its padding and gaps follow.
        compact && "[--card-spacing:--spacing(2.5)]",
        COLS[size.cols],
        ROWS[size.rows],
        openable && "cursor-pointer",
        (rearranging || byHandle) && "cursor-grab select-none active:cursor-grabbing",
        byHandle && "border-foreground/50 ring-2 ring-foreground/20",
        dragging && "opacity-40",
        resizing && "ring-2 ring-ring/40"
      )}
    >
      <CardHeader className="items-center">
        {/* The + sits in line with the ⋮, at the left, where the badge used to. */}
        <div className="-ml-1.5 flex h-7 items-center">
          {item.workspace && (
            <WorkspaceButton inWorkspace={inWorkspace} onClick={onWorkspace} />
          )}
        </div>
        <CardTitle className="sr-only">{title}</CardTitle>
        <CardAction className="flex items-center gap-1 self-center">
          <span
            {...handleProps}
            aria-hidden
            className={cn(
              "flex size-7 cursor-grab items-center justify-center text-muted-foreground/70 transition-opacity active:cursor-grabbing",
              rearranging ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100"
            )}
            title="Drag to move"
          >
            <GripVerticalIcon className="size-4" />
          </span>
          <CardActions
            item={item}
            size={size}
            color={color}
            columns={columns}
            rearranging={rearranging}
            pinned={pinned}
            inWorkspace={inWorkspace}
            onSize={onSize}
            onColor={onColor}
            onColumns={onColumns}
            onRearranging={onRearranging}
            onPin={onPin}
            onEdit={onEdit}
            onWorkspace={onWorkspace}
            onResetLayout={onResetLayout}
            onDelete={onDelete}
          />
        </CardAction>
      </CardHeader>
      <CardContent
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center text-center",
          compact ? "gap-2" : "gap-4",
          item.fill && "justify-start"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-muted/60",
            compact ? "p-2" : "p-4",
            item.fill &&
              "min-h-0 w-full flex-1 overflow-hidden p-0 text-left [&>*]:h-full [&>*]:w-full"
          )}
          style={
            compact && !item.fill
              ? ({ zoom: 0.6 } as React.CSSProperties)
              : undefined
          }
        >
          {item.media}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div
            className={cn(
              "cn-font-heading font-medium text-balance",
              compact ? "text-sm" : "text-lg"
            )}
          >
            {title}
          </div>
          {!compact && item.description && (
            <CardDescription className="text-pretty">
              {item.description}
            </CardDescription>
          )}
          {!compact && meta && (
            <p className="text-xs text-muted-foreground">{meta}</p>
          )}
        </div>
      </CardContent>
      {/* The badge: bottom left, opposite the corner (Brendan, 2026-09-13). */}
      {item.badge && (
        <div className="absolute bottom-2.5 left-4 z-10 flex h-7 items-center text-muted-foreground">
          {item.badge}
        </div>
      )}
      {/* The corner: drag it right to widen the card, down to make it taller, back to shrink it. */}
      <button
        type="button"
        aria-label="Drag to resize"
        title="Drag to resize"
        onPointerDown={onHandle}
        className="absolute right-1 bottom-1 size-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path
            d="M14 2 2 14M14 8l-6 6M14 14h0"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      </button>
    </Card>
  )
}

export function WorkspaceGrid({
  storageKey,
  items,
  loading,
  keepOrder,
  slots,
  children,
  className,
}: {
  storageKey: string
  items: GridItem[]
  /** A trailing row of skeletons while more arrive. */ loading?: boolean
  /** The items' own order stands (the footer's Filter chip is sorting them); the reader's saved order waits. */ keepOrder?: boolean
  /** Cells of the grid's own after the cards: /workspace's empty slots (Brendan, 2026-09-13). */ slots?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const [saved, setLayout] = useLocal<Partial<Layout>>(storageKey, {})
  const layout = React.useMemo(() => readLayout(saved), [saved])
  const grid = React.useRef<HTMLDivElement>(null)
  const [rearranging, setRearranging] = React.useState(false)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const workspace = useWorkspacePins()

  const cards = React.useMemo(
    () =>
      keepOrder
        ? arrange({ ...layout, order: [] }, items)
        : arrange(layout, items),
    [layout, items, keepOrder]
  )
  const columns: Columns = layout.columns === 8 ? 8 : 4

  // Read at the moment of a drag, so a window that changed width since mount still measures true.
  const metrics = React.useCallback((): Metrics => {
    const el = grid.current
    if (!el) return { columns: 4, columnWidth: 0, rowHeight: 0 }
    const style = getComputedStyle(el)
    const columns =
      style.gridTemplateColumns.split(" ").filter(Boolean).length || 1
    const gap = parseFloat(style.rowGap) || 0
    return {
      columns,
      columnWidth: el.clientWidth / columns,
      rowHeight: (parseFloat(style.gridAutoRows) || 352) + gap,
    }
  }, [])

  const patch = (change: (current: Layout) => Partial<Layout>) =>
    setLayout((raw) => ({ ...readLayout(raw), ...change(readLayout(raw)) }))
  const setSize = (key: string, size: Size) =>
    patch((c) => ({ sizes: { ...c.sizes, [key]: size } }))
  const setColumns = (columns: Columns) => patch(() => ({ columns }))
  const setColor = (key: string, color: Color | null) =>
    patch((c) => {
      const colors = { ...c.colors }
      if (color) colors[key] = color
      else delete colors[key]
      return { colors }
    })
  const togglePin = (key: string) =>
    patch((c) => ({
      pinned: c.pinned.includes(key)
        ? c.pinned.filter((k) => k !== key)
        : [key, ...c.pinned],
    }))
  const setDetails = (key: string, details: CardDetails) =>
    patch((c) => {
      const next = { ...c.details }
      if (details.label || details.note) next[key] = details
      else delete next[key]
      return { details: next }
    })
  const remove = (key: string) =>
    patch((c) => ({ hidden: [...c.hidden.filter((k) => k !== key), key] }))
  const resetLayout = () => {
    patch(() => ({
      order: [],
      sizes: {},
      hidden: [],
      pinned: [],
      colors: {},
      columns: 4,
    }))
    setRearranging(false)
  }
  const moveBefore = (key: string, before: string) =>
    patch((c) => ({ order: reorder(arrange(c, items), key, before) }))
  const toggleWorkspace = (pin: WorkspacePin) =>
    workspace.has(pin) ? workspace.remove(pinKey(pin)) : workspace.add(pin)

  const editingItem = editing ? items.find((i) => i.key === editing) : undefined

  return (
    // One white field under every grid (Brendan, 2026-09-13): the cards draw
    // their own edge — a shadow, a ring, a border on hover.
    <div
      className={cn("min-h-full bg-background p-6", className)}
    >
      {rearranging && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-foreground/30 px-4 py-2 text-sm text-muted-foreground">
          Drag a card onto another to move it there.
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setRearranging(false)}
          >
            Done
          </Button>
        </div>
      )}
      {children}
      <div
        ref={grid}
        data-slot="workspace-grid"
        data-columns={columns}
        className={cn(
          "grid grid-cols-1 gap-6",
          columns === 8
            ? "auto-rows-[11rem] md:grid-cols-4 xl:grid-cols-8"
            : "auto-rows-[22rem] md:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {cards.map((item) => (
          <GridCard
            key={item.key}
            item={item}
            size={sizeFor(item, columns, layout.sizes[item.key])}
            color={layout.colors[item.key]}
            columns={columns}
            details={layout.details[item.key] ?? {}}
            pinned={layout.pinned.includes(item.key)}
            inWorkspace={!!item.workspace && workspace.has(item.workspace)}
            onColumns={setColumns}
            rearranging={rearranging}
            dragging={dragging === item.key}
            metrics={metrics}
            onSize={(size) => setSize(item.key, size)}
            onColor={(color) => setColor(item.key, color)}
            onRearranging={setRearranging}
            onPin={() => togglePin(item.key)}
            onEdit={() => setEditing(item.key)}
            onWorkspace={() => item.workspace && toggleWorkspace(item.workspace)}
            onResetLayout={resetLayout}
            onDelete={() => remove(item.key)}
            onDragStart={() => setDragging(item.key)}
            onDragEnter={() =>
              dragging &&
              dragging !== item.key &&
              moveBefore(dragging, item.key)
            }
            onDragEnd={() => setDragging(null)}
          />
        ))}
        {slots}
        {loading &&
          Array.from({ length: 4 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-full animate-pulse rounded-xl bg-muted/60"
            />
          ))}
      </div>
      {!cards.length && !loading && !slots && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nothing here.
        </p>
      )}
      <EditDetailsDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        id={editing}
        fallbackLabel={editingItem?.title ?? editing ?? ""}
        value={(editing ? layout.details[editing] : undefined) ?? {}}
        onSave={(next) => editing && setDetails(editing, next)}
      />
    </div>
  )
}
