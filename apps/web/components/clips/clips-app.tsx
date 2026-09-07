"use client"

import * as React from "react"
import Link from "next/link"
import { CameraIcon, LockIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { Capture } from "./capture"
import { Player } from "./player"
import { PUBLISHED, deleteClip, fmtDuration, loadMine, saveClip, type Clip } from "./store"

// Clips: short vertical video, recorded on a phone or a laptop, kept private
// until its owner says otherwise. A mock of the whole experience (Brendan,
// 2026-09-07) so the shape can be judged before Stream is wired in.
//
// Two tabs. Clips is what GovBlock and its readers have published, for
// everyone. Your library is the signed-in reader's own recordings, private
// ones included. On a phone the grid is edge to edge and the record button
// floats; on a desktop the grid sits in the container and recording and
// playback happen in a phone-sized frame on a dark field, which is how a
// vertical video should be met on a wide screen.

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

/** The frame a clip lives in: the whole screen on a phone, a phone on a desktop. */
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

function Tile({ clip, onOpen }: { clip: Clip; onOpen: () => void }) {
  const [duration, setDuration] = React.useState(clip.duration)
  return (
    <button type="button" onClick={onOpen} className="group relative aspect-[9/16] overflow-hidden bg-black text-left md:rounded-xl" aria-label={clip.title}>
      <video
        src={`${clip.src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (!clip.duration && Number.isFinite(d)) setDuration(d)
        }}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
        <p className="line-clamp-2 text-xs leading-tight font-medium text-white md:text-sm">{clip.title}</p>
      </div>
      <span className="absolute top-1.5 right-1.5 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums">{fmtDuration(duration)}</span>
      {clip.visibility === "private" && (
        <span className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white" title="Private">
          <LockIcon className="size-3" />
        </span>
      )}
    </button>
  )
}

export function ClipsApp() {
  const { account, ready } = useAccount()
  const [tab, setTab] = React.useState<"clips" | "mine">("clips")
  const [mine, setMine] = React.useState<Clip[]>([])
  const [mode, setMode] = React.useState<{ kind: "player"; index: number } | { kind: "capture" } | { kind: "gate" } | null>(null)

  React.useEffect(() => {
    void loadMine().then(setMine)
  }, [])

  const author: Clip["author"] = { name: account?.name ?? account?.email ?? "You", image: account?.image }
  // Clips is the published set, ours and the reader's own public ones.
  const published = React.useMemo(() => [...mine.filter((c) => c.visibility === "public"), ...PUBLISHED], [mine])
  const shown = tab === "clips" ? published : mine

  const record = () => setMode(account ? { kind: "capture" } : { kind: "gate" })

  const saved = async (clip: Clip) => {
    await saveClip(clip)
    setMine((m) => [clip, ...m])
    setTab("mine")
    setMode({ kind: "player", index: 0 })
  }

  const toggleVisibility = async (clip: Clip) => {
    const next: Clip = { ...clip, visibility: clip.visibility === "public" ? "private" : "public" }
    await saveClip(next)
    setMine((m) => m.map((c) => (c.id === clip.id ? next : c)))
  }

  const remove = async (clip: Clip) => {
    await deleteClip(clip.id)
    setMine((m) => m.filter((c) => c.id !== clip.id))
    setMode(null)
  }

  return (
    <div className="container-wrapper">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6 md:py-6">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Clips</h1>
        <div className="ml-2 flex items-center gap-1 rounded-full bg-muted p-0.5 text-sm">
          {(
            [
              { value: "clips", label: "Clips" },
              { value: "mine", label: "Your library" },
            ] as const
          ).map((t) => (
            <button key={t.value} type="button" onClick={() => setTab(t.value)} className={cn("rounded-full px-3 py-1 transition-colors", tab === t.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
              {t.value === "mine" && mine.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{mine.length}</span>}
            </button>
          ))}
        </div>
        <Button className="ml-auto gap-1.5 max-md:hidden" onClick={record}>
          <CameraIcon className="size-4" />
          Record
        </Button>
      </div>

      {tab === "mine" && ready && !account ? (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <LockIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your library is yours. Sign in to see it.</p>
          <Button render={<Link href="/auth" />} size="sm">
            Sign in
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <CameraIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tab === "mine" ? "Nothing recorded yet." : "Nothing published yet."}</p>
          {tab === "mine" && (
            <Button size="sm" onClick={record}>
              Record the first one
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 md:grid-cols-4 md:gap-3 md:px-6 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((clip, i) => (
            <Tile key={clip.id} clip={clip} onOpen={() => setMode({ kind: "player", index: i })} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={record}
        aria-label="Record"
        className="fixed bottom-6 left-1/2 z-40 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background md:hidden"
      >
        <CameraIcon className="size-7" />
      </button>

      {mode?.kind === "capture" && (
        <Frame onClose={() => setMode(null)}>
          <Capture author={author} onSaved={saved} onClose={() => setMode(null)} />
        </Frame>
      )}
      {mode?.kind === "player" && (
        <Frame onClose={() => setMode(null)}>
          <Player clips={shown} index={Math.min(mode.index, shown.length - 1)} onIndex={(index) => setMode({ kind: "player", index })} onClose={() => setMode(null)} onVisibility={toggleVisibility} onDelete={remove} />
        </Frame>
      )}
      {mode?.kind === "gate" && (
        <Frame onClose={() => setMode(null)}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
            <CameraIcon className="size-8 text-muted-foreground" />
            <p className="text-base font-medium">Sign in to record</p>
            <p className="text-sm text-muted-foreground">What you record is yours, and private until you publish it.</p>
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
