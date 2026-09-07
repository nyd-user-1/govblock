"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ChamberPills } from "@/components/chamber-pills"
import { Button } from "@govblock/ui/components/button"
import { CardFooter } from "@govblock/ui/components/card"

// The standard foot of a home card (Brendan, 2026-09-07): the chamber pills
// at the left where the card has a chamber to pick, and the circle arrow at
// the right, into the card's own page — right at rest, up-right on hover.
export function CardFoot({
  chamber,
  onChamber,
  href,
  label,
  children,
}: {
  chamber?: string
  onChamber?: (chamber: string) => void
  href: string
  label: string
  /** Anything else the foot carries at the left, in place of the pills. */
  children?: React.ReactNode
}) {
  return (
    <CardFooter className="justify-between gap-2">
      {onChamber ? <ChamberPills value={chamber ?? ""} onChange={onChamber} /> : (children ?? <span />)}
      <Button variant="outline" size="icon" aria-label={label} title={label} className="group/foot shrink-0 rounded-full" nativeButton={false} render={<Link href={href} />}>
        <ArrowRight className="transition-transform duration-200 group-hover/foot:-rotate-45" />
      </Button>
    </CardFooter>
  )
}
