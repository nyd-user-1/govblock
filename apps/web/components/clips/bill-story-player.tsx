"use client"

import * as React from "react"
import Link from "next/link"
import { Player } from "@remotion/player"
import { CheckIcon, CopyIcon } from "lucide-react"

import { useAccount } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/ny4/button"
import { GALLERY } from "./studio/gallery"
import { durationInFrames, SIZES, type StudioData } from "./studio/spec"
import { StudioVideo } from "./studio/studio-video"
import { clipUrl } from "./menu"
import { postGenerated, type Clip } from "./store"

const VideoComponent = StudioVideo as unknown as React.ComponentType<Record<string, unknown>>
const TEMPLATE = GALLERY.find((t) => t.id === "bill-history") ?? GALLERY[0]

/** The dialog's body: the player on the bill's data, then Post, the posted link, and the way into Studio. */
export function BillStoryPlayer({ billId }: { billId: number }) {
  const { signedIn } = useAccount()
  const link = `/bills/${billId}`
  const [data, setData] = React.useState<StudioData | null | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)
  const [posted, setPosted] = React.useState<Clip | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    let live = true
    fetch(`/api/clips/studio/data?link=${encodeURIComponent(link)}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!live) return
        if (ok && body.data) setData(body.data as StudioData)
        else {
          setData(null)
          setError(body.error ?? "This bill has no history to tell yet.")
        }
      })
      .catch(() => live && (setData(null), setError("The bill could not be read.")))
    return () => {
      live = false
    }
  }, [link])

  const spec = TEMPLATE.spec
  const size = SIZES[spec.aspect]
  const post = async () => {
    if (!data) return
    setBusy(true)
    try {
      setPosted(await postGenerated({ template: "studio", link: data.link, spec }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video was not posted.")
    }
    setBusy(false)
  }
  const share = posted ? clipUrl(posted) : null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-9/16 h-[min(70vh,640px)] overflow-hidden rounded-2xl bg-black">
        {data === undefined ? (
          <div className="absolute inset-0 animate-pulse bg-foreground/10" />
        ) : data ? (
          <Player
            component={VideoComponent}
            inputProps={{ spec, data }}
            durationInFrames={durationInFrames(spec)}
            fps={spec.fps}
            compositionWidth={size.width}
            compositionHeight={size.height}
            style={{ width: "100%", height: "100%" }}
            controls
            autoPlay
            loop
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">{error}</p>
        )}
      </div>
      {data && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {share ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(share)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Link copied" : "Copy the link"}
            </Button>
          ) : signedIn ? (
            <Button size="sm" onClick={() => void post()} disabled={busy}>
              {busy ? "Posting…" : "Post"}
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/sign-in">Sign in to post</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/clips/studio?template=${TEMPLATE.id}&link=${encodeURIComponent(link)}`}>Open in Studio</Link>
          </Button>
        </div>
      )}
      {error && data && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
