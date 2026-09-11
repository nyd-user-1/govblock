"use client"

import * as React from "react"
import { LockIcon, PlayIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"

import { fmtCount, type Clip } from "./store"

// Instagram's grid: the poster fills the tile, the author's avatar and handle
// sit top left, the play count and the caption sit at the foot. Three across
// on a phone, four on a desktop, with the hairline gaps Instagram uses.

export function Grid({ clips, onOpen, className }: { clips: Clip[]; onOpen: (clip: Clip) => void; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-0.5 lg:grid-cols-4", className)}>
      {clips.map((clip) => (
        <button key={clip.id} type="button" onClick={() => onOpen(clip)} className="group relative aspect-[9/16] overflow-hidden bg-black text-left text-white" aria-label={clip.title}>
          {clip.poster ? (
            <img src={clip.poster} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            // A recording has no cues to seek by, so it loads whole rather than sitting black on metadata alone.
            <video src={clip.mine ? clip.src : `${clip.src}#t=0.1`} preload={clip.mine ? "auto" : "metadata"} muted playsInline className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          )}
          <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6">
            <Avatar className="size-6 ring-1 ring-white/40 max-sm:size-5">
              <AvatarImage src={clip.author.image ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="bg-white/20 text-[10px] text-white">{clip.author.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold max-sm:text-[11px]">{clip.author.handle}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8">
            {!clip.mine && (
              <p className="flex items-center gap-1 text-sm font-medium max-sm:text-xs">
                <PlayIcon className="size-3.5 fill-current" /> {fmtCount(clip.views)}
              </p>
            )}
            <p className="line-clamp-2 text-xs leading-tight max-sm:text-[11px]">
              <span className="font-semibold">{clip.title}</span> {clip.caption}
            </p>
          </div>
          {clip.visibility === "private" && (
            <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/50" title="Private">
              <LockIcon className="size-3" />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
