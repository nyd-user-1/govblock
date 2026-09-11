"use client"

import * as React from "react"
import { ChevronLeftIcon, GlobeIcon, LockIcon, SwitchCameraIcon, UploadIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

import { type Clip, type Visibility } from "./store"

// Record a short clip the way a phone does: the camera fills the frame, one
// button starts and stops, a ring counts the sixty seconds, then a review, then
// a title and a visibility. Private is the default; public is a choice.
//
// The recording is MediaRecorder on the device camera and never leaves the
// browser. Where a camera is refused or absent (a desktop without one), the
// upload button takes a file instead.

const MAX_SECONDS = 60

type Stage = "camera" | "review" | "details"

// WebM with Opus first (Brendan, 2026-09-11, "there's no sound"): Chrome
// accepts a bare video/mp4 too, but which audio codec it muxes into it is the
// browser's choice and not every build carries one. MP4 stays for Safari,
// which records nothing else.
function pickMime() {
  if (typeof MediaRecorder === "undefined") return ""
  for (const t of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ""
}

/**
 * The first decoded frame of a recording as a JPEG, or nothing after three
 * seconds. MediaRecorder's WebM carries no cues, so a tile that asks the
 * browser for metadata alone can sit black (Brendan, 2026-09-11: "nothing is
 * showing up even though the slot for the video shows up"); a drawn frame is
 * what the grid shows instead.
 */
function frameOf(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement("video")
    const done = (out?: string) => {
      clearTimeout(timer)
      v.remove()
      resolve(out)
    }
    const timer = setTimeout(() => done(), 3000)
    v.muted = true
    v.playsInline = true
    v.preload = "auto"
    v.src = src
    v.onloadeddata = () => {
      try {
        const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight, 1))
        const c = document.createElement("canvas")
        c.width = Math.round(v.videoWidth * scale)
        c.height = Math.round(v.videoHeight * scale)
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height)
        done(c.toDataURL("image/jpeg", 0.8))
      } catch {
        done()
      }
    }
    v.onerror = () => done()
  })
}

