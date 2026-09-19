"use client"

import * as React from "react"

// Which tags a reader follows (Brendan, 2026-09-18). Two sources: the
// interests picked at sign-up (reader_profiles.interests, read from
// /api/profile), each standing for the tags below, and what the reader
// follows or unfollows on /tags, kept in this browser until follows have a
// table of their own. A tag unfollowed here stays unfollowed even when an
// interest would follow it.

const INTEREST_TAGS: Record<string, string[]> = {
  Housing: ["housing", "zoning", "urban-development"],
  Health: ["public-health", "health-care-costs", "healthcare", "medicaid", "medicare"],
  Education: ["education", "k-12-education", "higher-education"],
  Labor: ["labor", "jobs", "workplace-safety"],
  Environment: ["environment", "climate", "climate-change"],
  "Taxes and budget": ["taxes", "taxation", "appropriations"],
  "Public safety": ["crime", "law-enforcement", "firearms"],
  Elections: ["elections", "election", "voting-rights", "campaign-finance"],
  Transportation: ["transportation", "transport", "infrastructure"],
  Technology: ["technology", "artificial-intelligence", "data-privacy", "cybersecurity"],
  Agriculture: ["agriculture", "rural-development"],
  Veterans: ["veterans", "military-families"],
}

const KEY = "govblock:tag-follows"
type Local = { on: string[]; off: string[] }

const read = (): Local => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "") as Local
    return { on: Array.isArray(v.on) ? v.on : [], off: Array.isArray(v.off) ? v.off : [] }
  } catch {
    return { on: [], off: [] }
  }
}

let local: Local = { on: [], off: [] }
let fromInterests: string[] = []
let started = false
let snapshot = new Set<string>()
const listeners = new Set<() => void>()

function recompute() {
  const off = new Set(local.off)
  snapshot = new Set([...fromInterests, ...local.on].filter((slug) => !off.has(slug)))
  listeners.forEach((l) => l())
}

function start() {
  if (started || typeof window === "undefined") return
  started = true
  local = read()
  recompute()
  fetch("/api/profile")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { profile?: { interests?: string[] } } | null) => {
      fromInterests = (data?.profile?.interests ?? []).flatMap((i) => INTEREST_TAGS[i] ?? [i.toLowerCase().replace(/\s+/g, "-")])
      recompute()
    })
    .catch(() => {})
}

export function setFollow(slug: string, follow: boolean) {
  local = {
    on: follow ? [...new Set([...local.on, slug])] : local.on.filter((s) => s !== slug),
    off: follow ? local.off.filter((s) => s !== slug) : [...new Set([...local.off, slug])],
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(local))
  } catch {
    // Storage blocked: the follow holds for this page only.
  }
  recompute()
}

const EMPTY = new Set<string>()

/** The followed slugs, live across every list and button on the page. */
export function useFollows() {
  React.useEffect(start, [])
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
    () => EMPTY,
  )
}
