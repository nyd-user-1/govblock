"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { AccountFooter } from "@/components/admin/account-footer"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { imageUrl, POST_TARGETS, type Post } from "@/lib/linkedin/types"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { SidebarContent, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

import { PostDialog, type Editing } from "./post-dialog"
import { STATUS, STATUS_FILTERS } from "./status"
import { usePosts, type Posts } from "./use-posts"

// /content-calendar (/posts until 2026-09-18; Brendan, 2026-09-17): /workspace/calendar's shell and month, over
// the admin's LinkedIn posts — the rail with the month and the statuses, the
// month with a Post button where Today was and no padding round it, and the
// same Card and Table looks. A click on a day starts a post there, a click on
// a post opens it, and a post not yet sent can be dragged to another day.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DEFAULT_HOUR = 9
const dayKey = (d: Date) => format(d, "yyyy-MM-dd")
const movable = (post: Post) => post.status === "draft" || post.status === "scheduled" || post.status === "failed"
const filterOf = (post: Post) => (post.status === "publishing" ? "scheduled" : post.status)
const titleOf = (post: Post) => post.title || post.body.trim().split("\n")[0]?.slice(0, 80) || "New Post"
const targetLabel = (post: Post) => POST_TARGETS.find((t) => t.value === post.target)?.label ?? post.target
const whenOf = (post: Post) => format(new Date(post.publishAt), "MMM d · h:mm a")

function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

// A new post on a day starts at nine, or at the next hour when the day is today.
function startOn(day: Date) {
  const now = new Date()
  const hour = dayKey(day) === dayKey(now) ? Math.min(23, Math.max(DEFAULT_HOUR, now.getHours() + 1)) : DEFAULT_HOUR
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)
}

type Look = "month" | "cards" | "table"

