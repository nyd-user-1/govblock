"use client"

import * as React from "react"
import type { Editor, JSONContent } from "@tiptap/react"

import { claimCheck } from "@/lib/agents/claim-check"

// A fork saves as the reader types (Brendan, 2026-09-15: "the way Google Docs
// does, so a closed window or a crash loses nothing"). The working document
// goes to the server a second after typing stops, at least every five seconds
// while it goes on, and when the tab is hidden, gzipped in the browser
// (PUT /api/typeset/draft). Between saves a copy sits in this browser's
// IndexedDB; the Fork view opens on it when the server's is older, which is
// what a crash leaves behind.

export type SaveStatus = "idle" | "saving" | "saved" | "failed"

const QUIET_MS = 1000
const MOST_MS = 5000
const LOCAL_QUIET_MS = 400

// ---------------------------------------------------------------- local copy ---

const DB = "typeset-drafts"
const STORE = "drafts"

export type LocalDraft = { forkId: number; json: JSONContent; at: number; headId: number | null }

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "forkId" })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

/** This browser's unsaved copy of a fork, if a save never reached the server. */
export const readLocalDraft = (forkId: number) => withStore<LocalDraft | undefined>("readonly", (s) => s.get(forkId)).then((d) => d ?? null)
const putLocalDraft = (draft: LocalDraft) => withStore("readwrite", (s) => s.put(draft))
const dropLocalDraft = (forkId: number) => withStore("readwrite", (s) => s.delete(forkId))

// -------------------------------------------------------------------- saving ---

async function gzipJson(value: unknown): Promise<Blob> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"))
  return new Response(stream).blob()
}

/**
 * Saves the editor's document as the fork's draft while `forkId` is set.
 * `dirtyAtStart` saves at once: the document opened from this browser's copy.
 */
export function useAutosave(editor: Editor | null, forkId: number | null, headId: number | null, { dirtyAtStart = false }: { dirtyAtStart?: boolean } = {}) {
  const [status, setStatus] = React.useState<SaveStatus>("idle")
  const [savedAt, setSavedAt] = React.useState<string | null>(null)
  const live = React.useRef({ editor, forkId, headId })
  live.current = { editor, forkId, headId }
  // Changes since the last save began: when the first came, and a count so a save knows whether more arrived while it ran.
  const pending = React.useRef<{ since: number; version: number; saving: boolean }>({ since: 0, version: 0, saving: false })
  const timers = React.useRef({ server: 0, local: 0 })

  const save = React.useCallback(async (keepalive = false) => {
    const { editor: e, forkId: id, headId: head } = live.current
    const p = pending.current
    window.clearTimeout(timers.current.server)
    if (!e || e.isDestroyed || !id || !p.since || p.saving) return
    const version = p.version
    p.saving = true
    setStatus("saving")
    try {
      const json = e.getJSON()
      const body = await gzipJson(json)
      const params = new URLSearchParams({ fork: String(id), claim: claimCheck() })
      if (head) params.set("parent", String(head))
      const r = await fetch(`/api/typeset/draft?${params}`, { method: "PUT", headers: { "content-type": "application/gzip" }, body, keepalive: keepalive && body.size < 60_000 })
      if (!r.ok) throw new Error(String(r.status))
      const saved = (await r.json()) as { saved_at: string }
      setSavedAt(saved.saved_at)
      if (p.version === version) {
        p.since = 0
        setStatus("saved")
        void dropLocalDraft(id)
      } else {
        // Typed while the save ran: the rest goes on the next one.
        p.since = Date.now()
        timers.current.server = window.setTimeout(() => void save(), QUIET_MS)
        setStatus("saving")
      }
    } catch {
      setStatus("failed")
      timers.current.server = window.setTimeout(() => void save(), MOST_MS)
    } finally {
      p.saving = false
    }
  }, [])

  React.useEffect(() => {
    if (!editor || !forkId) return
    const p = pending.current
    const onUpdate = () => {
      const now = Date.now()
      p.version++
      if (!p.since) p.since = now
      window.clearTimeout(timers.current.server)
      timers.current.server = window.setTimeout(() => void save(), Math.max(0, Math.min(QUIET_MS, p.since + MOST_MS - now)))
      window.clearTimeout(timers.current.local)
      timers.current.local = window.setTimeout(() => {
        if (editor.isDestroyed || !p.since) return
        void putLocalDraft({ forkId, json: editor.getJSON(), at: Date.now(), headId: live.current.headId })
      }, LOCAL_QUIET_MS)
    }
    editor.on("update", onUpdate)
    if (dirtyAtStart) onUpdate()
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true)
    }
    const onPageHide = () => void save(true)
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      editor.off("update", onUpdate)
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
      window.clearTimeout(timers.current.local)
      void save()
    }
  }, [editor, forkId, dirtyAtStart, save])

  return { status, savedAt, saveNow: save }
}
