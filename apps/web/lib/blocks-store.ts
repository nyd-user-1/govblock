"use client"

import * as React from "react"

import { CONGRESS } from "@/lib/filters"
import type { BlockKey, BlockRecord } from "@/lib/blocks"

// What the account home's Blocks grid holds, kept where both it and the rest
// of the site can reach it (Brendan, 2026-09-22: a block button on every
// record page, "clicking on the block icon adds that record to the home page
// blocks section"). The grid owns the layout; this owns the list, so a page
// three clicks away can add to it without knowing anything about the grid.
//
// Per browser for now, as the analytics grid's layout is. An account would
// keep it across devices; that is a column on reader_profiles and a day's work,
// and it is the obvious next thing.

export const BLOCKS_KEY = "govblock:home-blocks"
const CHANGE = "govblock:home-blocks-change"

export type Block = {
  id: string
  key: BlockKey
  span: 1 | 2
  /** How many rows tall: a record at 2 draws as its own page opens (2026-09-22). */
  rows?: 1 | 2
  /** The cell it stands on, counted from zero. A block keeps its column when a
      neighbour is taken off the grid, and a hole beside a tall block stays a
      hole (Brendan, 2026-09-22). A block saved before the grid had cells, or
      added from a record page, has none and is flowed into the first that fits. */
  col?: number
  row?: number
  record?: BlockRecord
}
export type BlocksSaved = { blocks: Block[]; state: string }

export const EMPTY: BlocksSaved = { blocks: [], state: CONGRESS }

export function readBlocks(): BlocksSaved | null {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<BlocksSaved>
    return { blocks: saved.blocks ?? [], state: saved.state ?? CONGRESS }
  } catch {
    return null
  }
}

export function writeBlocks(saved: BlocksSaved) {
  try {
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(saved))
  } catch {
    // Storage refused; the layout holds for this page only.
  }
  window.dispatchEvent(new Event(CHANGE))
}

/** True where this record already stands on the grid. */
export function hasBlock(saved: BlocksSaved | null, key: BlockKey, record?: BlockRecord) {
  return !!saved?.blocks.some((b) => b.key === key && (record ? b.record?.id === record.id : !b.record))
}

/** Adds a record to the grid, or takes it off again if it is already there. */
export function toggleBlock(key: BlockKey, record: BlockRecord, fallback: BlocksSaved) {
  const saved = readBlocks() ?? fallback
  const already = saved.blocks.find((b) => b.key === key && b.record?.id === record.id)
  const blocks = already
    ? saved.blocks.filter((b) => b !== already)
    : [...saved.blocks, { id: `b${Date.now().toString(36)}`, key, span: 1 as const, record }]
  writeBlocks({ ...saved, blocks })
  return !already
}

/** Every grid and every button on the page hears a change at once; other tabs hear it through `storage`. */
export function useBlocks(): BlocksSaved | null {
  const [saved, setSaved] = React.useState<BlocksSaved | null>(null)
  React.useEffect(() => {
    const read = () => setSaved(readBlocks())
    read()
    window.addEventListener(CHANGE, read)
    window.addEventListener("storage", read)
    return () => {
      window.removeEventListener(CHANGE, read)
      window.removeEventListener("storage", read)
    }
  }, [])
  return saved
}

/**
 * The record a page stands for, read off its own address — so a page carries
 * the block button without being told what it is. A bill and a member are
 * their id in the path; a committee is the name the bills list is filtered by.
 * Anything else has no record, and the button does not appear.
 */
export function recordOfPath(pathname: string, search: string, title: string): { key: BlockKey; record: BlockRecord } | null {
  const params = new URLSearchParams(search)
  const state = (params.get("state") || CONGRESS).toUpperCase()
  const bill = /^\/bills\/(\d+)/.exec(pathname)
  if (bill) return { key: "bills", record: { id: bill[1], label: title, state } }
  const member = /^\/members\/(\d+)/.exec(pathname)
  if (member) return { key: "members", record: { id: member[1], label: title, state } }
  const committee = params.get("committee")
  if (committee && pathname.startsWith("/bills")) return { key: "committees", record: { id: committee, label: committee, state } }
  return null
}
