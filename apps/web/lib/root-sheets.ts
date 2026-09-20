"use client"

import * as React from "react"

import type { Entry } from "@/components/changelog-v2-body"

// What the root's right-hand sheets show (Brendan, 2026-09-20): a file, not
// the API. The sheets are a demonstration, and reading every state's bills and
// their texts into them cost each load of the root four seconds of a busy
// page. scripts/root-sheets/freeze.mjs writes the file; it is fetched only
// when a reader first opens their way to a sheet that draws it, so the root's
// own load carries none of it.
export type RootSheets = { frozen: string; changelog: { entries: Entry[]; texts: Record<string, string> }; home: Record<string, unknown> }

/** The frozen file, null until `active` and then until it lands. */
export function useRootSheets(active: boolean) {
  const [file, setFile] = React.useState<RootSheets | null>(null)
  React.useEffect(() => {
    if (!active) return
    let alive = true
    void import("@/lib/data/root-sheets.json").then((module) => alive && setFile(module.default as unknown as RootSheets))
    return () => {
      alive = false
    }
  }, [active])
  return file
}
