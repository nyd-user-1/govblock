"use client"

import * as React from "react"

// Commits a reader makes to a bill's text, kept in this browser (Brendan,
// 2026-09-03: "for now it only needs to survive with the browser session").
// A commit is a version like the legislature's own: it has a document id
// (negative, so it can never collide with LegiScan's), a parent, a message
// and a description the way GitHub asks for them, and the whole text. The
// pane, Changes and History read commits and official texts through one
// list, so a commit diffs, browses and lists like any version.
//
// The store is one localStorage key per bill, read through
// useSyncExternalStore so every reader of it sees a commit at once.

export type LocalCommit = {
  id: number
  bill_id: number
  parent: number | null
  message: string
  description: string
  text: string
  author: string
  at: string
}

const EVENT = "govblock:commits"
const key = (state: string, billId: number) => `govblock:commits:${state}:${billId}`

export const isCommitId = (id: number) => id < 0

function read(k: string): LocalCommit[] {
  try {
    const raw = window.localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as LocalCommit[]) : []
  } catch {
    return []
  }
}

export function useCommits(state: string, billId: number | null) {
  const k = billId ? key(state, billId) : ""
  const subscribe = React.useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify)
    window.addEventListener("storage", notify)
    return () => {
      window.removeEventListener(EVENT, notify)
      window.removeEventListener("storage", notify)
    }
  }, [])
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      if (!k) return "[]"
      try {
        return window.localStorage.getItem(k) ?? "[]"
      } catch {
        return "[]"
      }
    },
    () => "[]"
  )
  const commits = React.useMemo(() => {
    try {
      return (JSON.parse(raw) as LocalCommit[]).sort((a, b) => b.id - a.id)
    } catch {
      return []
    }
  }, [raw])
  const add = React.useCallback(
    (commit: Omit<LocalCommit, "id" | "at" | "author" | "bill_id">) => {
      if (!k || !billId) return null
      const made: LocalCommit = { ...commit, id: -Date.now(), bill_id: billId, author: "you", at: new Date().toISOString() }
      try {
        window.localStorage.setItem(k, JSON.stringify([made, ...read(k)]))
      } catch {
        // Private mode, or a full store: the commit lives for this render only.
      }
      window.dispatchEvent(new Event(EVENT))
      return made
    },
    [k, billId]
  )
  return { commits, add }
}

/** A commit in the shape the pane, Changes and History already read. */
export function commitVersion(c: LocalCommit) {
  return { document_id: c.id, version: c.message, chars: c.text.length, fetched_at: c.at, commit: c }
}
