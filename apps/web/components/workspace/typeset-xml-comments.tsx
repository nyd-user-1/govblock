"use client"

import * as React from "react"
import Link from "next/link"
import { Extension, type Editor } from "@tiptap/react"
import type { Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { differenceInDays, differenceInHours, differenceInMinutes, format } from "date-fns"
import { ArrowUpIcon, CheckIcon, MessageSquareTextIcon, PencilIcon, TrashIcon, WandSparklesIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/plate/ui/avatar"
import { Button } from "@/components/plate/ui/button"
import { useAiMenu } from "@/components/workspace/typeset-ai-menu"
import { SelectionToolbar, useSelectionAt, type SelectionAt } from "@/components/workspace/typeset-selection-toolbar"
import { unitAt } from "@/components/workspace/typeset-units"
import { DEFAULT_AVATAR, useAccount } from "@/lib/auth/use-account"
import { addComment, deleteComment, deleteThread, editComment, loadComments, resolveThread, SignInRequired, type SavedComment } from "@/lib/typeset/comments"
import { cn } from "@govblock/ui/lib/utils"

import "./typeset-xml-comments.css"

// Comments on the XML view (sql/026_comments.sql, 2026-09-15), in the shape
// Plate's had: select words, Comment, write; the words stay highlighted and a
// click on them opens the thread, with replies, edits, deletes and resolve.
// A thread is anchored to the USLM unit's identifier and the words quoted in
// it, never to a position, so it finds its place again when the document is
// drawn afresh. The highlights are decorations laid over the document; nothing
// is written into it. The same layer carries Ask AI and ⌘J
// (typeset-ai-menu.tsx), whose Comment answer can be kept as a thread here.

type Thread = { id: string; block: string; quote: string; resolved: boolean; comments: SavedComment[] }

const key = new PluginKey<DecorationSet>("typeset-xml-comments")

function threadsOf(rows: SavedComment[]): Thread[] {
  const threads = new Map<string, Thread>()
  for (const r of rows) {
    const thread = threads.get(r.threadId) ?? { id: r.threadId, block: r.block, quote: r.quote ?? "", resolved: r.resolved, comments: [] }
    thread.comments.push(r)
    threads.set(r.threadId, thread)
  }
  return [...threads.values()]
}

/** A unit's text as textBetween reads it (a space between blocks), with the document position of every character. */
function textWithPositions(node: PmNode, start: number) {
  let text = ""
  const positions: number[] = []
  let first = true
  node.descendants((child, offset) => {
    if (child.isTextblock) {
      if (!first) {
        text += " "
        positions.push(start + offset)
      }
      first = false
    }
    if (child.isText && child.text) {
      for (let i = 0; i < child.text.length; i++) positions.push(start + offset + i)
      text += child.text
    }
    return true
  })
  return { text, positions }
}

/** Where a thread's quoted words are now: inside its unit, else anywhere in the document. */
function rangeOf(doc: PmNode, thread: Thread): { from: number; to: number } | null {
  if (!thread.quote) return null
  const units: { node: PmNode; start: number }[] = []
  doc.descendants((node, pos) => {
    if (node.attrs.identifier === thread.block) units.push({ node, start: pos + 1 })
    return units.length === 0
  })
  units.push({ node: doc, start: 0 })
  for (const unit of units) {
    const { text, positions } = textWithPositions(unit.node, unit.start)
    const at = text.indexOf(thread.quote)
    if (at >= 0) return { from: positions[at], to: positions[at + thread.quote.length - 1] + 1 }
  }
  return null
}

function decorate(doc: PmNode, threads: Thread[]) {
  const decorations: Decoration[] = []
  for (const thread of threads) {
    if (thread.resolved) continue
    const range = rangeOf(doc, thread)
    if (range) decorations.push(Decoration.inline(range.from, range.to, { class: "typeset-comment", "data-thread": thread.id }))
  }
  return DecorationSet.create(doc, decorations)
}

/** The highlights' plugin. Threads arrive by a transaction's meta; edits move the highlights with the words. */
export const XmlCommentMarks = Extension.create({
  name: "xmlCommentMarks",
  addStorage: () => ({ threads: [] as Thread[] }),
  addProseMirrorPlugins() {
    const storage = this.storage as { threads: Thread[] }
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => decorate(state.doc, storage.threads),
          apply: (tr, set) => (tr.getMeta(key) ? decorate(tr.doc, storage.threads) : set.map(tr.mapping, tr.doc)),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ]
  },
})

const fmtWhen = (iso: string) => {
  const date = new Date(iso)
  const now = new Date()
  if (differenceInMinutes(now, date) < 60) return `${differenceInMinutes(now, date)}m`
  if (differenceInHours(now, date) < 24) return `${differenceInHours(now, date)}h`
  if (differenceInDays(now, date) < 2) return `${differenceInDays(now, date)}d`
  return format(date, "MM/dd/yyyy")
}

function Composer({ placeholder, onSend, autoFocus, initial = "", onCancel }: { placeholder: string; onSend: (body: string) => Promise<void> | void; autoFocus?: boolean; initial?: string; onCancel?: () => void }) {
  const [body, setBody] = React.useState(initial)
  const [sending, setSending] = React.useState(false)
  const send = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await onSend(body.trim())
      setBody("")
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="relative flex grow items-end gap-1">
      <textarea
        autoFocus={autoFocus}
        value={body}
        rows={1}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void send()
          }
          if (e.key === "Escape") onCancel?.()
        }}
        className="field-sizing-content max-h-40 min-h-[25px] grow resize-none bg-transparent pt-0.5 pr-8 text-sm outline-none placeholder:text-muted-foreground"
      />
      {onCancel && (
        <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={onCancel} aria-label="Cancel">
          <XIcon className="size-3.5" />
        </Button>
      )}
      <Button size="icon" variant="ghost" className="absolute right-0.5 bottom-0.5 size-6 shrink-0" disabled={!body.trim() || sending} onClick={() => void send()} aria-label="Send">
        <ArrowUpIcon />
      </Button>
    </div>
  )
}

