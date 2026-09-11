"use client"

import * as React from "react"
import { ReactionButton } from "@govblock/ui/components/animbits/reaction-button"
import { BookmarkIcon, ChevronDownIcon, ChevronUpIcon, HeartIcon, LockIcon, MessageCircleIcon, MoreHorizontalIcon, PauseIcon, SendIcon, Volume2Icon, VolumeXIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"

import { ClipMenu } from "./menu"
import { fmtCount, type Clip } from "./store"

// The feed: one clip after another down the page, each the height of the
// viewport, snapping. The clip in view plays; the rest wait. Beside the
// frame on a desktop, and over it on a phone, Instagram's rail: like,
// comment, share, save, more. Under it on a phone, the author and the
// caption; on a desktop the right rail carries those.

export type Reactions = {
  liked: Set<string>
  saved: Set<string>
  commentCount: (id: string) => number
  onLike: (clip: Clip) => void
  onSave: (clip: Clip) => void
  onComment: (clip: Clip) => void
  onGoToPost: (clip: Clip) => void
  onFollow?: (creatorId: string) => void
  following?: Set<string>
  /** Removes a clip of the reader's own; absent for published clips. */
  onDelete?: (clip: Clip) => void
}

export function Feed({
  clips,
  activeId,
  onActive,
  muted,
  onMuted,
  reactions,
  className,
}: {
  clips: Clip[]
  activeId: string | null
  onActive: (id: string) => void
  muted: boolean
  onMuted: (m: boolean) => void
  reactions: Reactions
  className?: string
}) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const items = React.useRef(new Map<string, HTMLDivElement>())

  // The clip in view is the one at least six tenths visible.
  React.useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) onActive((e.target as HTMLElement).dataset.id!)
      },
      { root, threshold: [0.6] }
    )
    for (const el of items.current.values()) io.observe(el)
    return () => io.disconnect()
  }, [clips, onActive])

  const index = Math.max(
    0,
    clips.findIndex((c) => c.id === activeId)
  )
  const go = React.useCallback(
    (i: number) => {
      const c = clips[i]
      if (!c) return
      items.current.get(c.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    [clips]
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return
      if (e.key === "ArrowUp") go(index - 1)
      if (e.key === "ArrowDown") go(index + 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, index])

  return (
    <div className={cn("relative", className)}>
      <div ref={scroller} className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {clips.map((clip) => (
          <div
            key={clip.id}
            data-id={clip.id}
            ref={(el) => {
              if (el) items.current.set(clip.id, el)
              else items.current.delete(clip.id)
            }}
            className="flex h-full snap-start snap-always items-center justify-center py-2 lg:py-3"
          >
            <FeedItem clip={clip} active={clip.id === activeId} muted={muted} onMuted={onMuted} reactions={reactions} />
          </div>
        ))}
      </div>
      <div className="absolute top-1/2 right-0 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index <= 0}
          className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent disabled:opacity-30"
          aria-label="Previous clip"
        >
          <ChevronUpIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index >= clips.length - 1}
          className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent disabled:opacity-30"
          aria-label="Next clip"
        >
          <ChevronDownIcon className="size-5" />
        </button>
      </div>
    </div>
  )
}

