"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, LinkIcon, LoaderCircleIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { cutLink, submitLink, type Upload as UploadRow } from "./store"

// Clip a video (Brendan, 2026-09-14): paste a link to a long video, get short
// clips back. A YouTube link is cut here and now — the captions are read, the
// moments picked, the clips land in the reader's library, private until
// published. Any other link waits for the worker box.

type Stage = "sending" | "transcript" | "moments" | "done" | "waiting" | "failed"

const STEPS: { stage: Stage; label: string }[] = [
  { stage: "sending", label: "Taking the link" },
  { stage: "transcript", label: "Reading the captions" },
  { stage: "moments", label: "Picking the moments" },
]

export function Upload({ onClose, onUploaded, onCut }: { onClose: () => void; onUploaded: (upload: Partial<UploadRow> & { id: string }) => void; onCut: () => void }) {
  const [url, setUrl] = React.useState("")
  const [stage, setStage] = React.useState<Stage | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [clips, setClips] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [videoId, setVideoId] = React.useState<string | null>(null)
  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim())

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || stage) return
    setStage("sending")
    setError(null)
    let upload: UploadRow
    try {
      upload = await submitLink(url.trim())
      onUploaded(upload)
    } catch (err) {
      setStage(null)
      return setError(err instanceof Error ? err.message : "The link was not taken.")
    }
    setVideoId(upload.videoId ?? null)
    if (!upload.videoId) {
      setMessage("Links other than YouTube are cut on the worker box; its clips arrive in the library.")
      return setStage("waiting")
    }
    setStage("transcript")
    // Each call does one step; a slow caption job asks to be called again.
    for (let i = 0; i < 12; i++) {
      try {
        const { upload: next, step } = await cutLink(upload.id)
        onUploaded(next)
        if (next.status === "done") {
          setClips(next.clips ?? 0)
          onCut()
          return setStage("done")
        }
        if (next.status === "failed") {
          setMessage(next.error ?? "The video could not be cut.")
          return setStage("failed")
        }
        if (next.status === "queued") {
          setMessage(next.error ?? "The link waits for the worker box.")
          return setStage("waiting")
        }
        setStage(step === "pending" ? "transcript" : "moments")
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "The video could not be cut.")
        return setStage("failed")
      }
    }
    setMessage("Still working; its clips arrive in the library.")
    setStage("waiting")
  }

  const at = STEPS.findIndex((s) => s.stage === stage)

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-sm font-medium">Clip a video</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      {stage === "done" || stage === "waiting" || stage === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-medium">{stage === "done" ? `${clips} clip${clips === 1 ? "" : "s"} in your library` : stage === "waiting" ? "Queued" : "Not cut"}</p>
          {stage === "done" ? <p className="text-sm text-muted-foreground">Private until published.</p> : message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
          <div className="flex gap-2">
            {videoId && (
              <Button variant="outline" render={<Link href={`/clips/transcript?v=${videoId}`} />} nativeButton={false}>
                Transcript
              </Button>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : stage ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <ol className="flex flex-col gap-2.5">
            {STEPS.map((s, i) => (
              <li key={s.stage} className={cn("flex items-center gap-2.5 text-sm", i > at && "text-muted-foreground")}>
                {i < at ? <CheckIcon className="size-4" /> : i === at ? <LoaderCircleIcon className="size-4 animate-spin" /> : <span className="size-4" />}
                {s.label}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <form onSubmit={send} className="flex flex-1 flex-col justify-center gap-3 p-6">
          <div className="flex h-12 items-center gap-2 rounded-full border bg-muted/40 pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-ring">
            <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a video link" aria-label="Video link" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <Button type="submit" size="sm" className="h-9 rounded-full px-4" disabled={!valid}>
              Get clips
            </Button>
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  )
}
