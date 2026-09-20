"use client"

import * as React from "react"

// Favorites (Brendan, 2026-09-19): the star beside every record item's arrow
// keeps the item, and the right rail lists what was kept. Kept in this
// browser's localStorage, so it works signed out; every star and every rail on
// the page hears a change at once, and other tabs hear it through `storage`.

export type Favorite = {
  href: string
  title: string
  /** The item's description, or its lead when it has none: what the rail shows under the title. */
  detail: string | null
  /** The avatar's image — a flag, a seal, a portrait — when it has one. */
  image: string | null
  external: boolean
  /** The section of the site it was starred in — "bills", "members" — which is the right rail it shows in (2026-09-20). */
  from?: string
}

/** A path's section: its first segment, "bills" for /bills/ny. */
export const section = (path: string) => path.split(/[?#]/)[0].split("/")[1] ?? ""

/**
 * A page's own favorites (Brendan, 2026-09-20): the ones starred in its
 * section of the site, which is what its right rail lists; /favorites lists
 * them all. One kept before sections were recorded goes by its own address.
 */
export const favoritesFor = (list: Favorite[], pathname: string) => {
  const here = section(pathname)
  // Where it was starred, and where its own kind lives: a bill starred on /changelog shows there and on the bills pages.
  return list.filter((f) => f.from === here || section(f.href) === here)
}

const KEY = "govblock-favorites"
const CHANGE = "govblock-favorites-change"
const EMPTY: Favorite[] = []

let cache: { raw: string | null; list: Favorite[] } = { raw: null, list: EMPTY }

function read(): Favorite[] {
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
    list = Array.isArray(parsed) ? (parsed as Favorite[]).filter((f) => f && typeof f.href === "string") : EMPTY
  } catch {}
  cache = { raw, list }
  return list
}

function write(list: Favorite[]) {
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

/** Every favorite, newest first; empty while prerendering. */
export function useFavorites(): Favorite[] {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function isFavorite(list: Favorite[], href: string) {
  return list.some((f) => f.href === href)
}

/** Keeps the item, or lets it go if it is already kept. */
export function toggleFavorite(item: Favorite) {
  const list = read()
  write(isFavorite(list, item.href) ? list.filter((f) => f.href !== item.href) : [{ ...item, from: item.from ?? section(window.location.pathname) }, ...list])
}

/** Fills in a kept item's fields, where it is still kept. */
export function updateFavorite(href: string, patch: Partial<Favorite>) {
  const list = read()
  if (isFavorite(list, href)) write(list.map((f) => (f.href === href ? { ...f, ...patch } : f)))
}

export function removeFavorite(href: string) {
  write(read().filter((f) => f.href !== href))
}