function LookToggle({ current, set }: { current: Look; set: (next: Look) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {(["month", "cards", "table"] as Look[]).map((value) => (
        <button key={value} type="button" data-active={current === value} aria-pressed={current === value} onClick={() => set(value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs">
          {value === "month" ? "Month" : value === "table" ? "Table" : "Card"}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The rail

function MiniMonth({ cursor, setCursor, byDate }: { cursor: Date; setCursor: (d: Date) => void; byDate: Map<string, Post[]> }) {
  const [mini, setMini] = React.useState(cursor)
  React.useEffect(() => setMini(cursor), [cursor])
  const today = dayKey(new Date())
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{format(mini, "MMMM yyyy")}</span>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() - 1, 1))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() + 1, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px]">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="py-1 text-muted-foreground">
            {d}
          </span>
        ))}
        {monthGrid(mini).map((d) => {
          const key = dayKey(d)
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCursor(new Date(d.getFullYear(), d.getMonth(), 1))}
              className={cn("relative rounded-md py-1 hover:bg-muted", d.getMonth() !== mini.getMonth() && "text-muted-foreground/50", key === today && "bg-primary text-primary-foreground hover:bg-primary")}
            >
              {d.getDate()}
              {byDate.has(key) && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Connection({ data }: { data: Posts }) {
  const { account, notice, setNotice } = data
  if (!account) return null
  return (
    <div className="flex flex-col gap-2">
      {notice && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <p className="min-w-0 flex-1 break-words">{notice}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <XIcon className="size-4" />
          </button>
        </div>
      )}
      {account.connected ? (
        <Link href={dashboardHref("settings/profile")} className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-muted">
          {account.picture && <img src={account.picture} alt="" className="size-6 rounded-full" />}
          <span className="min-w-0 truncate font-medium">{account.name}</span>
        </Link>
      ) : (
        <Button size="sm" className="w-full" disabled={!account.configured} render={<a href="/api/linkedin/connect" />}>
          Connect LinkedIn
        </Button>
      )}
    </div>
  )
}

function PostsRail({ data, cursor, setCursor, byDate, on, setOn }: { data: Posts; cursor: Date; setCursor: (d: Date) => void; byDate: Map<string, Post[]>; on: Record<string, boolean>; setOn: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const router = useRouter()
  const present = new Set((data.posts ?? []).map(filterOf))
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <Link href="/content-calendar" className="text-xl font-semibold">
          Content Calendar
        </Link>
      </SidebarHeader>
      <SidebarContent className="no-scrollbar">
        <div className="flex flex-col gap-4 px-4 py-2">
          <MiniMonth cursor={cursor} setCursor={setCursor} byDate={byDate} />
          <Separator />
          <div className="flex flex-col gap-2">
            {STATUS_FILTERS.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={on[s.key]} onCheckedChange={(v) => setOn((o) => ({ ...o, [s.key]: Boolean(v) }))} />
                <span className={cn("size-2 rounded-full", s.dot)} />
                <span className="grow">{s.label}</span>
                {!present.has(s.key) && <span className="text-[10px] text-muted-foreground">none</span>}
              </label>
            ))}
          </div>
          <Separator />
          <Connection data={data} />
        </div>
      </SidebarContent>
      <AccountFooter go={(page) => router.push(dashboardHref(page))} />
    </>
  )
}

// ---------------------------------------------------------------------------
// The month

function Month({ cursor, shift, byDate, count, onNew, onOpen, onMove }: { cursor: Date; shift: (n: number) => void; byDate: Map<string, Post[]>; count: number; onNew: (at: Date) => void; onOpen: (post: Post) => void; onMove: (post: Post, day: Date) => void }) {
  const [dragging, setDragging] = React.useState<Post | null>(null)
  const [over, setOver] = React.useState<string | null>(null)
  const today = dayKey(new Date())
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <p className="text-lg font-medium">{format(cursor, "MMMM yyyy")}</p>
        <div className="ms-2 flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNew(startOn(new Date()))}>
          Post
        </Button>
        <Badge variant="secondary" className="ms-auto">
          {count} {count === 1 ? "post" : "posts"}
        </Badge>
      </div>
      <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
        {DAYS.map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grow auto-rows-fr grid-cols-7">
        {monthGrid(cursor).map((d, i) => {
          const key = dayKey(d)
          const list = byDate.get(key) ?? []
          return (
            <div
              key={key}
              onClick={(e) => e.target === e.currentTarget && onNew(startOn(d))}
              onDragOver={(e) => {
                if (!dragging) return
                e.preventDefault()
                setOver(key)
              }}
              onDragLeave={() => setOver((current) => (current === key ? null : current))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging && key !== dayKey(new Date(dragging.publishAt))) onMove(dragging, d)
                setDragging(null)
                setOver(null)
              }}
              className={cn(
                "flex min-h-24 cursor-pointer flex-col gap-1 border-r border-b p-1.5 hover:bg-muted/20",
                i % 7 === 6 && "border-r-0",
                d.getMonth() !== cursor.getMonth() && "bg-muted/30 text-muted-foreground",
                over === key && "bg-primary/5 ring-2 ring-primary/40 ring-inset"
              )}
            >
              <span className={cn("pointer-events-none self-end text-xs", key === today && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground")}>{d.getDate()}</span>
              {list.slice(0, 3).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  draggable={movable(post)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move"
                    setDragging(post)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  onClick={() => onOpen(post)}
                  title={post.body}
                  className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px]", STATUS[post.status].chip, movable(post) && "cursor-grab active:cursor-grabbing")}
                >
                  <span className="shrink-0 tabular-nums opacity-70">{format(new Date(post.publishAt), "h:mm")}</span>
                  <span className="truncate font-medium">{titleOf(post)}</span>
                </button>
              ))}
              {list.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The cards and the table

function LinkedInMark({ post }: { post: Post }) {
  if (post.images[0])
    return (
      <span className="relative block size-24 overflow-hidden rounded-2xl bg-muted">
        <img src={imageUrl(post.images[0])} alt="" className="size-full object-cover" />
        {post.images.length > 1 && <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 px-1.5 text-[10px] font-medium">{post.images.length}</span>}
        <span className={cn("absolute right-1.5 bottom-1.5 size-3 rounded-full ring-2 ring-white", STATUS[post.status].dot)} />
      </span>
    )
  return (
    <span className="relative flex size-24 items-center justify-center rounded-2xl bg-[#0a66c2] text-4xl font-bold text-white">
      in
      <span className={cn("absolute right-1.5 bottom-1.5 size-3 rounded-full ring-2 ring-white", STATUS[post.status].dot)} />
    </span>
  )
}

function Listing({ look, posts, onOpen }: { look: "cards" | "table"; posts: Post[]; onOpen: (post: Post) => void }) {
  const items = React.useMemo<GridItem[]>(
    () =>
      posts.map((post) => ({
        key: post.id,
        group: STATUS[post.status].label,
        media: <LinkedInMark post={post} />,
        title: titleOf(post),
        description: post.title ? post.body.slice(0, 90) : null,
        meta: `${whenOf(post)} · ${targetLabel(post)} · ${STATUS[post.status].label}`,
        onOpen: () => onOpen(post),
        menu: (
          <>
            <DropdownMenuItem onClick={() => onOpen(post)}>Open</DropdownMenuItem>
            {post.urls.map((url) => (
              <DropdownMenuItem key={url} onClick={() => window.open(url, "_blank", "noopener")}>
                View on LinkedIn
              </DropdownMenuItem>
            ))}
          </>
        ),
      })),
    [posts, onOpen]
  )

  if (!posts.length) return <p className="py-10 text-center text-sm text-muted-foreground">No posts yet.</p>

  if (look === "cards") return <WorkspaceGrid storageKey="govblock:posts:layout" items={items} />

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Post</TableHead>
            <TableHead>Posts to</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow key={post.id} className="cursor-pointer" onClick={() => onOpen(post)}>
              <TableCell className="max-w-0">
                <span className="block truncate font-medium">{titleOf(post)}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{targetLabel(post)}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{whenOf(post)}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className={cn("size-2 rounded-full", STATUS[post.status].dot)} />
                  {STATUS[post.status].label}
                </span>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {post.urls[0] && (
                  <a href={post.urls[0]} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    View
                  </a>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function PostsWorkspace() {
  const data = usePosts()
  const { look: lookParam } = useUrlParams(["look"] as const)
  const look: Look = lookParam === "table" ? "table" : lookParam === "cards" ? "cards" : "month"
  const setLook = (next: Look) => writeUrlParams({ look: next === "month" ? null : next }, { history: "push" })
  const [cursor, setCursor] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [on, setOn] = React.useState<Record<string, boolean>>(() => Object.fromEntries(STATUS_FILTERS.map((s) => [s.key, true])))
  const [editing, setEditing] = React.useState<Editing>(null)

  const shown = React.useMemo(() => (data.posts ?? []).filter((post) => on[filterOf(post)] ?? true).sort((a, b) => a.publishAt.localeCompare(b.publishAt)), [data.posts, on])
  const byDate = React.useMemo(() => {
    const map = new Map<string, Post[]>()
    for (const post of shown) {
      const key = dayKey(new Date(post.publishAt))
      map.set(key, [...(map.get(key) ?? []), post])
    }
    return map
  }, [shown])
  const inMonth = shown.filter((post) => {
    const at = new Date(post.publishAt)
    return at.getFullYear() === cursor.getFullYear() && at.getMonth() === cursor.getMonth()
  }).length

  const open = React.useCallback((post: Post) => setEditing({ post }), [])
  // A drag keeps the post's time of day and takes the new day.
  const move = (post: Post, day: Date) => {
    const at = new Date(post.publishAt)
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), at.getHours(), at.getMinutes())
    void data.save(post.id, { publishAt: next.toISOString() })
  }

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <ShellFooterProvider footer={<WorkspaceFooter mode="posts" />}>
            <BlockShell
              defaultOpen
              rail={<PostsRail data={data} cursor={cursor} setCursor={setCursor} byDate={byDate} on={on} setOn={setOn} />}
              sidebarWidth="250px"
              separatorClassName="mx-1"
              title={<PathBar crumbs={[APP_CRUMB, { label: "Posts" }]} folder onGo={() => {}} />}
              actions={<LookToggle current={look} set={setLook} />}
              contentClassName="overflow-y-auto bg-muted dark:bg-background"
            >
              {look === "month" ? (
                <Month
                  cursor={cursor}
                  shift={(n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))}
                  byDate={byDate}
                  count={inMonth}
                  onNew={(at) => setEditing({ at })}
                  onOpen={open}
                  onMove={move}
                />
              ) : (
                <div className="p-4">
                  <Listing look={look} posts={shown} onOpen={open} />
                </div>
              )}
            </BlockShell>
            </ShellFooterProvider>
          </div>
        </div>
      </div>
      <PostDialog editing={editing} onClose={() => setEditing(null)} data={data} />
    </div>
  )
}
