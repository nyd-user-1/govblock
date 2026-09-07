"use client"

import * as React from "react"

import { findBlock } from "@/components/workspace/blocks-catalogue"
import { DemoBillProvider } from "@/components/workspace/demo-bill"
import { cn } from "@govblock/ui/lib/utils"

// The live block on its docs page, drawn the way it is drawn on the canvas:
// the block itself, at the width its size asks for, on the jurisdiction and
// year in scope. A bill block reads the demo bill.
export function BlockPreview({ slug, className }: { slug: string; className?: string }) {
  const block = findBlock(slug)
  if (!block) return null
  const inner = <div className={cn("mx-auto w-full **:data-[slot=card]:h-full", block.size.cols >= 2 ? "max-w-3xl" : "max-w-sm", className)}>{block.render()}</div>
  return block.group === "bill" ? <DemoBillProvider>{inner}</DemoBillProvider> : inner
}
