"use client"

import * as React from "react"
import { getCommentKey } from "@platejs/comment"
import { KEYS, NodeApi, TextApi, type TRange } from "platejs"
import type { PlateEditor } from "platejs/react"

import { discussionPlugin, type TDiscussion } from "@/components/plate/editor/plugins/discussion-kit"
import { DEFAULT_AVATAR, useAccount } from "@/lib/auth/use-account"
import { loadComments, type SavedComment } from "@/lib/typeset/comments"

// The reader's kept comments on Plate's view of a bill (sql/026_comments.sql,
// 2026-09-15). A bill's page is read from HTML on every open, so the comment
// marks the template writes into the document are gone on reload; the threads
// come back from /api/typeset/comments once the editor has the page, and each
// open thread's mark is laid again over its quoted words in the block it was
// anchored to (or the nearest block that holds them).

const NEARBY = 12

/** Threads from rows: a thread is its first comment and its replies, oldest first. */
function threadsOf(rows: SavedComment[]): TDiscussion[] {
  const threads = new Map<string, TDiscussion>()
  for (const r of rows) {
    const createdAt = new Date(r.createdAt)
    let thread = threads.get(r.threadId)
    if (!thread) {
      thread = { id: r.threadId, comments: [], createdAt, isResolved: r.resolved, userId: "me", documentContent: r.quote ?? undefined, block: r.block }
      threads.set(r.threadId, thread)
    }
    thread.comments.push({
      id: String(r.id),
      contentRich: Array.isArray(r.rich) ? (r.rich as TDiscussion["comments"][number]["contentRich"]) : [{ type: KEYS.p, children: [{ text: r.body }] }],
      createdAt,
      discussionId: r.threadId,
      isEdited: Boolean(r.editedAt),
      userId: "me",
    })
  }
  return [...threads.values()]
}

/** The quoted words inside a top-level block, as a range. */
function rangeIn(editor: PlateEditor, index: number, quote: string): TRange | null {
  const block = editor.children[index]
  if (!block) return null
  const texts = [...NodeApi.texts(block)]
  const start = texts.map(([t]) => t.text).join("").indexOf(quote)
  if (start < 0) return null
  const point = (offset: number, end: boolean) => {
    let seen = 0
    for (const [t, path] of texts) {
      const next = seen + t.text.length
      if (offset < next || (end && offset === next)) return { path: [index, ...path], offset: offset - seen }
      seen = next
    }
    return null
  }
  const anchor = point(start, false)
  const focus = point(start + quote.length, true)
  return anchor && focus ? { anchor, focus } : null
}

function anchor(editor: PlateEditor, threads: TDiscussion[]) {
  editor.tf.withoutSaving(() => {
    for (const thread of threads) {
      const quote = thread.documentContent
      const index = Number(thread.block?.slice(1))
      if (thread.isResolved || !quote || !Number.isFinite(index)) continue
      let at: TRange | null = null
      for (let step = 0; step <= NEARBY && !at; step++) at = rangeIn(editor, index + step, quote) ?? (step ? rangeIn(editor, index - step, quote) : null)
      if (at) editor.tf.setNodes({ [KEYS.comment]: true, [getCommentKey(thread.id)]: true }, { at, match: TextApi.isText, split: true })
    }
  })
}

/** Where the view's comments are kept, who is writing, and the threads, read once the page is in the editor. */
export function usePlateComments(editor: PlateEditor, document: string | null, billId: number | null) {
  const { account, ready } = useAccount()
  const who = account ? `${account.name ?? ""}|${account.email ?? ""}|${account.image ?? ""}` : null

  React.useEffect(() => {
    editor.setOption(discussionPlugin, "document", document)
    editor.setOption(discussionPlugin, "billId", billId)
  }, [editor, document, billId])

  React.useEffect(() => {
    if (!ready) return
    editor.setOption(discussionPlugin, "users", account ? { me: { id: "me", name: account.name || account.email || "You", avatarUrl: account.image || DEFAULT_AVATAR } } : {})
    editor.setOption(discussionPlugin, "currentUserId", account ? "me" : null)
    if (!account || !document) return
    let live = true
    loadComments(document)
      .then(({ comments }) => {
        if (!live) return
        const threads = threadsOf(comments)
        anchor(editor, threads)
        editor.setOption(discussionPlugin, "discussions", threads)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // `who` stands for the account's fields.
  }, [editor, ready, who, document]) // eslint-disable-line react-hooks/exhaustive-deps
}
