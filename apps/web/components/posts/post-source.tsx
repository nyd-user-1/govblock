"use client"

import * as React from "react"
import { addMinutes } from "date-fns"
import { ExternalLinkIcon, SendIcon } from "lucide-react"

import { toLocalISO } from "@/lib/calendar/dates"
import type { Calendar, CalendarEvent } from "@/lib/calendar/types"
import type { LinkedInAccount, Post, PostStatus } from "@/lib/linkedin/types"
import { Button } from "@govblock/ui/components/nova/button"

import type { EventSource } from "@/components/calendar/calendar-provider"

// /posts' events: the admin's LinkedIn posts, from /api/linkedin. A post is a
// point in time; it draws as half an hour so it has something to grab. The
// calendars are the statuses, so what is going out and what failed is legible
// from the grid.

const CALENDARS: Calendar[] = [
  { id: "draft", name: "Drafts", color: "amber" },
  { id: "scheduled", name: "Scheduled", color: "blue" },
  { id: "posted", name: "Posted", color: "green" },
  { id: "failed", name: "Failed", color: "red" },
]

const calendarFor = (status: PostStatus) => (status === "publishing" ? "scheduled" : status)
const LENGTH = 30
const REFRESH = 60_000

const snippet = (text: string) => {
  const line = text.trim().split("\n")[0] ?? ""
  return line.length > 60 ? `${line.slice(0, 57)}…` : line
}

function toEvent(post: Post): CalendarEvent {
  const start = new Date(post.publishAt)
  return {
    id: post.id,
    calendarId: calendarFor(post.status),
    title: post.title || snippet(post.body) || "New Post",
    description: post.body,
    start: toLocalISO(start),
    end: toLocalISO(addMinutes(start, LENGTH)),
    post: { title: post.title, target: post.target, status: post.status, error: post.error, urls: post.urls },
  }
}

