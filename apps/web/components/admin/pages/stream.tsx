"use client"

import * as React from "react"
import { CheckIcon, ClapperboardIcon, CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, PlayIcon, PlusIcon, RadioIcon, RefreshCwIcon, Trash2Icon, UploadIcon, VideoIcon } from "lucide-react"

import { StatAi } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// Cloudflare Stream, as one Admin page (Brendan, 2026-09-06): the library
// with a player, an import from a URL, and the live inputs with their RTMPS
// keys for OBS. Everything goes through /api/stream; the token stays on the
// server. Until a token with Stream: Edit is in the environment the page
// shows the three steps that make it work, not an empty library.

type Video = {
  uid: string
  name: string
  state: string
  readyToStream: boolean
  duration: number
  created: string
  size: number
  thumbnail: string
  preview: string
  hls: string | null
  width: number | null
  height: number | null
  requireSignedURLs: boolean
}
type Live = {
  uid: string
  name: string
  created: string
  status: string | null
  rtmpsUrl: string | null
  rtmpsKey: string | null
  srtUrl: string | null
  webRtcUrl: string | null
  recording: string | null
}
type Payload = {
  ok: boolean
  reason: string
  needs: "env" | "token" | "subscription" | "unknown" | null
  videos: Video[]
  live: Live[]
  customer: string | null
  account: string | null
}

