"use client"

import * as React from "react"
import { CameraIcon, LayoutGridIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import type { Creator } from "./store"

// The left rail: who is making clips. All clips first, then each creator
// with a count, then the reader's own library when they are signed in.
// Picking one narrows the feed and the grid to them.

export type CreatorRow = Creator & { count: number }

export function Creators({ rows, selected, onSelect, you, onRecord, className }: { rows: CreatorRow[]; selected: string; onSelect: (id: string) => void; you: CreatorRow | null; onRecord: () => void; className?: string }) {
  const Item = ({ id, name, sub, image, fallback }: { id: string; name: string; sub: string; image?: string | null; fallback: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect(id)} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent", selected === id && "bg-accent")}>
      <Avatar className="size-9">
        {image && <AvatarImage src={image} alt="" className="object-cover" />}
        <AvatarFallback className="bg-muted text-xs">{fallback}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  )
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Creators</p>
      <div className="flex flex-col gap-0.5">
        <Item id="all" name="All clips" sub={`${total} clips`} fallback={<LayoutGridIcon className="size-4" />} />
        {rows.map((r) => (
          <Item key={r.id} id={r.id} name={r.name} sub={`@${r.handle} · ${r.count}`} image={r.image} fallback={r.name.slice(0, 1)} />
        ))}
        {you && (
          <>
            <p className="px-2 pt-4 pb-2 text-xs font-medium text-muted-foreground">You</p>
            <Item id="you" name={you.name} sub={`Your library · ${you.count}`} image={you.image} fallback={you.name.slice(0, 1)} />
          </>
        )}
      </div>
      <div className="mt-auto pt-4">
        <Button className="w-full gap-1.5" onClick={onRecord}>
          <CameraIcon className="size-4" /> Record
        </Button>
      </div>
    </div>
  )
}