export function Capture({ author, onSaved, onClose }: { author: Clip["author"]; onSaved: (clip: Clip) => void; onClose: () => void }) {
  const [stage, setStage] = React.useState<Stage>("camera")
  const [facing, setFacing] = React.useState<"user" | "environment">("user")
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [recording, setRecording] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [blob, setBlob] = React.useState<Blob | null>(null)
  /** Whether the take carried a microphone track; null until a take is made. */
  const [hasAudio, setHasAudio] = React.useState<boolean | null>(null)
  const [url, setUrl] = React.useState<string | null>(null)
  const [duration, setDuration] = React.useState<number | undefined>()
  const [title, setTitle] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [visibility, setVisibility] = React.useState<Visibility>("private")
  const [saving, setSaving] = React.useState(false)
  const previewRef = React.useRef<HTMLVideoElement>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const startedAt = React.useRef(0)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // The camera, for as long as the camera stage is showing.
  React.useEffect(() => {
    if (stage !== "camera") return
    let cancelled = false
    let s: MediaStream | null = null
    setCameraError(null)
    const media = navigator.mediaDevices
    if (!media) {
      setCameraError("No camera here.")
      return
    }
    media
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: true })
      .then((got) => {
        if (cancelled) return got.getTracks().forEach((t) => t.stop())
        s = got
        setStream(got)
      })
      .catch((e: Error) => setCameraError(e.name === "NotAllowedError" ? "Camera access was refused." : "No camera here."))
    return () => {
      cancelled = true
      s?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [stage, facing])

  React.useEffect(() => {
    if (previewRef.current && stream) previewRef.current.srcObject = stream
  }, [stream])

  const stop = React.useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== "inactive") rec.stop()
    setRecording(false)
  }, [])

  React.useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      const t = (Date.now() - startedAt.current) / 1000
      setElapsed(t)
      if (t >= MAX_SECONDS) stop()
    }, 100)
    return () => clearInterval(id)
  }, [recording, stop])

  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )

  const start = () => {
    if (!stream) return
    const mime = pickMime()
    // 8 Mbit/s: the browser's default is a fraction of that and the take
    // reads as smeared (Brendan, 2026-09-11: "the video quality is just
    // pretty shitty"). A sixty-second take is about 60 MB in the store.
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 })
    setHasAudio(stream.getAudioTracks().some((t) => t.enabled && t.readyState === "live"))
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" })
      setBlob(out)
      setUrl(URL.createObjectURL(out))
      setDuration(Math.min(MAX_SECONDS, (Date.now() - startedAt.current) / 1000))
      setStage("review")
    }
    recorderRef.current = rec
    startedAt.current = Date.now()
    setElapsed(0)
    setRecording(true)
    rec.start(250)
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return
    setHasAudio(null)
    setBlob(f)
    setUrl(URL.createObjectURL(f))
    setDuration(undefined)
    setStage("review")
  }

  const retake = () => {
    setBlob(null)
    setUrl(null)
    setStage("camera")
  }

  const save = async () => {
    if (!blob || !title.trim()) return
    setSaving(true)
    const poster = url ? await frameOf(url) : undefined
    onSaved({
      id: `mine-${Date.now().toString(36)}`,
      creatorId: "you",
      author,
      title: title.trim(),
      caption: caption.trim(),
      src: url ?? "",
      blob,
      poster,
      duration,
      createdAt: new Date().toISOString(),
      visibility,
      views: 0,
      likes: 0,
      mine: true,
    })
  }

  const progress = Math.min(1, elapsed / MAX_SECONDS)
  const R = 40
  const C = 2 * Math.PI * R
  const chip = "rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"

  if (stage === "camera") {
    return (
      <div className="absolute inset-0 flex flex-col bg-black text-white">
        <video ref={previewRef} autoPlay muted playsInline className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")} />
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-white/80">{cameraError}</p>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <UploadIcon className="size-4" /> Choose a video
            </Button>
          </div>
        )}
        <div className="relative flex items-center justify-between p-3">
          <Button variant="ghost" size="icon-sm" className={chip} aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
          <span className={cn("rounded-full bg-black/40 px-2.5 py-1 font-mono text-xs tabular-nums", recording && "bg-red-600")}>{recording ? `${Math.floor(elapsed)}s` : `${MAX_SECONDS}s max`}</span>
          <Button variant="ghost" size="icon-sm" className={chip} aria-label="Flip camera" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} disabled={recording}>
            <SwitchCameraIcon />
          </Button>
        </div>
        <div className="relative mt-auto flex items-end justify-between p-5 pb-7">
          <button type="button" className="flex size-11 items-center justify-center rounded-full bg-black/40 text-white disabled:opacity-40" aria-label="Upload a video" onClick={() => fileRef.current?.click()} disabled={recording}>
            <UploadIcon className="size-5" />
          </button>
          <button type="button" aria-label={recording ? "Stop recording" : "Start recording"} onClick={recording ? stop : start} disabled={!stream} className="relative flex size-22 items-center justify-center disabled:opacity-40">
            <svg viewBox="0 0 88 88" className="absolute inset-0 size-full -rotate-90">
              <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
              <circle cx="44" cy="44" r={R} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset 100ms linear" }} />
            </svg>
            <span className={cn("block bg-red-500 transition-all duration-200", recording ? "size-8 rounded-md" : "size-16 rounded-full")} />
          </button>
          <span className="size-11" />
        </div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
      </div>
    )
  }

  if (stage === "review") {
    return (
      <div className="absolute inset-0 flex flex-col bg-black text-white">
        {url && (
          <video
            src={url}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              if (Number.isFinite(d) && d > 0) setDuration(d)
            }}
          />
        )}
        {hasAudio === false && (
          <p className="absolute inset-x-0 top-14 z-10 text-center text-xs text-white/80">No microphone on this take. Check the browser&apos;s permission and retake.</p>
        )}
        <div className="relative flex items-center justify-between p-3">
          <Button variant="ghost" size="icon-sm" className={chip} aria-label="Retake" onClick={retake}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" className={chip} aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        <div className="relative mt-auto flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-5 pb-7">
          <Button variant="secondary" className="rounded-full" onClick={retake}>
            Retake
          </Button>
          <Button className="rounded-full px-6" onClick={() => setStage("details")}>
            Next
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => setStage("review")}>
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium">New clip</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex gap-3">
          <div className="aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg bg-black">{url && <video src={url} muted playsInline className="size-full object-cover" />}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" autoFocus />
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say what it is" aria-label="Caption" className="min-h-20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "private", label: "Private", sub: "Only you", Icon: LockIcon },
              { value: "public", label: "Public", sub: "Everyone, in Clips", Icon: GlobeIcon },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setVisibility(o.value)}
              className={cn("flex items-center gap-3 rounded-lg border p-3 text-left transition-colors", visibility === o.value ? "border-foreground bg-accent" : "hover:bg-accent/50")}
            >
              <o.Icon className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t p-4">
        <Button className="w-full" disabled={!title.trim() || saving} onClick={save}>
          {saving ? "Saving…" : visibility === "public" ? "Publish" : "Save to your library"}
        </Button>
      </div>
    </div>
  )
}
