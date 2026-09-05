"use client"

import * as React from "react"
import { LockIcon } from "lucide-react"

import type { Target } from "@/lib/create/path"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectGrid } from "@/components/project-card"
import { Button } from "@govblock/ui/components/nova/button"
import { CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// What /create opens on (Brendan, 2026-09-05, create.html): the datasets,
// each a card that entitles a reader to the whole of one. An unregistered
// reader has the two houses of Congress and, as the sample of a home state,
// New York's two houses; every other dataset wears a small lock in its top
// left corner until it is tied to its data and to a plan. Explore on an
// open card goes into that dataset as the large cards; Download and
// Upgrade are inert for now.

type Dataset = {
  key: string
  title: string
  seal: { kind: "chamber"; state: string; chamber: string } | { kind: "image"; src: string }
  open: boolean
  go?: Target
}

const DATASETS: Dataset[] = [
  { key: "us-house", title: "U.S. House", seal: { kind: "chamber", state: "US", chamber: "House" }, open: true, go: { state: "US", session: null, chamber: "House", at: "bills" } },
  { key: "us-senate", title: "U.S. Senate", seal: { kind: "chamber", state: "US", chamber: "Senate" }, open: true, go: { state: "US", session: null, chamber: "Senate", at: "bills" } },
  { key: "ny-assembly", title: "NYS Assembly", seal: { kind: "chamber", state: "NY", chamber: "Assembly" }, open: true, go: { state: "NY", session: null, chamber: "Assembly", at: "bills" } },
  { key: "ny-senate", title: "NYS Senate", seal: { kind: "chamber", state: "NY", chamber: "Senate" }, open: true, go: { state: "NY", session: null, chamber: "Senate", at: "bills" } },
  { key: "fec", title: "Federal Election Commission", seal: { kind: "image", src: "/seals/federal-election-commission.png" }, open: false },
  { key: "hud", title: "Housing & Urban Development", seal: { kind: "image", src: "/seals/department-of-housing-and-urban-development.png" }, open: false },
  { key: "irs", title: "Internal Revenue Service", seal: { kind: "image", src: "/chambers/us.png" }, open: false },
  { key: "opm", title: "Office of Personnel Management", seal: { kind: "image", src: "/seals/office-of-personnel-management.png" }, open: false },
  { key: "sba", title: "Small Business Administration", seal: { kind: "image", src: "/seals/small-business-administration.png" }, open: false },
  { key: "ssa", title: "Social Security Administration", seal: { kind: "image", src: "/seals/social-security-administration.png" }, open: false },
  { key: "gsa", title: "General Services Administration", seal: { kind: "image", src: "/seals/general-services-administration.png" }, open: false },
  { key: "dol", title: "Department of Labor", seal: { kind: "image", src: "/seals/department-of-labor.png" }, open: false },
]

function Seal({ seal }: { seal: Dataset["seal"] }) {
  if (seal.kind === "chamber") return <ChamberSeal state={seal.state} chamber={seal.chamber} size={96} />
  return (
    <span data-slot="chamber-seal" className="relative flex items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60" style={{ width: 96, height: 96 }}>
      {/* Plain <img>: the seals are the agencies' own files, not optimised assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={seal.src} alt="" className="h-full w-full object-contain p-0.5" />
    </span>
  )
}

export function DatasetGrid({ onGo }: { onGo: (go: Target) => void }) {
  return (
    <div className="p-6">
      <ProjectGrid className="xl:grid-cols-4">
        {DATASETS.map((d) => (
          <CardFrame key={d.key} id={`dataset-${d.key}`} data-open={d.open} className="relative">
            {!d.open && (
              <span className="absolute top-3 left-3 z-10 text-muted-foreground" title="Not yet in your plan">
                <LockIcon className="size-4" aria-label="Locked" />
              </span>
            )}
            <CardHeader>
              <CardTitle className="sr-only">{d.title}</CardTitle>
              <CardAction>
                <ComponentActions />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-4 text-center">
              <div className="flex items-center justify-center rounded-2xl bg-muted/60 p-4">
                <Seal seal={d.seal} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="cn-font-heading text-lg font-medium text-balance">{d.title}</div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center gap-2">
              <Button className="flex-1 rounded-2xl" disabled={!d.open} onClick={() => d.go && onGo(d.go)}>
                Explore
              </Button>
              <Button variant="outline" className="flex-1 rounded-2xl" disabled={!d.open}>
                {d.open ? "Download" : "Upgrade"}
              </Button>
            </CardFooter>
          </CardFrame>
        ))}
      </ProjectGrid>
    </div>
  )
}
