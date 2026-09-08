"use client"

import * as React from "react"
import Link from "next/link"
import { CameraIcon, LayoutGridIcon, LockIcon, PlaySquareIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Drawer, DrawerContent, DrawerTitle } from "@govblock/ui/components/nova/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { cn } from "@govblock/ui/lib/utils"

import { Capture } from "./capture"
import { CommentsPanel } from "./comments"
import { Creators, type CreatorRow } from "./creators"
import { Feed, type Reactions } from "./feed"
import { Grid } from "./grid"
import { CREATORS, PUBLISHED, SEED_COMMENTS, deleteClip, loadFollows, loadLikes, loadMine, loadMyComments, loadSaves, saveClip, storeFollows, storeLikes, storeMyComments, storeSaves, type Clip, type Comment } from "./store"

// Clips: short vertical video, recorded on a phone or a laptop, kept private
// until its owner says otherwise. A mock of the whole experience (Brendan,
// 2026-09-07) so the shape can be judged before Stream is wired in.
//
// The page is the site's centred layout with both rails (Brendan, 2026-09-07):
// creators on the left, the clip in the middle, and the comments on the
// right. The middle scrolls down, one clip a screen, the way every other
// page here scrolls; a grid of the same clips is one toggle away and opens
// into the feed at the tile you chose. On a phone the rails fold away: the
// creators become a select in the toolbar and the comments a sheet that
// rises from the foot.

type Account = { name?: string | null; email?: string | null; image?: string | null } | null

function useAccount(): { account: Account; ready: boolean } {
  const [account, setAccount] = React.useState<Account>(null)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    let live = true
    try {
      const raw = sessionStorage.getItem("govblock:account")
      if (raw) setAccount(JSON.parse(raw) as Account)
    } catch {}
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: NonNullable<Account> } | null) => {
        if (!live) return
        setAccount(s?.user?.email || s?.user?.name ? s.user : null)
        setReady(true)
      })
      .catch(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return { account, ready }
}

/** Recording and the sign-in gate: the whole screen on a phone, a phone on a desktop. */
function Frame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black md:bg-black/85 md:p-6" onClick={onClose}>
      <div className="relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:h-[min(100%,880px)] md:w-auto md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const FEED_HEIGHT = "h-[calc(100svh-var(--header-height)-3.5rem)]"