// Placeholder rows, so the Library reads as a library before an account is
// wired to it — the same courtesy the Agentic Inbox does its thread list. Only
// when the real library is empty, and deterministic: fixed uids, fixed dates,
// fixed lengths, so the page does not shuffle under a reader between renders.
// `placeholder: true` is what the rest of the page reads to keep Play, Copy
// embed and Delete off a row that is not really there.
const PLACEHOLDER_VIDEOS: (Video & { placeholder: true })[] = [
  ["Ways and Means markup — H.R. 1", 5_412, "2026-09-03"],
  ["Judiciary oversight hearing — FBI", 8_930, "2026-09-02"],
  ["Energy and Commerce — data privacy", 6_147, "2026-08-28"],
  ["Appropriations — Defense subcommittee", 11_205, "2026-08-27"],
  ["Rules Committee — H.Res. 1009", 2_388, "2026-08-21"],
  ["Senate Finance — nomination hearing", 7_016, "2026-08-19"],
  ["Agriculture — farm bill roundtable", 4_502, "2026-08-14"],
  ["Homeland Security — border briefing", 9_240, "2026-08-12"],
  ["Veterans' Affairs — benefits backlog", 3_875, "2026-08-07"],
  ["Foreign Affairs — Indo-Pacific posture", 10_133, "2026-08-05"],
].map(([name, duration, day], i) => ({
  uid: `placeholder-${String(i + 1).padStart(2, "0")}`,
  name: name as string,
  state: "ready",
  readyToStream: true,
  duration: duration as number,
  created: `${day as string}T14:00:00Z`,
  size: (duration as number) * 180_000,
  thumbnail: "",
  preview: "",
  hls: null,
  width: 1920,
  height: 1080,
  requireSignedURLs: false,
  placeholder: true,
}))

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60),
    r = Math.round(s % 60)
  return m ? `${m}m ${r}s` : `${r}s`
}
const fmtBytes = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`)
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <CheckIcon className="size-3.5 text-green-600" /> : <CopyIcon className="size-3.5" />}
    </Button>
  )
}

export function StreamPage() {
  const [data, setData] = React.useState<Payload | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [url, setUrl] = React.useState("")
  const [name, setName] = React.useState("")
  const [liveName, setLiveName] = React.useState("")
  const [showKeys, setShowKeys] = React.useState<Record<string, boolean>>({})

  const load = React.useCallback(async () => {
    const res = await fetch("/api/stream", { cache: "no-store" })
    const body = (await res.json()) as Payload
    setData(body)
    setSelected((s) => s ?? body.videos?.find((v) => v.readyToStream)?.uid ?? body.live?.[0]?.uid ?? null)
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])

  const act = async (payload: Record<string, string>, key: string) => {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await res.json()) as { error?: string; uid?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `${res.status}`)
      await load()
      return body
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  // The account's own videos where there are any; the placeholders where there
  // are not, so the table is never an empty box with a sentence in it.
  const held = data?.videos ?? []
  const videos: (Video & { placeholder?: true })[] = held.length ? held : PLACEHOLDER_VIDEOS
  const live = data?.live ?? []
  const ready = videos.filter((v) => v.readyToStream).length
  const minutes = videos.reduce((a, v) => a + v.duration, 0) / 60
  const customer = data?.customer
  const embed = (uid: string) => (customer ? `https://customer-${customer}.cloudflarestream.com/${uid}/iframe` : null)
  const current = videos.find((v) => v.uid === selected) ?? null
  const currentLive = live.find((l) => l.uid === selected) ?? null
  const pending = data === null

  return (
    <div>
      <PageTitle
        title="Stream"
        endContent={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("h-6 gap-1.5 font-normal", data?.ok ? "text-green-600" : "text-muted-foreground")}>
              <span className={cn("size-1.5 rounded-full", data?.ok ? "bg-green-500" : "bg-amber-500")} />
              {pending ? "Checking" : data?.ok ? "Connected" : "Needs setup"}
            </Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()}>
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {!pending && !data?.ok && (
        <Card className="mt-4 border-amber-500/30 bg-amber-500/5 sm:mt-5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-4" />
              <CardAnchor>Stream is not reachable yet</CardAnchor>
            </div>
            <CardDescription>{data?.reason}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            {[
              ["1. Enable Stream", "In the Cloudflare dashboard, open Stream and turn it on for the account. It bills $5 per 1,000 minutes stored and $1 per 1,000 minutes delivered."],
              ["2. Make a token", "My Profile › API Tokens › Create Token › Custom. Give it Account · Stream · Edit, and Account · Account Analytics · Read for viewer numbers."],
              ["3. Put it in the environment", "CLOUDFLARE_STREAM_TOKEN in apps/web/.env.local and in Amplify's environment variables. This page reads it on the next refresh."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border bg-background p-3">
                <p className="font-medium">{t}</p>
                <p className="mt-1 text-muted-foreground">{d}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatAi title="Videos" badge={data?.ok ? "library" : "—"} badgeTone="neutral" value={pending ? <Skeleton className="h-7 w-16" /> : videos.length} note={`${ready} ready to stream`} />
        <StatAi title="Minutes Stored" badge="$5 / 1,000" badgeTone="neutral" value={pending ? <Skeleton className="h-7 w-16" /> : Math.round(minutes)} unit="min" note={`${fmtBytes(videos.reduce((a, v) => a + v.size, 0))} of source`} />
        <StatAi
          title="Live Inputs"
          badge={live.some((l) => l.status === "connected") ? "on air" : "idle"}
          badgeTone={live.some((l) => l.status === "connected") ? "up" : "neutral"}
          value={pending ? <Skeleton className="h-7 w-16" /> : live.length}
          note="RTMPS, SRT and WebRTC ingest"
        />
        <StatAi
          title="Account"
          badge={customer ? `customer-${customer}` : "no code yet"}
          badgeTone="neutral"
          value={pending ? <Skeleton className="h-7 w-16" /> : data?.account ? data.account.slice(0, 8) + "…" : "—"}
          note="the player subdomain comes from the first video"
        />
      </div>

      {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card className="gap-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClapperboardIcon className="size-4" />
                <CardAnchor>Library</CardAnchor>
              </div>
              <CardDescription>Every video in the account, newest first. Pick one to play it.</CardDescription>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-16">Frame</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending
                    ? Array.from({ length: 4 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-9 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : videos.map((v) => (
                        <TableRow key={v.uid} className={cn(!v.placeholder && "cursor-pointer", selected === v.uid && "bg-muted/50")} onClick={() => !v.placeholder && setSelected(v.uid)}>
                          <TableCell>
                            {v.thumbnail ? (
                              <img src={v.thumbnail} alt="" className="h-9 w-14 rounded object-cover" />
                            ) : (
                              <div className="flex h-9 w-14 items-center justify-center rounded bg-muted">
                                <VideoIcon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="max-w-64 truncate font-medium">{v.name}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">{v.uid}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDuration(v.duration)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("h-5 capitalize", v.readyToStream ? "text-green-600" : v.state === "error" ? "text-destructive" : "text-amber-600")}>
                              {v.readyToStream ? "ready" : v.state}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(v.created)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Play"
                                disabled={v.placeholder}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelected(v.uid)
                                }}
                              >
                                <PlayIcon className="size-3.5" />
                              </Button>
                              {!v.placeholder && embed(v.uid) && (
                                <span onClick={(e) => e.stopPropagation()}>
                                  <Copy text={`<iframe src="${embed(v.uid)}" title="${v.name}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`} label="Copy embed" />
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete"
                                className="text-destructive"
                                disabled={v.placeholder || busy === v.uid}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (window.confirm(`Delete "${v.name}" from Stream? This cannot be undone.`)) void act({ action: "delete-video", uid: v.uid }, v.uid)
                                }}
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  {!pending && !held.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-3 text-center text-xs text-muted-foreground">
                        {data?.ok ? "Placeholders. Import a video from a URL on the right." : "Placeholders. The account's own library appears once Stream is reachable."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4 sm:gap-5 xl:col-span-2">
          <Card className="gap-3 overflow-hidden py-0">
            <CardContent className="px-0">
              {selected && embed(selected) ? (
                <iframe
                  src={embed(selected) ?? undefined}
                  title={current?.name ?? currentLive?.name ?? "Stream"}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                  <PlayIcon className="size-6" />
                  <span className="text-sm">{selected && !customer ? "The player subdomain is unknown until a video exists" : "Pick a video or a live input"}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{current?.name ?? currentLive?.name ?? "Nothing selected"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {current ? `${current.width ?? "?"}×${current.height ?? "?"} · ${fmtDuration(current.duration)} · ${fmtBytes(current.size)}` : currentLive ? `live input · ${currentLive.status ?? "idle"}` : ""}
                  </p>
                </div>
                {current?.preview && (
                  <Button variant="outline" size="sm" className="gap-1" render={<a href={current.preview} target="_blank" rel="noreferrer" />}>
                    Open
                    <ExternalLinkIcon className="size-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="gap-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UploadIcon className="size-4" />
                <CardAnchor>Import from a URL</CardAnchor>
              </div>
              <CardDescription>A public MP4, MOV, MKV, AVI, FLV, MPEG-2 TS or PS, MXF, LXF, GXF, 3GP, WebM, MPG or QuickTime file. Stream fetches and encodes it.</CardDescription>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Video URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/hearing.mp4" />
              </div>
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Senate Finance, September 10" />
              </div>
              <Button
                disabled={!url || !data?.ok || busy === "copy"}
                onClick={() =>
                  void act({ action: "copy", url, name }, "copy").then((r) => {
                    if (r?.uid) {
                      setUrl("")
                      setName("")
                      setSelected(r.uid)
                    }
                  })
                }
              >
                {busy === "copy" ? "Importing…" : "Import"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <RadioIcon className="size-4" />
              <CardAnchor>Live inputs</CardAnchor>
            </div>
            <CardDescription>Each input is an RTMPS address and key for OBS or any encoder, recorded automatically, playable at the same player URL as a video.</CardDescription>
            <CardAction>
              <CardTools className="gap-2">
                <Input value={liveName} onChange={(e) => setLiveName(e.target.value)} placeholder="Name the input" className="h-8 w-48" />
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={!data?.ok || busy === "live"}
                  onClick={() =>
                    void act({ action: "live", name: liveName }, "live").then((r) => {
                      if (r?.uid) {
                        setLiveName("")
                        setSelected(r.uid)
                      }
                    })
                  }
                >
                  <PlusIcon className="size-3.5" />
                  {busy === "live" ? "Creating…" : "New input"}
                </Button>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {live.map((l) => (
              <div key={l.uid} className={cn("flex flex-col gap-2 rounded-lg border p-3 text-sm", selected === l.uid && "border-primary")}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => setSelected(l.uid)}>
                    {l.name}
                  </button>
                  <Badge variant="outline" className={cn("h-5", l.status === "connected" ? "text-green-600" : "text-muted-foreground")}>
                    {l.status ?? "idle"}
                  </Badge>
                </div>
                <div className="grid gap-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{l.rtmpsUrl ?? "—"}</span>
                    {l.rtmpsUrl && <Copy text={l.rtmpsUrl} label="Copy RTMPS URL" />}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{showKeys[l.uid] ? l.rtmpsKey : "•".repeat(24)}</span>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon-sm" aria-label="Show key" onClick={() => setShowKeys((s) => ({ ...s, [l.uid]: !s[l.uid] }))}>
                        {showKeys[l.uid] ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                      </Button>
                      {l.rtmpsKey && <Copy text={l.rtmpsKey} label="Copy stream key" />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {fmtDate(l.created)} · recording {l.recording ?? "off"}
                  </span>
                  <div className="flex gap-0.5">
                    {embed(l.uid) && (
                      <Copy text={`<iframe src="${embed(l.uid)}" title="${l.name}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`} label="Copy embed" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete input"
                      className="text-destructive"
                      disabled={busy === l.uid}
                      onClick={() => {
                        if (window.confirm(`Delete live input "${l.name}"?`)) void act({ action: "delete-live", uid: l.uid }, l.uid)
                      }}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!pending && !live.length && <p className="py-4 text-sm text-muted-foreground">{data?.ok ? "No live inputs. Create one and paste its address and key into OBS." : "Live inputs appear once Stream is reachable."}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
