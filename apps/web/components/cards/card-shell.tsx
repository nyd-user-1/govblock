import * as React from "react"

import { Card, CardAction, CardHeader, CardTitle } from "@govblock/ui/components/card"

// The shell a card wears when it stands alone — outside the site's frame,
// with its gates and grid cell (2026-09-12). A card's body takes `title` and
// `action`, so the site can hand it the anchor-copy title and the ⋮ menu and
// a consumer gets a plain title and nothing at the right.

/** The public origin, for a consumer whose app does not serve the record itself. */
export const SITE = "https://gov.nysgpt.com"

export function CardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={className}>{children}</Card>
}

export function CardHead({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <CardHeader>
      {typeof title === "string" ? <CardTitle>{title}</CardTitle> : title}
      {action && <CardAction>{action}</CardAction>}
    </CardHeader>
  )
}

/** What every portable card body takes besides its rows. */
export type CardBodyProps = {
  /** The jurisdiction the rows belong to; seals and the chamber pills read it. */
  state?: string
  title?: React.ReactNode
  action?: React.ReactNode
  /** Where the foot's arrow goes; the site's own page by default. */
  href?: string
}
