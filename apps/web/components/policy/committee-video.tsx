"use client"

import * as React from "react"

import { fmtDate } from "@/lib/format"
import type { LatestHearing } from "@/lib/policy/committee-video"

// The committee's latest hearing, at the top of the rail.
//
// Click-to-play, not autoplay: no browser will autoplay with sound anyway, and
// a muted video starting by itself in a sidebar is worse than a thumbnail. The
// poster is YouTube's own still, which costs nothing to show, and the iframe is
// only created once someone asks for it — so a committee page carries no
// third-party player, no cookies from one, and no request to youtube.com until
// a reader clicks.
//
// Every non-video state says what WE lack. That is the canon Brendan set after
// the office block rendered nothing for 553 members and nobody noticed: "no
// channel mapped yet" is a true sentence about us and a visible piece of
// unfinished work, where an absent card is neither, and "this committee has no
// hearings" would be a lie about them.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="text-xs font-medium text-muted-foreground">Latest hearing</div>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

export function CommitteeVideo({ latest }: { latest: LatestHearing }) {
  const [playing, setPlaying] = React.useState(false)

  if (latest.kind === "unmapped")
    return (
      <Frame>
        <Note>No YouTube channel is mapped for this committee yet.</Note>
      </Frame>
    )

  if (latest.kind === "unconfigured")
    return (
      <Frame>
        <Note>The video key is not configured, so we cannot look one up.</Note>
      </Frame>
    )

  if (latest.kind === "empty")
    return (
      <Frame>
        <Note>The channel we have mapped ({latest.channel}) has nothing posted yet.</Note>
      </Frame>
    )

  if (latest.kind === "failed")
    return (
      <Frame>
        <Note>We could not read {latest.channel} just now — {latest.reason}</Note>
      </Frame>
    )

  return (
    <Frame>
      <div className="relative overflow-hidden rounded-lg bg-muted">
        {playing ? (
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${latest.id}?autoplay=1&rel=0`}
            title={latest.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${latest.title}`}
            className="group relative block aspect-video w-full"
          >
            <img
              src={`https://i.ytimg.com/vi/${latest.id}/hqdefault.jpg`}
              alt=""
              data-not-typeset=""
              className="absolute inset-0 size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/70 text-white">
                <svg viewBox="0 0 24 24" className="ml-0.5 size-5" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
            {latest.live && (
              <span className="absolute top-2 left-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                Live
              </span>
            )}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs leading-snug font-medium">{latest.title}</span>
        <span className="text-xs text-muted-foreground">
          {latest.publishedAt ? fmtDate(latest.publishedAt.slice(0, 10), false) : "date unknown"} ·{" "}
          {latest.channel}
        </span>
        {/* The channel is often one party's rather than the committee's, so the
            name is not decoration: it is how a reader knows whose feed this is. */}
      </div>
    </Frame>
  )
}
