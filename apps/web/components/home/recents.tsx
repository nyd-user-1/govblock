"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { hasItems, siteConfig } from "@/lib/config"

// Recents — the pages the reader opened last, kept in the browser (Brendan,
// 2026-09-07: Cloudflare's account home). The recorder sits in the docs
// shell and notes every page as it opens; the rail and the home page read
// the list. Nothing leaves the browser.

export type Recent = { href: string; title: string; group: string; at: number }

const KEY = "govblock:recents"
const MAX = 12

/** The page's title and the section it belongs to, off the path and the document. */
function describe(pathname: string): { title: string; group: string } | null {
  if (pathname === "/" || pathname === "/home") return null
  for (const entry of siteConfig.navItems) {
    if (!hasItems(entry)) continue
    for (const page of entry.items) {
      if (pathname === page.href || pathname.startsWith(`${page.href}/`)) {
        const title = typeof document !== "undefined" ? document.title.replace(/\s+[-–|]\s+govblock.*$/i, "").trim() : ""
        return { title: pathname === page.href ? page.label : title || page.label, group: pathname === page.href ? entry.label : page.label }
      }
    }
  }
  const title = typeof document !== "undefined" ? document.title.replace(/\s+[-–|]\s+govblock.*$/i, "").trim() : ""
  return title
    ? {
        title,
        group:
          pathname
            .split("/")
            .filter(Boolean)[0]
            ?.replace(/^\w/, (c) => c.toUpperCase()) ?? "Pages",
      }
    : null
}

export function readRecents(): Recent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as Recent[]) : []
    return Array.isArray(list) ? list.filter((r) => r && r.href && r.title) : []
  } catch {
    return []
  }
}

function write(list: Recent[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
    window.dispatchEvent(new Event("govblock:recents"))
  } catch {
    // Storage full or blocked: recents are a convenience, not a record.
  }
}

/** Empties the list, from the home column's menu. */
export function clearRecents() {
  write([])
}

/** Mounted once in the shell: notes the page as it opens, after the title has settled. */
export function RecentsRecorder() {
  const pathname = usePathname()
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const found = describe(pathname)
      if (!found) return
      const href = `${pathname}${window.location.search}`
      const rest = readRecents().filter((r) => r.href !== href)
      write([{ href, ...found, at: Date.now() }, ...rest])
    }, 800)
    return () => clearTimeout(timer)
  }, [pathname])
  return null
}

export function useRecents(limit = MAX) {
  const [list, setList] = React.useState<Recent[]>([])
  React.useEffect(() => {
    const load = () => setList(readRecents().slice(0, limit))
    load()
    window.addEventListener("govblock:recents", load)
    window.addEventListener("storage", load)
    return () => {
      window.removeEventListener("govblock:recents", load)
      window.removeEventListener("storage", load)
    }
  }, [limit])
  return list
}
