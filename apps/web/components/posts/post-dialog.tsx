"use client"

import * as React from "react"
import { format } from "date-fns"
import { ExternalLinkIcon, SendIcon, Trash2Icon } from "lucide-react"

import { POST_MAX, POST_TARGETS, type Post, type PostTarget } from "@/lib/linkedin/types"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

import { STATUS } from "./status"
import type { Posts } from "./use-posts"

// One post, new or on file: its text, where it goes and when, in a dialog
// about 500 by 350 (Brendan, 2026-09-17). Nothing leaves until it is saved;
// Schedule and Post now save first.

export type Editing = { post: Post } | { at: Date } | null

interface Draft {
  title: string
  body: string
  target: PostTarget
  date: string
  time: string
}

const FIELD = "h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"

function initial(editing: NonNullable<Editing>): Draft {
  const at = "post" in editing ? new Date(editing.post.publishAt) : editing.at
  return {
    title: "post" in editing ? editing.post.title : "",
    body: "post" in editing ? editing.post.body : "",
    target: "post" in editing ? editing.post.target : "profile",
    date: format(at, "yyyy-MM-dd"),
    time: format(at, "HH:mm"),
  }
}

export function PostDialog({ editing, onClose, data }: { editing: Editing; onClose: () => void; data: Posts }) {
  return (
    <Dialog open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[350px] w-[500px] flex-col gap-3 sm:max-w-[500px]" showCloseButton={false}>
        {editing && <Body key={"post" in editing ? editing.post.id : editing.at.toISOString()} editing={editing} onClose={onClose} data={data} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ editing, onClose, data }: { editing: NonNullable<Editing>; onClose: () => void; data: Posts }) {
  const post = "post" in editing ? editing.post : null
  const [draft, setDraft] = React.useState(() => initial(editing))
  const [busy, setBusy] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const locked = post?.status === "posted" || post?.status === "publishing"
  const connected = !!data.account?.connected
  const publishAt = new Date(`${draft.date}T${draft.time || "00:00"}`)
  const validTime = !Number.isNaN(publishAt.getTime())
  const ready = connected && draft.body.trim().length > 0 && validTime
  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }))

  const persist = async (status?: "draft" | "scheduled") => {
    if (!validTime) return null
    setBusy(true)
    const saved = await data.save(post?.id ?? null, { title: draft.title, body: draft.body, target: draft.target, publishAt: publishAt.toISOString(), ...(status ? { status } : {}) })
    setBusy(false)
    return saved
  }

  const act = async (fn: () => Promise<unknown>) => {
    await fn()
    onClose()
  }

  const why = !connected ? "Connect LinkedIn first" : !draft.body.trim() ? "Write the post first" : undefined

  return (
    <>
      <div className="flex items-center gap-2 pr-1">
        <DialogTitle className="sr-only">{post ? "Edit post" : "New post"}</DialogTitle>
        <input
          autoFocus={!locked}
          value={draft.title}
          disabled={locked}
          maxLength={200}
          placeholder="New Post"
          aria-label="Title"
          onChange={(e) => patch({ title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
        />
        {post && (
          <Badge variant="secondary" className="gap-1.5">
            <span className={cn("size-2 rounded-full", STATUS[post.status].dot)} />
            {STATUS[post.status].label}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={draft.target} disabled={locked} aria-label="Posts to" onChange={(e) => patch({ target: e.target.value as PostTarget })} className={FIELD}>
          {POST_TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input type="date" value={draft.date} disabled={locked} aria-label="Date" onChange={(e) => patch({ date: e.target.value })} className={FIELD} />
        <input type="time" value={draft.time} disabled={locked} aria-label="Time" step={60} onChange={(e) => patch({ time: e.target.value })} className={FIELD} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <Textarea
          value={draft.body}
          disabled={locked}
          maxLength={POST_MAX}
          placeholder="What should the post say?"
          aria-label="Post text"
          onChange={(e) => patch({ body: e.target.value })}
          className="min-h-0 flex-1 resize-none pb-6 text-sm"
        />
        <span className={cn("pointer-events-none absolute right-2.5 bottom-1.5 text-xs text-muted-foreground tabular-nums", draft.body.length > POST_MAX - 100 && "text-destructive")}>
          {draft.body.length.toLocaleString()} / {POST_MAX.toLocaleString()}
        </span>
      </div>

      {post?.status === "failed" && post.error && <p className="line-clamp-2 text-xs text-destructive">{post.error}</p>}

      <DialogFooter className="items-center sm:justify-between">
        {post ? (
          <Button variant="ghost" size="sm" className="text-destructive" disabled={busy || post.status === "publishing"} onClick={() => act(() => data.remove(post.id))}>
            <Trash2Icon data-icon="inline-start" />
            {locked ? "Remove" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {post?.status === "posted" ? (
            post.urls.map((url) => (
              <Button key={url} size="sm" render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLinkIcon data-icon="inline-start" />
                View on LinkedIn
              </Button>
            ))
          ) : post?.status === "publishing" ? (
            <span className="text-sm text-muted-foreground">Publishing…</span>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={busy || !validTime} onClick={() => act(() => persist(post?.status === "scheduled" ? "scheduled" : "draft"))}>
                {post?.status === "scheduled" ? "Save" : "Save draft"}
              </Button>
              {post?.status === "scheduled" ? (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => act(() => persist("draft"))}>
                  Unschedule
                </Button>
              ) : (
                <Button size="sm" disabled={busy || !ready} title={why} onClick={() => act(() => persist("scheduled"))}>
                  Schedule
                </Button>
              )}
              {confirming ? (
                <Button variant="destructive" size="sm" disabled={busy || !ready} onClick={() => act(async () => {
                  const saved = await persist()
                  if (saved) await data.postNow(saved.id)
                })}>
                  <SendIcon data-icon="inline-start" />
                  Confirm
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled={busy || !ready} title={why} onClick={() => setConfirming(true)}>
                  <SendIcon data-icon="inline-start" />
                  Post now
                </Button>
              )}
            </>
          )}
        </div>
      </DialogFooter>
    </>
  )
}
