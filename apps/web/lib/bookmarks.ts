"use client"

import * as React from "react"

// Bookmarks (Brendan, 2026-09-20): a favorite keeps a record — a bill, a
// member — from its row; a bookmark keeps a place, the page a reader is on,
// from the page's header. Same mechanics as lib/favorites.ts: this browser's
// localStorage, every button and list hearing a change at once, other tabs
// through `storage`. All of them are on /bookmarks.

export type Bookmark = {
  /** The page's address as the reader had it, scope and all. */
  href: string
  title: string
  /** The page's description. */
  detail: string | null
}

const KEY = "govblock-bookmarks"
const CHANGE = "govblock-bookmarks-change"
const EMPTY: Bookmark[] = []

let cache: { raw: string | null; list: Bookmark[] } = { raw: null, list: EMPTY }

function read(): Bookmark[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return cache.list
  }
  if (raw === cache.raw) return cache.list
  let list = EMPTY
  try {
    const parsed = raw ? JSON.parse(raw) : []
    list = Array.isArray(parsed) ? (parsed as Bookmark[]).filter((b) => b && typeof b.href === "string") : EMPTY
  } catch {}
  cache = { raw, list }
  return list
}

function write(list: Bookmark[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
  window.dispatchEvent(new Event(CHANGE))
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange()
  }
  window.addEventListener(CHANGE, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** Every bookmark, newest first; empty while prerendering. */
export function useBookmarks(): Bookmark[] {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY)
}

export const isBookmarked = (list: Bookmark[], href: string) => list.some((b) => b.href === href)

/** Keeps the page, or lets it go if it is already kept. */
export function toggleBookmark(item: Bookmark) {
  const list = read()
  write(isBookmarked(list, item.href) ? list.filter((b) => b.href !== item.href) : [item, ...list])
}

export function removeBookmark(href: string) {
  write(read().filter((b) => b.href !== href))
}
