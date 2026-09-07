"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, GlobeIcon, LockIcon, PauseIcon, Trash2Icon, Volume2Icon, VolumeXIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { fmtWhen, type Clip } from "./store"

// One clip at a time, filling the frame: tap to pause, swipe or arrow to the
// next, the title and caption over a gradient at the foot. A clip of your own
// carries its visibility as a switch, so publishing is a deliberate act made
// here and nowhere else.

export function Player({ clips, index, onIndex, onClose, onVisibility, onDelete }: { clips: Clip[]; index: number; onIndex: (i: number) => void; onClose: () => void; onVisibility?: (clip: Clip) => void; onDelete?: (clip: Clip) => void }) {
  const clip = clips[index]
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = React.useState(false)
  const [muted, setMuted] = React.useState(false)
  const touchY = React.useRef<number | null>(null)
  const prev = () => index > 0 && onIndex(index - 1)
  const next = () => index < clips.length - 1 && onIndex(index + 1)

  React.useEffect(() => {
    setPaused(false)
    const v = videoRef.current
    if (v) {
      v.currentTime = 0
      void v.play().catch(() => {
        // Autoplay with sound can be refused; retry silently.
        setMuted(true)
        v.muted = true
        void v.play().catch(() => setPaused(true))
      })
    }
  }, [index])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") prev()
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next()
      if (e.key === " ") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPaused(false)
    } else {
      v.pause()
      setPaused(true)
    }
  }

  if (!clip) return null
  const chip = "rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"

  return (
    <div
      className="absolute inset-0 bg-black text-white select-none"
      onTouchStart={(e) => (touchY.current = e.touches[0]?.clientY ?? null)}
      onTouchEnd={(e) => {
        const y0 = touchY.current
        const y1 = e.changedTouches[0]?.clientY
        touchY.current = null
        if (y0 == null || y1 == null) return
        if (y0 - y1 > 60) next()
        else if (y1 - y0 > 60) prev()
      }}
    >
      <video key={clip.id} ref={videoRef} src={clip.src} loop playsInline muted={muted} className="absolute inset-0 size-full object-cover" onClick={toggle} />
      {paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PauseIcon className="size-14 fill-white/80 text-white/80" />
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <Button variant="ghost" size="icon-sm" className={chip} aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
        <span className="text-xs text-white/70 tabular-nums">
          {index + 1} / {clips.length}
        </span>
        <Button variant="ghost" size="icon-sm" className={chip} aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16 pb-6">
        <div className="flex items-center gap-2">
          <Avatar className="size-8 ring-1 ring-white/30">
            <AvatarImage src={clip.author.image ?? undefined} alt="" />
            <AvatarFallback className="bg-white/20 text-xs text-white">{clip.author.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{clip.author.name}</span>
          <span className="text-xs text-white/60">{fmtWhen(clip.createdAt)}</span>
        </div>
        <p className="mt-2 text-base leading-snug font-semibold">{clip.title}</p>
        {clip.caption && <p className="mt-1 line-clamp-3 text-sm text-white/85">{clip.caption}</p>}
        {clip.mine && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVisibility?.(clip)}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", clip.visibility === "public" ? "bg-white text-black" : "bg-white/20 text-white")}
            >
              {clip.visibility === "public" ? <GlobeIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
              {clip.visibility === "public" ? "Public" : "Private"}
            </button>
            <span className="text-xs text-white/60">{clip.visibility === "public" ? "Everyone can see this" : "Only you can see this"}</span>
            <button type="button" onClick={() => onDelete?.(clip)} className="ml-auto flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20" aria-label="Delete">
              <Trash2Icon className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div className="absolute inset-y-0 right-2 hidden flex-col items-center justify-center gap-2 md:flex">
        <Button variant="ghost" size="icon-sm" className={chip} aria-label="Previous" onClick={prev} disabled={index === 0}>
          <ChevronUpIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" className={chip} aria-label="Next" onClick={next} disabled={index === clips.length - 1}>
          <ChevronDownIcon />
        </Button>
      </div>
    </div>
  )
}