export function ClipsApp() {
  const { account, ready } = useAccount()
  const signedIn = !!account
  const [mine, setMine] = React.useState<Clip[]>([])
  const [creator, setCreator] = React.useState("all")
  const [view, setView] = React.useState<"feed" | "grid">("feed")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [muted, setMuted] = React.useState(true)
  const [liked, setLiked] = React.useState<Set<string>>(new Set())
  const [saved, setSaved] = React.useState<Set<string>>(new Set())
  const [following, setFollowing] = React.useState<Set<string>>(new Set())
  const [likedComments, setLikedComments] = React.useState<Set<string>>(new Set())
  const [myComments, setMyComments] = React.useState<Comment[]>([])
  const [mode, setMode] = React.useState<"capture" | "gate" | null>(null)
  const [sheet, setSheet] = React.useState(false)
  const [focusKey, setFocusKey] = React.useState(0)
  const pendingId = React.useRef<string | null>(null)

  React.useEffect(() => {
    void loadMine().then(setMine)
    setLiked(loadLikes())
    setSaved(loadSaves())
    setFollowing(loadFollows())
    setMyComments(loadMyComments())
    const c = new URLSearchParams(window.location.search).get("c")
    if (c) pendingId.current = c
  }, [])

  const you: Clip["author"] = { name: account?.name ?? account?.email ?? "You", handle: (account?.email ?? "you").split("@")[0], image: account?.image }

  // What is on offer: the published set (the desks' clips and the reader's
  // own public ones), narrowed to a creator when one is picked.
  const published = React.useMemo(() => [...mine.filter((c) => c.visibility === "public"), ...PUBLISHED], [mine])
  const clips = React.useMemo(() => {
    if (creator === "you") return mine
    if (creator === "all") return published
    return published.filter((c) => c.creatorId === creator)
  }, [creator, mine, published])

  const rows: CreatorRow[] = CREATORS.map((c) => ({ ...c, count: published.filter((x) => x.creatorId === c.id).length }))
  const youRow: CreatorRow | null = signedIn ? { id: "you", name: you.name, handle: you.handle, image: you.image, kind: "user", count: mine.length } : null

  // The first clip plays on arrival, or the one the address names.
  React.useEffect(() => {
    if (!clips.length) return
    const want = pendingId.current && clips.find((c) => c.id === pendingId.current) ? pendingId.current : null
    if (want) {
      pendingId.current = null
      setActiveId(want)
      setTimeout(() => document.querySelector(`[data-id="${CSS.escape(want)}"]`)?.scrollIntoView({ block: "start" }), 50)
    } else if (!activeId || !clips.some((c) => c.id === activeId)) {
      setActiveId(clips[0].id)
    }
  }, [clips, activeId])

  const active = clips.find((c) => c.id === activeId) ?? null
  const commentsFor = React.useCallback((id: string) => [...SEED_COMMENTS.filter((c) => c.clipId === id), ...myComments.filter((c) => c.clipId === id)], [myComments])

  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const record = () => setMode(signedIn ? "capture" : "gate")
  const goToPost = (clip: Clip) => {
    window.history.replaceState(null, "", `/clips?c=${encodeURIComponent(clip.id)}`)
    setView("feed")
    setActiveId(clip.id)
    setTimeout(() => document.querySelector(`[data-id="${CSS.escape(clip.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30)
  }

  const reactions: Reactions = {
    liked,
    saved,
    following,
    commentCount: (id) => commentsFor(id).length,
    onLike: (clip) => {
      if (!signedIn) return setMode("gate")
      setLiked((s) => {
        const n = toggleIn(s, clip.id)
        storeLikes(n)
        return n
      })
    },
    onSave: (clip) => {
      if (!signedIn) return setMode("gate")
      setSaved((s) => {
        const n = toggleIn(s, clip.id)
        storeSaves(n)
        return n
      })
    },
    onFollow: (creatorId) => {
      if (!signedIn) return setMode("gate")
      setFollowing((s) => {
        const n = toggleIn(s, creatorId)
        storeFollows(n)
        return n
      })
    },
    onComment: (clip) => {
      setActiveId(clip.id)
      if (window.matchMedia("(min-width: 64rem)").matches) setFocusKey((k) => k + 1)
      else setSheet(true)
    },
    onGoToPost: goToPost,
  }

  const post = (text: string) => {
    if (!active) return
    const row: Comment = { id: `mc-${Date.now().toString(36)}`, clipId: active.id, author: you, text, at: new Date().toISOString(), likes: 0, mine: true }
    setMyComments((m) => {
      const n = [...m, row]
      storeMyComments(n)
      return n
    })
  }

  const saveRecording = async (clip: Clip) => {
    await saveClip(clip)
    setMine((m) => [clip, ...m])
    setCreator("you")
    setView("feed")
    setMode(null)
    pendingId.current = clip.id
  }

  const remove = async (clip: Clip) => {
    await deleteClip(clip.id)
    setMine((m) => m.filter((c) => c.id !== clip.id))
  }
  const publish = async (clip: Clip) => {
    const next: Clip = { ...clip, visibility: clip.visibility === "public" ? "private" : "public" }
    await saveClip(next)
    setMine((m) => m.map((c) => (c.id === clip.id ? next : c)))
  }

  const panel = (className?: string) =>
    active ? (
      <CommentsPanel
        clip={active}
        comments={commentsFor(active.id)}
        liked={liked.has(active.id)}
        saved={saved.has(active.id)}
        following={following.has(active.creatorId)}
        signedIn={signedIn}
        onLike={() => reactions.onLike(active)}
        onSave={() => reactions.onSave(active)}
        onFollow={() => reactions.onFollow?.(active.creatorId)}
        onGoToPost={() => goToPost(active)}
        onPost={post}
        onLikeComment={(id) => setLikedComments((s) => toggleIn(s, id))}
        likedComments={likedComments}
        focusKey={focusKey}
        className={className}
      />
    ) : null

  const creatorLabel = creator === "all" ? "All clips" : creator === "you" ? "Your library" : (CREATORS.find((c) => c.id === creator)?.name ?? creator)

  return (
    <div className="container-wrapper">
      <div className="px-2 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:gap-6 lg:px-4">
        <aside className="hidden lg:block">
          <div className={cn("sticky top-(--header-height) overflow-y-auto py-4", "h-[calc(100svh-var(--header-height))]")}>
            <Creators rows={rows} selected={creator} onSelect={setCreator} you={youRow} onRecord={record} />
          </div>
        </aside>

        <main className="min-w-0">
          <div className="flex h-14 items-center gap-2">
            {/* The count leads and the layout toggle sits beside it, at the
                left of the column, where a reader's eye starts (Brendan,
                2026-09-08). */}
            <span className="text-xs text-muted-foreground tabular-nums">{clips.length} clips</span>
            <div className="flex items-center rounded-full bg-muted p-0.5">
              <button type="button" onClick={() => setView("feed")} className={cn("flex size-8 items-center justify-center rounded-full", view === "feed" ? "bg-background shadow-sm" : "text-muted-foreground")} aria-label="Feed">
                <PlaySquareIcon className="size-4" />
              </button>
              <button type="button" onClick={() => setView("grid")} className={cn("flex size-8 items-center justify-center rounded-full", view === "grid" ? "bg-background shadow-sm" : "text-muted-foreground")} aria-label="Grid">
                <LayoutGridIcon className="size-4" />
              </button>
            </div>
            <Select value={creator} onValueChange={(v) => v && setCreator(String(v))}>
              <SelectTrigger className="h-8 w-max min-w-36 lg:hidden" size="sm" aria-label="Creator">
                <SelectValue>{() => creatorLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-44">
                <SelectItem value="all" className="whitespace-nowrap">
                  All clips
                </SelectItem>
                {CREATORS.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="whitespace-nowrap">
                    {c.name}
                  </SelectItem>
                ))}
                {signedIn && (
                  <SelectItem value="you" className="whitespace-nowrap">
                    Your library
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <span className="ml-auto hidden text-sm font-medium lg:inline">{creatorLabel}</span>
          </div>

          {creator === "you" && ready && !signedIn ? (
            <Empty icon={<LockIcon className="size-6" />} text="Your library is yours. Sign in to see it.">
              <Button render={<Link href="/auth" />} size="sm">
                Sign in
              </Button>
            </Empty>
          ) : clips.length === 0 ? (
            <Empty icon={<CameraIcon className="size-6" />} text={creator === "you" ? "Nothing recorded yet." : "Nothing published yet."}>
              {creator === "you" && (
                <Button size="sm" onClick={record}>
                  Record the first one
                </Button>
              )}
            </Empty>
          ) : view === "grid" ? (
            <Grid clips={clips} onOpen={goToPost} className="-mx-2 lg:mx-0" />
          ) : (
            <Feed clips={clips} activeId={activeId} onActive={setActiveId} muted={muted} onMuted={setMuted} reactions={reactions} className={cn(FEED_HEIGHT, "-mx-2 lg:mx-0")} />
          )}

          {creator === "you" && active?.mine && view === "feed" && (
            <div className="flex items-center gap-2 py-3 text-sm lg:pr-16">
              <span className="text-muted-foreground">{active.visibility === "public" ? "Everyone can see this." : "Only you can see this."}</span>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => void publish(active)}>
                {active.visibility === "public" ? "Make private" : "Publish"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void remove(active)}>
                Delete
              </Button>
            </div>
          )}
        </main>

        <aside className="hidden lg:block">
          <div className={cn("sticky top-(--header-height) py-4", "h-[calc(100svh-var(--header-height))]")}>
            <div className="h-full overflow-hidden rounded-xl border bg-card">{panel()}</div>
          </div>
        </aside>
      </div>

      <button type="button" onClick={record} aria-label="Record" className="fixed right-4 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background lg:hidden">
        <CameraIcon className="size-6" />
      </button>

      <Drawer open={sheet} onOpenChange={setSheet} showSwipeHandle>
        <DrawerContent className="h-[75dvh]">
          <DrawerTitle className="sr-only">Comments</DrawerTitle>
          {panel("h-full")}
        </DrawerContent>
      </Drawer>

      {mode === "capture" && (
        <Frame onClose={() => setMode(null)}>
          <Capture author={you} onSaved={saveRecording} onClose={() => setMode(null)} />
        </Frame>
      )}
      {mode === "gate" && (
        <Frame onClose={() => setMode(null)}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
            <CameraIcon className="size-8 text-muted-foreground" />
            <p className="text-base font-medium">Sign in to take part</p>
            <p className="text-sm text-muted-foreground">Recording, liking and commenting are yours once you're signed in. What you record is private until you publish it.</p>
            <Button render={<Link href="/auth" />}>Sign in</Button>
            <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
              Not now
            </Button>
          </div>
        </Frame>
      )}
    </div>
  )
}

function Empty({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
      {children}
    </div>
  )
}
