"use client"

import * as React from "react"

import { ShowMore } from "@/components/gdelt/sections"

// A card with a picture (Brendan, 2026-09-16: the shared project card is a
// fixed-height tile with a small emblem beside its title, and a full-width
// image tore straight out of it). Picture on top at a constant ratio, the title
// clamped to two lines, one meta line, every card in a row the same height.

export type GdeltCard = {
  key: string
  href: string
  title: string
  meta: string
  /** Drawn in the picture area: an image, an emblem, or GovBlock's mark. */
  media: React.ReactNode
}

export function GdeltCards({ cards, initial = 4, noun = "more" }: { cards: GdeltCard[]; initial?: number; noun?: string }) {
  if (!cards.length) return <p className="text-sm text-muted-foreground">Nothing in the snapshot.</p>
  return (
    <ShowMore initial={initial} noun={noun} className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <a
          key={card.key}
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group/card flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card no-underline transition-colors hover:bg-accent/40"
        >
          <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-muted">{card.media}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
            <span className="line-clamp-2 text-sm font-medium break-words text-foreground">{card.title}</span>
            <span className="mt-auto truncate font-mono text-xs text-muted-foreground">{card.meta}</span>
          </span>
        </a>
      ))}
    </ShowMore>
  )
}
