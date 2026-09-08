"use client"

import * as React from "react"
import { ClockIcon, EyeIcon, LibraryIcon, ListVideoIcon, MicIcon, PlayIcon, PlusIcon, RadioIcon, ScaleIcon, SearchIcon, UsersIcon, VideoIcon } from "lucide-react"

import { fmtDate, fmtNumber } from "@/lib/format"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import { cn } from "@govblock/ui/lib/utils"

// The video library, on shadcn v3's Music example (v3.shadcn.com/examples/music):
// a rail of collections down the left, a grid of cards under a Library/Live
// split, and the thing you picked playing above it. Music's album art becomes a
// still, its artist becomes the committee, its album becomes the sitting.
//
// Placeholder rows for now. congress.gov/committees/video is the real source and
// this page is not wired to it — every row below says so by carrying no id.

type Clip = {
  id: string
  title: string
  committee: string
  chamber: "House" | "Senate"
  date: string
  seconds: number
  views: number
  kind: "Hearing" | "Markup" | "Floor" | "Briefing"
  live?: boolean
}

const COLLECTIONS = [
  { label: "All video", icon: LibraryIcon, count: 24 },
  { label: "Hearings", icon: MicIcon, count: 11 },
  { label: "Markups", icon: ScaleIcon, count: 6 },
  { label: "Floor", icon: VideoIcon, count: 5 },
  { label: "Briefings", icon: UsersIcon, count: 2 },
]

const PLAYLISTS = ["Watch later", "This week in Ways and Means", "H.R. 1, start to finish", "Nomination hearings", "Clipped for the newsroom"]

/** Deterministic placeholders: fixed titles, dates and lengths, so the grid does not shuffle between renders. */
const CLIPS: Clip[] = [
  ["Ways and Means markup — H.R. 1", "Ways and Means", "House", "2026-09-03", 5412, 12840, "Markup"],
  ["Judiciary oversight — FBI", "Judiciary", "House", "2026-09-02", 8930, 30412, "Hearing"],
  ["Energy and Commerce — data privacy", "Energy and Commerce", "House", "2026-08-28", 6147, 9218, "Hearing"],
  ["Appropriations — Defense subcommittee", "Appropriations", "House", "2026-08-27", 11205, 4471, "Hearing"],
  ["Rules — H.Res. 1009", "Rules", "House", "2026-08-21", 2388, 1907, "Markup"],
  ["Finance — nomination hearing", "Finance", "Senate", "2026-08-19", 7016, 15330, "Hearing"],
  ["Agriculture — farm bill roundtable", "Agriculture", "Senate", "2026-08-14", 4502, 2280, "Briefing"],
  ["Homeland Security — border briefing", "Homeland Security", "Senate", "2026-08-12", 9240, 8114, "Briefing"],
  ["Veterans' Affairs — benefits backlog", "Veterans' Affairs", "House", "2026-08-07", 3875, 5602, "Hearing"],
  ["Foreign Relations — Indo-Pacific posture", "Foreign Relations", "Senate", "2026-08-05", 10133, 21008, "Hearing"],
  ["Floor — H.R. 4795 on passage", "Floor", "House", "2026-09-03", 1840, 44120, "Floor"],
  ["Floor — cloture on PN373", "Floor", "Senate", "2026-08-29", 2210, 18760, "Floor"],
].map(([title, committee, chamber, date, seconds, views, kind]) => ({
  id: `placeholder-${String(title).slice(0, 12).replace(/\W+/g, "-").toLowerCase()}`,
  title: title as string,
  committee: committee as string,
  chamber: chamber as Clip["chamber"],
  date: date as string,
  seconds: seconds as number,
  views: views as number,
  kind: kind as Clip["kind"],
}))

const LIVE: Clip[] = [
  { id: "placeholder-live-1", title: "Appropriations — Interior subcommittee, open session", committee: "Appropriations", chamber: "House", date: "2026-09-08", seconds: 0, views: 316, kind: "Hearing", live: true },
  { id: "placeholder-live-2", title: "Commerce — spectrum reauthorisation", committee: "Commerce", chamber: "Senate", date: "2026-09-08", seconds: 0, views: 92, kind: "Hearing", live: true },
]

