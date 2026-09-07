"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { PreviewFrame } from "@/components/preview-frame"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// The card block every page shares (Brendan, 2026-09-05: "we are making
// reusable blocks"): the committee card — the seal, the name, one line
// beneath — two to a row in the preview frame, with a block's own control at
// the top right. A member's committees, a bill's committees and a
// jurisdiction's subjects all draw it. A long list shows its first rows and
// a See more button for the rest.

export type CardSpec = {
  key: string
  href: string
  title: string
  media?: React.ReactNode
  meta: React.ReactNode
}

export function CardBlock({
  cards,
  menu,
  initial,
  empty,
  framed = true,
}: {
  cards: CardSpec[]
  /** What sits at the block's top right: the Sessions menu, a Sort control. */
  menu?: React.ReactNode
  /** How many cards show before See more; every card when left out. */
  initial?: number
  empty?: React.ReactNode
  /** Off when the grid sits inside a tab of a frame the block already has. */
  framed?: boolean
}) {
  const [all, setAll] = React.useState(false)
  const shown = initial != null && !all ? cards.slice(0, initial) : cards
  const hidden = cards.length - shown.length
  const Frame = framed ? PreviewFrame : React.Fragment
  return (
    <Frame>
      {menu && <div className="flex items-center pb-4">{menu}</div>}
      {cards.length ? (
        <ProjectGrid>
          {shown.map((card) => (
            <ProjectCard key={card.key} href={card.href} title={card.title} media={card.media} meta={card.meta} />
          ))}
        </ProjectGrid>
      ) : (
        <p className="py-10 text-sm text-muted-foreground">{empty ?? "Nothing on file."}</p>
      )}
      {initial != null && cards.length > initial && (
        <div className="flex pt-4">
          <Button variant="outline" size="sm" onClick={() => setAll((open) => !open)}>
            {all ? "See fewer" : `See more (${fmtNumber(hidden)})`}
          </Button>
        </div>
      )}
    </Frame>
  )
}
