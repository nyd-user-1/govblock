"use client"

import * as React from "react"
import { LinkIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"

import { submitLink, type Upload as UploadRow } from "./store"

// Clip a video (Brendan, 2026-09-14): paste a link to a long video, get short
// clips back. A YouTube link or a hearing's page; the link is queued to be
// cut, and its clips arrive in the reader's library.

export function Upload({ onClose, onUploaded }: { onClose: () => void; onUploaded: (upload: UploadRow) => void }) {
  const [url, setUrl] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim())

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || sending) return
    setSending(true)
    setError(null)
    try {
      onUploaded(await submitLink(url.trim()))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The link was not taken.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-sm font-medium">Clip a video</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-medium">Queued to be cut</p>
          <p className="text-sm text-muted-foreground">Its clips arrive in the library, private until published.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={send} className="flex flex-1 flex-col justify-center gap-3 p-6">
          <div className="flex h-12 items-center gap-2 rounded-full border bg-muted/40 pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-ring">
            <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a video link" aria-label="Video link" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <Button type="submit" size="sm" className="h-9 rounded-full px-4" disabled={!valid || sending}>
              {sending ? "Sending…" : "Get clips"}
            </Button>
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  )
}
