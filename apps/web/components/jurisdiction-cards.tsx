"use client"

import * as React from "react"

import { flagUrl } from "@/lib/filters"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// /bills and /desk (Brendan, 2026-09-11): the record is scoped per
// jurisdiction, so each index is the 52 jurisdictions — Congress first, then the states and
// the District A–Z — on the committees page's cards with the flag where the
// seal sits and nothing under the name. Each opens /bills/us, /bills/ny,
// /bills/nj; who may open one is the page's business (`BillsGate`).

export function JurisdictionCards({ base = "/bills" }: { /** Where a jurisdiction's page lives: /bills, /desk. */ base?: string }) {
  const rows = [...JURISDICTIONS.filter((j) => j.code === "US"), ...JURISDICTIONS.filter((j) => j.code !== "US")]
  return (
    <ProjectGrid data-not-typeset="true" className="mt-2">
      {rows.map((j) => (
        <ProjectCard
          key={j.code}
          href={`${base}/${j.code.toLowerCase()}`}
          title={j.name}
          media={
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flagUrl(j.code)} alt="" width={40} height={27} className="h-7 w-10 shrink-0 rounded-sm object-cover ring-1 ring-border" />
          }
          meta={null}
          arrow
        />
      ))}
    </ProjectGrid>
  )
}