// A floating local datetime is this browser's wall clock; the server keeps UTC.
const absolute = (local: string) => new Date(local).toISOString()

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`)
  return body as T
}

// ---------------------------------------------------------------------------
// The connection, shared by the rail and the form.

interface LinkedInContextValue {
  account: LinkedInAccount | null
  refreshAccount: () => void
  disconnect: () => Promise<void>
  /** The last thing that went wrong, until it is dismissed. */
  notice: string | null
  setNotice: (notice: string | null) => void
}

const LinkedInContext = React.createContext<LinkedInContextValue | null>(null)

export function useLinkedIn() {
  const value = React.useContext(LinkedInContext)
  if (!value) throw new Error("useLinkedIn must be used within LinkedInProvider")
  return value
}

export function LinkedInProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = React.useState<LinkedInAccount | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const refreshAccount = React.useCallback(() => {
    call<LinkedInAccount>("/api/linkedin/account")
      .then(setAccount)
      .catch((error: Error) => setNotice(error.message))
  }, [])

  React.useEffect(refreshAccount, [refreshAccount])

  // The callback lands back here with how it went.
  React.useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get("linkedin")
    if (!outcome) return
    if (outcome !== "connected") setNotice(`LinkedIn: ${outcome}`)
    url.searchParams.delete("linkedin")
    window.history.replaceState(null, "", url)
  }, [])

  const disconnect = React.useCallback(async () => {
    await call("/api/linkedin/account", { method: "DELETE" })
    refreshAccount()
  }, [refreshAccount])

  const value = React.useMemo(
    () => ({ account, refreshAccount, disconnect, notice, setNotice }),
    [account, refreshAccount, disconnect, notice]
  )

  return <LinkedInContext.Provider value={value}>{children}</LinkedInContext.Provider>
}

// ---------------------------------------------------------------------------

export function usePostSource(): EventSource {
  const { setNotice } = useLinkedIn()
  const [posts, setPosts] = React.useState<Record<string, Post>>({})
  const [loading, setLoading] = React.useState(true)
  const postsRef = React.useRef(posts)
  postsRef.current = posts

  const refresh = React.useCallback(() => {
    call<Post[]>("/api/linkedin/posts")
      .then((rows) => setPosts(Object.fromEntries(rows.map((post) => [post.id, post]))))
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false))
  }, [setNotice])

  // The publisher runs on the server, so a scheduled post turns posted (or
  // failed) without this page doing anything: look again now and then.
  React.useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  const put = React.useCallback((post: Post) => setPosts((current) => ({ ...current, [post.id]: post })), [])

  const fail = React.useCallback(
    (error: Error) => {
      setNotice(error.message)
      refresh()
    },
    [setNotice, refresh]
  )

  // One request at a time per post: the form saves on each pause in typing,
  // and two saves in flight (or a save racing the create) could land in
  // either order.
  const queues = React.useRef(new Map<string, Promise<unknown>>())

  const add = React.useCallback(
    (event: CalendarEvent) => {
      const post: Post = {
        id: event.id,
        title: event.post?.title ?? "",
        body: event.description ?? "",
        target: event.post?.target ?? "profile",
        publishAt: absolute(event.start),
        status: "draft",
        error: null,
        urls: [],
      }
      put(post)
      const created = call<Post>("/api/linkedin/posts", {
        method: "POST",
        body: JSON.stringify({ id: post.id, title: post.title, body: post.body, target: post.target, publishAt: post.publishAt }),
      })
        .then(put)
        .catch(fail)
      queues.current.set(post.id, created)
    },
    [put, fail]
  )

  const patch = React.useCallback(
    (id: string, changes: Partial<Pick<Post, "title" | "body" | "target" | "publishAt">> & { status?: "draft" | "scheduled" }) => {
      const current = postsRef.current[id]
      if (!current) return
      put({ ...current, ...changes })
      const previous = queues.current.get(id) ?? Promise.resolve()
      const next = previous
        .catch(() => {})
        .then(() => call<Post>(`/api/linkedin/posts/${id}`, { method: "PATCH", body: JSON.stringify(changes) }))
        .then(put)
        .catch(fail)
      queues.current.set(id, next)
    },
    [put, fail]
  )

  // What went out is LinkedIn's: the calendar will not move or rewrite it.
  const update = React.useCallback(
    (event: CalendarEvent) => {
      const current = postsRef.current[event.id]
      if (!current || current.status === "posted" || current.status === "publishing") return
      patch(event.id, {
        title: event.post?.title ?? current.title,
        body: event.description ?? "",
        target: event.post?.target ?? current.target,
        publishAt: absolute(event.start),
      })
    },
    [patch]
  )

  const remove = React.useCallback(
    (id: string) => {
      setPosts(({ [id]: _removed, ...rest }) => rest)
      call(`/api/linkedin/posts/${id}`, { method: "DELETE" }).catch(fail)
    },
    [fail]
  )

  const postNow = React.useCallback(
    (id: string) => {
      const current = postsRef.current[id]
      if (current) put({ ...current, status: "publishing" })
      // The last edit is saved before the post is sent.
      const saved = queues.current.get(id) ?? Promise.resolve()
      const sent = saved
        .catch(() => {})
        .then(() => call<{ sent: number; failed: number }>("/api/linkedin/publish", { method: "POST", body: JSON.stringify({ id }) }))
        .catch((error: Error) => setNotice(error.message))
        .finally(refresh)
      queues.current.set(id, sent)
    },
    [put, refresh, setNotice]
  )

  const store = React.useMemo(
    () => Object.fromEntries(Object.values(posts).map((post) => [post.id, toEvent(post)])),
    [posts]
  )

  const details = React.useCallback(
    (event: CalendarEvent) => {
      const post = postsRef.current[event.id]
      return post ? <PostActions post={post} onSchedule={(status) => patch(post.id, { status })} onPostNow={() => postNow(post.id)} /> : null
    },
    [patch, postNow]
  )

  return {
    kind: "post",
    defaultTitle: "New Post",
    calendars: CALENDARS,
    store,
    loading,
    add,
    update,
    remove,
    details,
    state: "US",
    setState: () => {},
  }
}

// ---------------------------------------------------------------------------
// Beneath the form: where the post stands, and what can be done about it.

function PostActions({ post, onSchedule, onPostNow }: { post: Post; onSchedule: (status: "draft" | "scheduled") => void; onPostNow: () => void }) {
  const { account } = useLinkedIn()
  const [confirming, setConfirming] = React.useState(false)
  const ready = !!account?.connected && post.body.trim().length > 0
  const due = new Date(post.publishAt) <= new Date()

  if (post.status === "posted") {
    return (
      <div className="mt-2 flex flex-col gap-1 border-t pt-2">
        {post.urls.map((url) => (
          <Button key={url} variant="outline" size="sm" className="justify-start" render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLinkIcon data-icon="inline-start" />
            View on LinkedIn
          </Button>
        ))}
      </div>
    )
  }

  if (post.status === "publishing") {
    return <p className="mt-2 border-t pt-2 text-sm text-muted-foreground">Publishing…</p>
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      {post.status === "failed" && post.error && <p className="text-sm text-destructive">{post.error}</p>}
      {!account?.connected && <p className="text-sm text-muted-foreground">Connect LinkedIn in the rail to schedule this.</p>}
      {post.status === "scheduled" && due && <p className="text-sm text-muted-foreground">Due now; it goes out on the publisher&apos;s next run.</p>}
      <div className="flex gap-2">
        {post.status === "scheduled" ? (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onSchedule("draft")}>
            Unschedule
          </Button>
        ) : (
          <Button size="sm" className="flex-1" disabled={!ready} onClick={() => onSchedule("scheduled")}>
            {due ? "Schedule (goes out now)" : "Schedule"}
          </Button>
        )}
        {confirming ? (
          <Button variant="destructive" size="sm" className="flex-1" disabled={!ready} onClick={onPostNow}>
            <SendIcon data-icon="inline-start" />
            Confirm
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex-1" disabled={!ready} onClick={() => setConfirming(true)}>
            <SendIcon data-icon="inline-start" />
            Post now
          </Button>
        )}
      </div>
    </div>
  )
}