const length = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`
}

/** The still: no frame is held yet, so the card draws the chamber's initial rather than a broken image. */
function Still({ clip, className }: { clip: Clip; className?: string }) {
  return (
    <div className={cn("relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted", className)}>
      <VideoIcon className="size-6 text-muted-foreground/60" />
      <span className="absolute top-2 left-2">
        <Badge variant="outline" className="h-5 bg-background/80 text-[10px] backdrop-blur">
          {clip.chamber}
        </Badge>
      </span>
      {clip.live ? (
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white">
          <RadioIcon className="size-3" />
          LIVE
        </span>
      ) : (
        <span className="absolute right-2 bottom-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] backdrop-blur">{length(clip.seconds)}</span>
      )}
    </div>
  )
}

function ClipCard({ clip, onPlay, active }: { clip: Clip; onPlay: () => void; active: boolean }) {
  return (
    <button type="button" onClick={onPlay} className={cn("group w-full space-y-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/60", active && "bg-muted")}>
      <Still clip={clip} />
      <div className="space-y-1">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{clip.title}</p>
        <p className="text-xs text-muted-foreground">
          {clip.committee} · {clip.live ? "now" : fmtDate(clip.date, false)}
        </p>
      </div>
    </button>
  )
}

export function VideosPage() {
  const [collection, setCollection] = React.useState(COLLECTIONS[0].label)
  const [query, setQuery] = React.useState("")
  const [playing, setPlaying] = React.useState<Clip>(CLIPS[0])

  const shown = React.useMemo(() => {
    const byCollection =
      collection === "All video"
        ? CLIPS
        : CLIPS.filter((c) => (collection === "Hearings" ? c.kind === "Hearing" : collection === "Markups" ? c.kind === "Markup" : collection === "Floor" ? c.kind === "Floor" : c.kind === "Briefing"))
    const q = query.trim().toLowerCase()
    return q ? byCollection.filter((c) => c.title.toLowerCase().includes(q) || c.committee.toLowerCase().includes(q)) : byCollection
  }, [collection, query])

  return (
    <div>
      <PageTitle
        title="Videos"
        endContent={
          <Button size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            Add video
          </Button>
        }
      />

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[13rem_1fr]">
        {/* The rail: collections, then the playlists, as Music lists them. */}
        <aside className="flex flex-col gap-6">
          <div className="space-y-1">
            <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Library</p>
            {COLLECTIONS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCollection(c.label)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                  collection === c.label && "bg-muted font-medium"
                )}
              >
                <c.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.label}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Playlists</p>
            {PLAYLISTS.map((p) => (
              <button key={p} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ListVideoIcon className="size-4 shrink-0" />
                <span className="truncate">{p}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Now playing: Music's player, at the size a video wants. */}
          <Card className="gap-3 overflow-hidden py-0">
            <div className="grid gap-4 p-4 sm:grid-cols-[18rem_1fr] sm:p-5">
              <Still clip={playing} />
              <div className="flex min-w-0 flex-col justify-center gap-2">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{playing.live ? "Live now" : "Now playing"}</p>
                <p className="text-lg leading-snug font-semibold">{playing.title}</p>
                <p className="text-sm text-muted-foreground">
                  {playing.committee} Committee · {playing.chamber} · {playing.live ? "in session" : fmtDate(playing.date)}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3.5" />
                    {playing.live ? "—" : length(playing.seconds)}
                  </span>
                  <span className="flex items-center gap-1">
                    <EyeIcon className="size-3.5" />
                    {fmtNumber(playing.views)} views
                  </span>
                  <Badge variant="outline" className="h-5">
                    {playing.kind}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-1.5" disabled>
                    <PlayIcon className="size-4" />
                    Play
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled>
                    <ListVideoIcon className="size-4" />
                    Add to playlist
                  </Button>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Placeholder. The library reads congress.gov/committees/video once it is wired.
                </p>
              </div>
            </div>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <LibraryIcon className="size-4" />
                <CardAnchor>{collection}</CardAnchor>
              </div>
              <CardDescription>Committee video, newest first. Pick one to load it above.</CardDescription>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="library">
                <div className="flex flex-wrap items-center gap-3">
                  <TabsList>
                    <TabsTrigger value="library">Library</TabsTrigger>
                    <TabsTrigger value="live">
                      Live
                      <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                        {LIVE.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                  <div className="relative ml-auto w-full sm:w-64">
                    <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search video by title or committee…" className="pl-8" />
                  </div>
                </div>
                <Separator className="my-4" />
                <TabsContent value="library">
                  {shown.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {shown.map((clip) => (
                        <ClipCard key={clip.id} clip={clip} active={clip.id === playing.id} onPlay={() => setPlaying(clip)} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nothing in {collection.toLowerCase()} matches &ldquo;{query}&rdquo;.</p>
                  )}
                </TabsContent>
                <TabsContent value="live">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {LIVE.map((clip) => (
                      <ClipCard key={clip.id} clip={clip} active={clip.id === playing.id} onPlay={() => setPlaying(clip)} />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
