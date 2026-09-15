"use client"

import { FlagLoader } from "@/components/flag-loader"

// The small flag loader (Brendan, 2026-09-15): what a page, a panel, a list or
// a menu shows while its information is on the way, in place of a sentence
// saying it is loading. The root page's loader at a third of its size.
export function LoadingFlag({ width = 32, className }: { width?: number; className?: string }) {
  return <FlagLoader width={width} className={className} />
}
