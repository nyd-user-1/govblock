"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { BellIcon, BookmarkIcon, EllipsisVerticalIcon, FolderPlusIcon, PauseIcon, PlayIcon, Trash2Icon } from "lucide-react"

import { fmtBill } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import type { LiveEvent } from "@/lib/policy/live-stream"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { BackToTop } from "@/components/back-to-top"
import { FlagLoader } from "@/components/flag-loader"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { cn } from "@govblock/ui/lib/utils"

// /live's stream (Brendan, 2026-09-15), built on the Admin console's Live Stream
// (Widget1): the time of day where the source keeps one, the bill's prime
// sponsor with a party dot on the portrait, and the House seal for a floor line
// that names no bill.
//
// It moves like a ticker: the whole list glides down at SPEED, and the next
// BUFFER rows are already drawn above the box's top edge, so a row slides in
// from outside rather than appearing in the first slot. When a row's height has
// been travelled, the next event is put on top and the glide goes back a row in
// the same frame, so nothing jumps. A pointer over the stream, or a row's menu
// open, holds it still. On hover a row's time gives way to its menu, as a
// conversation's date does in Claude's chat list.
//
// No card of its own (Brendan, 2026-09-20): the stream was a bordered table
// inside the workspace's pane, one container too many. The rows fill the pane
// now, and the stream's light, its name and its pause and clear are handed to
// whoever frames it (`shell`), which puts them in the pane's own header.

/** 32px a second, the glide Brendan approved on 2026-09-15. */
const SPEED = 32 / 1000
/** 52px, the room Claude's chat list gives a row (Brendan, 2026-09-15). */
const ROW = 52
const BUFFER = 3
const BASELINE = 60
const KEEP = 80

export const eventKey = (e: LiveEvent) => `${e.kind}|${e.state}|${e.bill_number ?? ""}|${e.date}|${e.seq ?? ""}|${e.text}`

const CHAMBERS: Record<string, string> = { Senate: "SEN", House: "HSE", Assembly: "ASM", Council: "CNL", Legislature: "LEG", J: "JNT" }
function chamberOf(e: LiveEvent) {
  if (e.chamber) return CHAMBERS[e.chamber] ?? e.chamber.slice(0, 3).toUpperCase()
  const n = (e.bill_number ?? "").toUpperCase()
  return n.startsWith("S") ? "SEN" : n.startsWith("H") ? "HSE" : n.startsWith("A") ? "ASM" : ""
}