function FeedItem({ clip, active, muted, onMuted, reactions }: { clip: Clip; active: boolean; muted: boolean; onMuted: (m: boolean) => void; reactions: Reactions }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) {
      setPaused(false)
      void v.play().catch(() => setPaused(true))
    } else {
      v.pause()
      v.currentTime = 0
      setProgress(0)
    }
  }, [active])

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

  const liked = reactions.liked.has(clip.id)
  const saved = reactions.saved.has(clip.id)
  const likes = clip.likes + (liked ? 1 : 0)
  const comments = reactions.commentCount(clip.id)
  const following = reactions.following?.has(clip.creatorId)

  const rail = (
    <div className="flex flex-col items-center gap-4 text-white lg:text-foreground">
      <RailButton label={fmtCount(likes)} active={liked} activeClass="text-red-500">
        <ReactionButton Icon={HeartIcon} size={24} isLiked={liked} onToggle={() => reactions.onLike(clip)} />
      </RailButton>
      <RailButton label={fmtCount(comments)} onClick={() => reactions.onComment(clip)}>
        <MessageCircleIcon className="size-6 -scale-x-100" />
      </RailButton>
      <RailButton onClick={() => reactions.onGoToPost(clip)} label="">
        <SendIcon className="size-6" />
      </RailButton>
      <RailButton active={saved} label="">
        <ReactionButton Icon={BookmarkIcon} size={24} isLiked={saved} colors={{ initial: "currentColor", liked: "currentColor" }} onToggle={() => reactions.onSave(clip)} />
      </RailButton>
      <ClipMenu clip={clip} onGoToPost={() => reactions.onGoToPost(clip)} onDelete={clip.mine && reactions.onDelete ? () => reactions.onDelete!(clip) : undefined}>
        <button type="button" className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15 lg:hover:bg-accent" aria-label="More">
          <MoreHorizontalIcon className="size-6" />
        </button>
      </ClipMenu>
    </div>
  )

  return (
    <div className="relative h-full max-w-full">
      <div className="relative h-full max-w-full overflow-hidden bg-black select-none lg:rounded-xl" style={{ aspectRatio: "9 / 16" }}>
        <video
          ref={videoRef}
          src={clip.src}
          poster={clip.poster}
          loop
          playsInline
          muted={muted}
          preload={active ? "auto" : "metadata"}
          className="absolute inset-0 size-full object-cover"
          onClick={toggle}
          onTimeUpdate={(e) => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
        />
        {paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <PauseIcon className="size-14 fill-white/80 text-white/80" />
          </div>
        )}
        {clip.visibility === "private" && (
          <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] font-medium text-white">
            <LockIcon className="size-3" /> Private
          </span>
        )}
        <button type="button" onClick={() => onMuted(!muted)} className="absolute right-3 bottom-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeXIcon className="size-4" /> : <Volume2Icon className="size-4" />}
        </button>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25">
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
        {/* On a phone the rail and the caption sit over the picture. */}
        <div className="absolute right-1 bottom-14 lg:hidden">{rail}</div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pr-16 pb-8 text-white lg:hidden">
          <div className="flex items-center gap-2">
            <Avatar className="size-8 ring-1 ring-white/40">
              <AvatarImage src={clip.author.image ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="bg-white/20 text-xs text-white">{clip.author.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold">{clip.author.handle}</span>
            {reactions.onFollow && !clip.mine && (
              <>
                <span className="text-white/60">·</span>
                <button type="button" onClick={() => reactions.onFollow?.(clip.creatorId)} className={cn("text-sm font-semibold", following ? "text-white/70" : "text-sky-300")}>
                  {following ? "Following" : "Follow"}
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={() => setExpanded((x) => !x)} className={cn("mt-2 text-left text-sm leading-snug", !expanded && "line-clamp-2")}>
            <span className="font-semibold">{clip.title}</span> {clip.caption}
          </button>
        </div>
      </div>
      <div className="absolute -right-14 bottom-2 hidden lg:block">{rail}</div>
    </div>
  )
}

// The heart and the bookmark are animbits' Reaction Button (Brendan,
// 2026-09-11), which handles its own click, so those two RailButtons carry no
// onClick of their own: the circle is the hover target, the icon is the button.
function RailButton({ children, label, onClick, active, activeClass }: { children: React.ReactNode; label: string; onClick?: () => void; active?: boolean; activeClass?: string }) {
  const Outer = onClick ? "button" : "div"
  return (
    <Outer type={onClick ? "button" : undefined} onClick={onClick} className={cn("flex flex-col items-center gap-0.5 text-xs font-medium", active && (activeClass ?? "text-foreground"))}>
      <span className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/15 lg:hover:bg-accent">{children}</span>
      {label && <span className="tabular-nums">{label}</span>}
    </Outer>
  )
}
