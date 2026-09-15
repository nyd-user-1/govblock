"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeftIcon, CheckIcon, CopyIcon, LinkIcon, LoaderCircleIcon, ScissorsIcon, SearchIcon } from "lucide-react"

import type { Transcript } from "@/lib/clips/youtube"
import { useAccount } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { cutLink, submitLink } from "./store"

// Paste a link, get a transcript (Brendan, 2026-09-14): a YouTube video's
// captions as paragraphs of about thirty seconds, each opening on its time; a
// time plays the video from there. Find narrows to the lines that say it.
// Copy takes the text; Get clips cuts the video into the reader's library.
// Nothing is read until Get transcript is pressed; a ?v= link only fills the
// box (Brendan, 2026-09-14: no database read on page load).

const clock = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(sec).padStart(2, "0")}`
}

type Paragraph = { start: number; text: string }

function paragraphs(t: Transcript): Paragraph[] {
  const out: Paragraph[] = []
  let cur: Paragraph | null = null
  for (const s of t.segments) {
    if (!cur || s.start - cur.start >= 30) {
      if (cur) out.push(cur)
      cur = { start: s.start, text: s.text }
    } else cur.text += ` ${s.text}`
  }
  if (cur) out.push(cur)
  return out
}

export function TranscriptPage() {
  const { signedIn } = useAccount()
  const [link, setLink] = React.useState("")
  const [transcript, setTranscript] = React.useState<Transcript | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [find, setFind] = React.useState("")
  const [at, setAt] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [cut, setCut] = React.useState<string | null>(null)

  const load = React.useCallback(async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clips/transcript?url=${encodeURIComponent(text.trim())}`)
      const body = (await res.json().catch(() => ({}))) as { transcript?: Transcript; error?: string }
      if (!res.ok || !body.transcript) throw new Error(body.error ?? "The transcript for this video is not available.")
      setTranscript(body.transcript)
      setAt(null)
      setCut(null)
      const url = new URL(window.location.href)
      url.searchParams.set("v", body.transcript.videoId)
      window.history.replaceState(null, "", url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "That link did not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("v")
    if (v) setLink(`https://www.youtube.com/watch?v=${v}`)
  }, [])

  const paras = React.useMemo(() => (transcript ? paragraphs(transcript) : []), [transcript])
  const needle = find.trim().toLowerCase()
  const shown = needle ? paras.filter((p) => p.text.toLowerCase().includes(needle)) : paras

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const getClips = async () => {
    if (!transcript) return
    setCut("Cutting…")
    try {
      const upload = await submitLink(`https://www.youtube.com/watch?v=${transcript.videoId}`)
      for (let i = 0; i < 12; i++) {
        const { upload: next } = await cutLink(upload.id)
        if (next.status === "done") return setCut(`${next.clips ?? 0} clips in your library`)
        if (next.status === "failed" || next.status === "queued") return setCut(next.error ?? "Not cut.")
      }
      setCut("Still cutting; the clips arrive in your library.")
    } catch (e) {
      setCut(e instanceof Error ? e.message : "Not cut.")
    }
  }

  const mark = (text: string) => {
    if (!needle) return text
    const parts: React.ReactNode[] = []
    const lower = text.toLowerCase()
    let from = 0
    for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, i + needle.length)) {
      parts.push(text.slice(from, i), <mark key={i} className="rounded-sm bg-yellow-200 text-foreground dark:bg-yellow-500/40">{text.slice(i, i + needle.length)}</mark>)
      from = i + needle.length
    }
    parts.push(text.slice(from))
    return parts
  }

  return (
    <div className="container-wrapper flex min-h-0 flex-1 flex-col px-4 pb-6 lg:px-6">
      <div className="flex h-14 items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/clips" />} nativeButton={false}>
          <ArrowLeftIcon /> Clips
        </Button>
        <form
          className="flex h-10 max-w-2xl flex-1 items-center gap-2 rounded-full border bg-muted/40 pr-1 pl-4 focus-within:ring-2 focus-within:ring-ring"
          onSubmit={(e) => {
            e.preventDefault()
            void load(link)
          }}
        >
          <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a YouTube link" aria-label="YouTube link" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Button type="submit" size="sm" className="h-8 rounded-full px-4" disabled={loading || !link.trim()}>
            {loading ? <LoaderCircleIcon className="animate-spin" /> : null}
            Get transcript
          </Button>
        </form>
      </div>
      {error && <p className="pb-3 text-sm text-muted-foreground">{error}</p>}

      {transcript ? (
        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:self-start">
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                key={at ?? "start"}
                src={`https://www.youtube-nocookie.com/embed/${transcript.videoId}?rel=0&modestbranding=1${at !== null ? `&start=${Math.floor(at)}&autoplay=1` : ""}`}
                title={transcript.title ?? "Video"}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-lg leading-snug font-semibold">{transcript.title ?? transcript.videoId}</h1>
              <p className="text-sm text-muted-foreground">
                {[transcript.channel, clock(transcript.duration), transcript.language?.toUpperCase()].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copy("text", paras.map((p) => p.text).join("\n\n"))}>
                {copied === "text" ? <CheckIcon /> : <CopyIcon />} Copy text
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy("times", paras.map((p) => `[${clock(p.start)}] ${p.text}`).join("\n\n"))}>
                {copied === "times" ? <CheckIcon /> : <CopyIcon />} Copy with times
              </Button>
              {signedIn ? (
                <Button size="sm" onClick={() => void getClips()} disabled={cut === "Cutting…"}>
                  {cut === "Cutting…" ? <LoaderCircleIcon className="animate-spin" /> : <ScissorsIcon />} Get clips
                </Button>
              ) : (
                <Button size="sm" render={<Link href="/auth" />} nativeButton={false}>
                  <ScissorsIcon /> Sign in to get clips
                </Button>
              )}
              {cut && cut !== "Cutting…" && <span className="text-sm text-muted-foreground">{cut}</span>}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex h-9 items-center gap-2 rounded-lg border px-3 focus-within:ring-2 focus-within:ring-ring">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in the transcript" aria-label="Find in the transcript" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              {needle && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{shown.length}</span>}
            </div>
            <div className="flex flex-col">
              {shown.map((p) => (
                <div key={p.start} className={cn("grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50", at !== null && Math.floor(at) === Math.floor(p.start) && "bg-muted")}>
                  <button type="button" onClick={() => setAt(p.start)} className="self-start rounded-md px-1.5 py-0.5 text-left font-mono text-xs text-muted-foreground tabular-nums hover:bg-accent hover:text-foreground">
                    {clock(p.start)}
                  </button>
                  <p className="text-sm leading-relaxed">{mark(p.text)}</p>
                </div>
              ))}
              {needle && shown.length === 0 && <p className="px-2 py-6 text-sm text-muted-foreground">No line says “{find.trim()}”.</p>}
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
            <p className="max-w-md text-sm text-muted-foreground">A hearing, a floor speech, a press conference: every line with its time, searchable, one click from the moment it was said.</p>
          </div>
        )
      )}
    </div>
  )
}