function Card({ top, left, onClose, children }: { top: number; left: number; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    document.addEventListener("mousedown", down)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("mousedown", down)
      document.removeEventListener("keydown", key)
    }
  }, [onClose])
  return (
    <div ref={ref} className="absolute z-40 max-h-[50dvh] w-[380px] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md" style={{ top: top + 6, left }}>
      {children}
    </div>
  )
}

type Me = { name: string; avatarUrl: string }

function Person({ me, when, edited }: { me: Me; when?: string; edited?: boolean }) {
  return (
    <div className="flex items-center">
      <Avatar className="size-5">
        <AvatarImage alt={me.name} src={me.avatarUrl} />
        <AvatarFallback>{me.name[0]}</AvatarFallback>
      </Avatar>
      <h4 className="mx-2 text-sm leading-none font-semibold">{me.name}</h4>
      {when && (
        <div className="text-xs leading-none text-muted-foreground/80">
          <span className="mr-1">{fmtWhen(when)}</span>
          {edited && <span>(edited)</span>}
        </div>
      )}
    </div>
  )
}

/** One comment, with its edit and delete when hovered. */
function CommentRow({ comment, me, first, last, quote, onEdit, onDelete, onResolve }: { comment: SavedComment; me: Me; first: boolean; last: boolean; quote: string; onEdit: (body: string) => Promise<void>; onDelete: () => void; onResolve: () => void }) {
  const [editing, setEditing] = React.useState(false)
  return (
    <div className="group/comment">
      <div className="relative">
        <Person me={me} when={comment.createdAt} edited={Boolean(comment.editedAt)} />
        <div className="absolute top-0 right-0 hidden gap-0.5 group-hover/comment:flex">
          {first && (
            <Button className="h-6 p-1 text-muted-foreground" variant="ghost" onClick={onResolve} aria-label="Resolve">
              <CheckIcon className="size-4" />
            </Button>
          )}
          <Button className="h-6 p-1 text-muted-foreground" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit comment">
            <PencilIcon className="size-4" />
          </Button>
          <Button className="h-6 p-1 text-muted-foreground" variant="ghost" onClick={onDelete} aria-label="Delete comment">
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>
      {first && quote && (
        <div className="relative mt-1 flex pl-[32px] text-sm text-muted-foreground">
          {!last && <div className="absolute top-[5px] left-3 h-full w-0.5 shrink-0 bg-muted" />}
          <div className="my-px w-0.5 shrink-0 bg-yellow-400/70" />
          <div className="ml-2 line-clamp-3">{quote}</div>
        </div>
      )}
      <div className="relative my-1 pl-[26px]">
        {!last && <div className="absolute top-0 left-3 h-full w-0.5 shrink-0 bg-muted" />}
        {editing ? (
          <Composer
            autoFocus
            initial={comment.body}
            placeholder="Edit comment…"
            onCancel={() => setEditing(false)}
            onSend={async (body) => {
              await onEdit(body)
              setEditing(false)
            }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
        )}
      </div>
    </div>
  )
}

const newThreadId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`)

/**
 * The XML view's comments: the Comment button over a selection, the composer,
 * and the thread a highlight opens. `document` is the Expression's address;
 * nothing is read until the reader is known to be signed in and the editor holds the document.
 */
export function XmlComments({ editor, container, document, billId, toolbar }: { editor: Editor | null; container: React.RefObject<HTMLElement | null>; document: string | null; billId?: number | null; toolbar?: (at: SelectionAt) => React.ReactNode }) {
  const { account, ready } = useAccount()
  const me: Me | null = account ? { name: account.name || account.email || "You", avatarUrl: account.image || DEFAULT_AVATAR } : null
  const [threads, setThreads] = React.useState<Thread[]>([])
  const [selection, setSelection] = useSelectionAt(editor, container)
  const [draft, setDraft] = React.useState<(SelectionAt & { block: string }) | null>(null)
  const [open, setOpen] = React.useState<{ id: string; top: number; left: number } | null>(null)
  const state = document ? (document.split("/")[1] === "us" ? "US" : document.split("/")[1]?.slice(3).toUpperCase()) : null
  const ai = useAiMenu({
    editor,
    container,
    state,
    onComment:
      me && document
        ? async ({ quote, identifier, text }) => {
            const threadId = newThreadId()
            try {
              const { comment } = await addComment({ threadId, document, billId: billId ?? null, block: identifier ?? "", quote: quote.slice(0, 2000), body: text })
              setThreads((all) => [...all, { id: threadId, block: identifier ?? "", quote: comment.quote ?? quote, resolved: false, comments: [comment] }])
            } catch (error) {
              toast.error(error instanceof SignInRequired ? error.message : "The comment could not be saved.")
            }
          }
        : undefined,
  })

  // The threads, read once the reader and the document are both known.
  React.useEffect(() => {
    setThreads([])
    if (!ready || !account || !document || !editor) return
    let live = true
    loadComments(document)
      .then(({ comments }) => live && setThreads(threadsOf(comments)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [ready, Boolean(account), document, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Threads into the highlights.
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    ;(editor.storage as unknown as { xmlCommentMarks: { threads: Thread[] } }).xmlCommentMarks.threads = threads
    editor.view.dispatch(editor.state.tr.setMeta(key, true))
  }, [editor, threads])

  // A click on highlighted words opens their thread.
  React.useEffect(() => {
    const root = container.current
    if (!root || !editor) return
    const click = (event: MouseEvent) => {
      const mark = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(".typeset-comment[data-thread]")
      if (!mark || !window.getSelection()?.isCollapsed) return
      const box = mark.getBoundingClientRect()
      const frame = root.getBoundingClientRect()
      setOpen({ id: mark.dataset.thread!, top: box.bottom - frame.top + root.scrollTop, left: box.left - frame.left + root.scrollLeft + box.width / 2 })
    }
    root.addEventListener("click", click)
    return () => root.removeEventListener("click", click)
  }, [container, editor])

  const fail = (error: unknown) => toast.error(error instanceof SignInRequired ? error.message : "The comment could not be saved.")
  const patch = (id: string, change: (thread: Thread) => Thread | null) => setThreads((all) => all.flatMap((t) => (t.id === id ? (change(t) ?? []) : [t])))

  const start = () => {
    if (!editor || !selection) return
    const unit = unitAt(editor.state.doc, selection.from)
    setDraft({ ...selection, block: unit.identifier ?? "" })
    setSelection(null)
  }

  const thread = open ? threads.find((t) => t.id === open.id) : null

  return (
    <>
      {selection && !draft && !ai.isOpen && (
        <SelectionToolbar at={selection}>
          {toolbar?.(selection)}
          <Button
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-sm"
            onClick={() => {
              ai.open(selection)
              setSelection(null)
            }}
          >
            <WandSparklesIcon className="size-4" />
            Ask AI
          </Button>
          <Button variant="ghost" className="h-7 gap-1.5 px-2 text-sm" onClick={start}>
            <MessageSquareTextIcon className="size-4" />
            Comment
          </Button>
        </SelectionToolbar>
      )}

      {ai.menu}

      {draft && (
        <Card top={draft.bottom} left={draft.left} onClose={() => setDraft(null)}>
          <div className="flex w-full p-4">
            {!me || !document ? (
              <div className="flex w-full items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sign in to comment.</span>
                <Button asChild className="ml-auto h-7" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-2 mr-1 shrink-0">
                  <Avatar className="size-5">
                    <AvatarImage alt={me.name} src={me.avatarUrl} />
                    <AvatarFallback>{me.name[0]}</AvatarFallback>
                  </Avatar>
                </div>
                <Composer
                  autoFocus
                  placeholder="Comment…"
                  onSend={async (body) => {
                    const threadId = newThreadId()
                    try {
                      const { comment } = await addComment({ threadId, document, billId: billId ?? null, block: draft.block, quote: draft.text.slice(0, 2000), body })
                      setThreads((all) => [...all, { id: threadId, block: draft.block, quote: comment.quote ?? draft.text, resolved: false, comments: [comment] }])
                      setDraft(null)
                    } catch (error) {
                      fail(error)
                    }
                  }}
                />
              </>
            )}
          </div>
        </Card>
      )}

      {open && thread && me && (
        <Card top={open.top} left={open.left} onClose={() => setOpen(null)}>
          <div className="p-4">
            {thread.comments.map((comment, index) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                me={me}
                first={index === 0}
                last={index === thread.comments.length - 1}
                quote={thread.quote}
                onEdit={async (body) => {
                  try {
                    const { comment: saved } = await editComment(comment.id, body)
                    patch(thread.id, (t) => ({ ...t, comments: t.comments.map((c) => (c.id === saved.id ? saved : c)) }))
                  } catch (error) {
                    fail(error)
                  }
                }}
                onDelete={() => {
                  const only = thread.comments.length === 1
                  patch(thread.id, (t) => (only ? null : { ...t, comments: t.comments.filter((c) => c.id !== comment.id) }))
                  if (only) setOpen(null)
                  void (only ? deleteThread(thread.id) : deleteComment(comment.id)).catch(fail)
                }}
                onResolve={() => {
                  patch(thread.id, (t) => ({ ...t, resolved: true }))
                  setOpen(null)
                  void resolveThread(thread.id).catch(fail)
                }}
              />
            ))}
            <div className={cn("flex w-full", thread.comments.length && "mt-1")}>
              <div className="mt-2 mr-1 shrink-0">
                <Avatar className="size-5">
                  <AvatarImage alt={me.name} src={me.avatarUrl} />
                  <AvatarFallback>{me.name[0]}</AvatarFallback>
                </Avatar>
              </div>
              <Composer
                placeholder="Reply…"
                onSend={async (body) => {
                  if (!document) return
                  try {
                    const { comment } = await addComment({ threadId: thread.id, document, billId: billId ?? null, block: thread.block, quote: null, body })
                    patch(thread.id, (t) => ({ ...t, comments: [...t.comments, comment] }))
                  } catch (error) {
                    fail(error)
                  }
                }}
              />
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
