"use client"

import * as React from "react"

import { claimCheck } from "@/lib/agents/claim-check"

// The browser side of forks and commits: GitHub's model put to a legislature
// (Brendan, 2026-09-03). The public owns the legislature and its versions
// are never edited; a reader forks a bill and commits in the fork. Forks
// and commits live in the database (`Forks`, `Commits`), keyed to the
// signed-in user or, signed out, to the browser's claim check — the same
// identity the connectors already use.

export type Fork = { id: number; owner: string; state: string; session_id: number | null; bill_id: number; bill_number: string | null; title: string | null; created_at: string; commits: number }

export type Commit = { id: number; fork_id: number; parent_document_id: number | null; parent_commit_id: number | null; message: string; description: string; text: string; author: string; created_at: string }

const EVENT = "govblock:forks"
const changed = () => window.dispatchEvent(new Event(EVENT))

/** The claim check rides on every request, so a signed-out reader still owns their forks. */
const withClaim = (url: string) => (typeof window === "undefined" ? url : `${url}${url.includes("?") ? "&" : "?"}claim=${encodeURIComponent(claimCheck())}`)

/** Fetch JSON, and fetch it again whenever a fork or commit is made. */
function useJson<T>(url: string | null, empty: T): { data: T; loading: boolean } {
  const [state, setState] = React.useState<{ url: string | null; data: T; loading: boolean }>({ url: null, data: empty, loading: !!url })
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener(EVENT, bump)
    return () => window.removeEventListener(EVENT, bump)
  }, [])
  React.useEffect(() => {
    if (!url) return
    let live = true
    void fetch(withClaim(url))
      .then((r) => (r.ok ? (r.json() as Promise<T>) : empty))
      .then((data) => live && setState({ url, data, loading: false }))
      .catch(() => live && setState({ url, data: empty, loading: false }))
    return () => {
      live = false
    }
    // `empty` is a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick])
  return url ? (state.url === url ? { data: state.data, loading: state.loading } : { data: empty, loading: true }) : { data: empty, loading: false }
}

const NO_FORKS: { forks: Fork[] } = { forks: [] }
const NO_COMMITS: { commits: Commit[] } = { commits: [] }

/** The reader's forks — all of them, or the one for a bill. */
export function useMyForks(billId?: number | null) {
  // A negative id is "not now": the folder hook calls this on every node.
  const url = billId && billId < 0 ? null : `/api/policy/forks${billId ? `?bill=${billId}` : ""}`
  const { data, loading } = useJson(url, NO_FORKS)
  return { forks: data.forks, loading }
}

/** One fork by id, whoever owns it. */
export function useFork(forkId: number | null) {
  const { data, loading } = useJson(forkId ? `/api/policy/forks?id=${forkId}` : null, NO_FORKS)
  return { fork: data.forks[0] ?? null, loading }
}

export function useForkCommits(forkId: number | null) {
  const { data, loading } = useJson(forkId ? `/api/policy/commits?fork=${forkId}` : null, NO_COMMITS)
  return { commits: data.commits, loading }
}

export async function createFork(input: { state: string; session_id: number | null; bill_id: number; bill_number: string; title: string }): Promise<Fork | null> {
  const r = await fetch("/api/policy/forks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, claim: claimCheck() }) })
  if (!r.ok) return null
  const { fork } = (await r.json()) as { fork: Fork | null }
  changed()
  return fork
}

export async function createCommit(input: { fork_id: number; parent_document_id: number | null; parent_commit_id: number | null; message: string; description: string; text: string }): Promise<Commit | null> {
  const r = await fetch("/api/policy/commits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, claim: claimCheck() }) })
  if (!r.ok) return null
  const { commit } = (await r.json()) as { commit: Commit | null }
  changed()
  return commit
}

/** A commit in the shape the pane, Changes and History read: a version with a negative id, so it never collides with LegiScan's. */
export function commitVersion(c: Commit) {
  return { document_id: -c.id, version: c.message, chars: c.text.length, fetched_at: c.created_at, date: c.created_at, commit: { message: c.message, description: c.description, author: c.author, text: c.text, id: c.id } }
}

export const isCommitId = (id: number) => id < 0

/** How a version is named in a header or a row: the document id, or `commit N` for a fork's commit. */
export const versionId = (v: { document_id: number; commit?: { id: number } | null }) => (v.commit ? `commit ${v.commit.id}` : String(v.document_id))
