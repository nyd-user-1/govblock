"use client"

import * as React from "react"
import { UploadIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"

import { uploadVideo, type Upload as UploadRow } from "./store"

// Upload: a reader's own video, long or short, sent to Stream and queued to
// be cut into clips the way a hearing is. A reader's upload is not GovBlock's
// to post, so nothing is sent until the reader ticks that they have the right
// to post it; the server and the table refuse it otherwise. The clips it
// yields come out private, in the reader's library.

export function Upload({ onClose, onUploaded }: { onClose: () => void; onUploaded: (upload: UploadRow) => void }) {
  const [file, setFile] = React.useState<File | null>(null)
  const [url, setUrl] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [rights, setRights] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, ""))
    setError(null)
  }

  const send = async () => {
    if (!file || !title.trim() || !rights) return
    setSending(true)
    setError(null)
    setSent(0)
    try {
      const upload = await uploadVideo(file, title.trim(), rights, setSent)
      onUploaded(upload)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload did not go through.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-sm font-medium">Upload a video</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-medium">Upload received</p>
          <p className="text-sm text-muted-foreground">It is queued to be cut. Its clips arrive in the library, private until published.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
              {url ? (
                <video src={url} muted playsInline controls className="size-full bg-black object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <UploadIcon className="size-6" /> Choose a video
                </span>
              )}
            </button>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" disabled={sending} />
            <Label className="flex items-start gap-3 font-normal leading-snug">
              <Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} disabled={sending} className="mt-0.5" />
              <span className="flex flex-col gap-1">
                <span className="font-medium">I have the right to post this video.</span>
                <span className="text-xs text-muted-foreground">Own work, the owner&apos;s permission, or the public domain. A clip that breaks this comes down on report.</span>
              </span>
            </Label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="border-t p-4">
            <Button className="w-full" disabled={!file || !title.trim() || !rights || sending} onClick={send}>
              {sending ? `Sending… ${Math.round(sent * 100)}%` : "Upload"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