/** "17:35:11" → "5:35:11 PM"; "15:46" → "3:46 PM". */
function clock(at: string | null) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(at ?? "")
  if (!m) return ""
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]}${m[3] ? `:${m[3]}` : ""} ${h < 12 ? "AM" : "PM"}`
}

const ACTIONS = [
  { label: "Set alert", icon: BellIcon },
  { label: "Bookmark", icon: BookmarkIcon },
  { label: "Save to folder", icon: FolderPlusIcon },
]

type Line = LiveEvent & { id: string }

/** The stream in three parts, for the frame that draws it: the light and the name, the pause and clear, and the rows. */
export type LiveStreamParts = { title: React.ReactNode; tools: React.ReactNode; body: React.ReactNode }

export function LiveStream({ events, jurisdiction, shell }: { events: LiveEvent[] | undefined; jurisdiction: string | null; shell: (parts: LiveStreamParts) => React.ReactNode }) {
  const [lines, setLines] = React.useState<Line[]>([])
  const [paused, setPaused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const [menu, setMenu] = React.useState<string | null>(null)
  const [scrolled, setScrolled] = React.useState(false)
  const seen = React.useRef<Set<string> | null>(null)
  const incoming = React.useRef<LiveEvent[]>([])
  const cursor = React.useRef(0)
  const played = React.useRef(0)
  const offset = React.useRef(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const matches = React.useCallback((e: LiveEvent) => !jurisdiction || e.state === jurisdiction, [jurisdiction])

  // Oldest first: the order the events happened.
  const loop = React.useMemo(() => (events ?? []).filter(matches).reverse(), [events, matches])

  // A poll's unseen events queue to play next. The first answer is the loop itself.
  React.useEffect(() => {
    if (!events) return
    const keys = events.map(eventKey)
    if (!seen.current) {
      seen.current = new Set(keys)
      return
    }
    const fresh = events.filter((e, i) => !seen.current!.has(keys[i])).reverse()
    for (const k of keys) seen.current.add(k)
    if (fresh.length) incoming.current.push(...fresh)
  }, [events])

  const line = (e: LiveEvent): Line => ({ ...e, id: `${eventKey(e)}#${played.current++}` })
  const place = () => {
    if (listRef.current) listRef.current.style.transform = `translate3d(0, ${offset.current - BUFFER * ROW}px, 0)`
  }

  // A full container from the first frame (Brendan, 2026-09-15): the loop's
  // opening BASELINE events, newest on top, with the next BUFFER waiting above
  // the edge. A jurisdiction picked in the rail starts its own.
  React.useEffect(() => {
    if (!loop.length) return
    const n = Math.min(BASELINE + BUFFER, loop.length)
    cursor.current = n % loop.length
    offset.current = 0
    setLines(loop.slice(0, n).reverse().map(line))
    place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.length > 0, jurisdiction])

  // Reading down the list holds it too (Brendan, 2026-09-15): an event put on
  // top while the reader is below would push what they are reading down.
  const viewport = () => scrollRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? null
  React.useEffect(() => {
    const el = viewport()
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 4)
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // The glide, a frame at a time.
  const still = paused || hovered || menu !== null || scrolled
  React.useEffect(() => {
    if (still || !loop.length) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      offset.current += Math.min(now - last, 100) * SPEED
      last = now
      if (offset.current >= ROW) {
        offset.current -= ROW
        while (incoming.current.length && !matches(incoming.current[0])) incoming.current.shift()
        const next = incoming.current.shift()
        const e = next ?? loop[cursor.current++ % loop.length]
        flushSync(() => setLines((prev) => [line(e), ...prev].slice(0, KEEP + BUFFER)))
      }
      place()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, loop, matches])

  const title = (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {/* The stream's own light, where the terminal glyph was (Brendan, 2026-09-15). */}
      <span className={cn("size-1.25 rounded-full", still ? "bg-foreground/15" : "animate-pulse bg-green-500")} />
      <CardAnchor>Live Stream</CardAnchor>
    </div>
  )
  const tools = (
    <CardTools className="gap-0">
      <Button variant="ghost" size="icon-sm" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume" : "Pause"}>
        {paused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
      </Button>
      <Button aria-label="Clear" variant="destructive" className="bg-transparent" size="icon-sm" onClick={() => setLines([])}>
        <Trash2Icon className="size-4" />
      </Button>
    </CardTools>
  )
  const body = (
      <div className="h-full min-h-0 w-full px-1.5">
        {lines.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-4 text-muted-foreground">
            <FlagLoader width={96} />
            <span>{events && !loop.length ? "No events in the last seven days on file." : "Waiting for the first event..."}</span>
          </div>
        )}
        {/* Radix lays the viewport's content out as a table, as wide as its widest row, so a long line ran off the pane's edge and was never cut (Brendan, 2026-09-20). As a block it is the pane's width, and a row's text truncates inside it. */}
        <ScrollArea ref={scrollRef} className="flex h-full flex-col [&_[data-slot=scroll-area-viewport]>div]:block!" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div ref={listRef} style={{ transform: `translate3d(0, ${-BUFFER * ROW}px, 0)`, willChange: "transform" }}>
            {lines.map((line) => {
              const failed = line.kind === "vote" && /fail|reject|not agreed|veto/i.test(line.text)
              const bill = line.bill_label ?? (line.bill_number ? fmtBill(line.bill_number, line.state) : null)
              const open = menu === line.id
              const row = (
                <>
                  <span className="flex w-24 shrink-0 items-center whitespace-nowrap text-muted-foreground tabular-nums">
                    <span className={cn("group-hover:hidden", open && "hidden")}>{line.date}</span>
                    <DropdownMenu onOpenChange={(o) => setMenu(o ? line.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Actions"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          className={cn(
                            "hidden size-6 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors group-hover:inline-flex hover:bg-foreground/10 data-[state=open]:bg-foreground/10",
                            open && "inline-flex"
                          )}
                        >
                          <EllipsisVerticalIcon className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={4} className="w-max min-w-44 rounded-lg">
                        {ACTIONS.map((a) => (
                          <DropdownMenuItem key={a.label} className="whitespace-nowrap">
                            <a.icon />
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                  <span className="w-20 shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">{clock(line.at)}</span>
                  <span className="flex w-12 shrink-0 items-center gap-1.5 text-xs font-medium">
                    <FlagChip state={line.state} width={18} />
                    {line.state}
                  </span>
                  <span className={cn("w-10 shrink-0 text-xs font-medium", line.kind === "vote" && "text-primary")}>{chamberOf(line)}</span>
                  <span className="flex w-44 shrink-0 items-center gap-2">
                    {line.sponsor ? (
                      <>
                        <span className="relative shrink-0">
                          <MemberPortrait name={line.sponsor} photoUrl={portraitFor({ photo_url: line.sponsor_photo, bioguide_id: line.sponsor_bioguide })} state={line.state} chamber={line.chamber} size={20} />
                          {line.sponsor_party && <PartyDot party={line.sponsor_party} className="absolute -right-0.5 -bottom-0.5 size-2 ring-2 ring-background" />}
                        </span>
                        <span className="truncate">{line.sponsor}</span>
                      </>
                    ) : (
                      // A floor line with no bill (the House convening, the prayer, a recess) is the chamber's own.
                      !bill &&
                      line.chamber && (
                        <>
                          <ChamberSeal state={line.state} chamber={line.chamber} size={20} />
                          <span className="truncate">Floor Proceedings</span>
                        </>
                      )
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {bill && <span className="text-foreground">{bill}</span>}
                    {bill && " · "}
                    {line.text}
                    {/* What the bill does, on every row (Brendan, 2026-09-20), cut where the row ends; a floor line that already quotes the title says it once. */}
                    {line.title && !line.text.includes(line.title) && ` · ${line.title}`}
                  </span>
                  {line.yea != null && (
                    <span className={cn("min-w-12 shrink-0 text-end text-xs whitespace-nowrap text-muted-foreground tabular-nums", failed && "text-destructive")}>
                      {line.yea}–{line.nay ?? 0}
                    </span>
                  )}
                </>
              )
              // A 1px rule over and under every row (Brendan, 2026-09-20). Each row is a pixel taller than ROW and pulled
              // up a pixel, so its top rule lies on the bottom rule of the row above — one line between rows, not two —
              // and the rows still step ROW apart, exactly, which the glide counts on. Square, since a rule that ends in
              // a rounded corner curls.
              const className = cn("group -mt-px flex h-[53px] items-center gap-3 border-y border-border px-2.5 text-sm no-underline hover:bg-accent", open && "bg-accent")
              return line.bill_id ? (
                <a key={line.id} href={`/bills/${line.bill_id}`} title={line.title ?? undefined} className={className}>
                  {row}
                </a>
              ) : (
                <div key={line.id} title={line.title ?? undefined} className={className}>
                  {row}
                </div>
              )
            })}
          </div>
          <BackToTop scroller={viewport} />
        </ScrollArea>
      </div>
  )
  return shell({ title, tools, body })
}
