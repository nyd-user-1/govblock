"use client"

import * as React from "react"

import { CONGRESS } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"
import { FlagChip } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// The committees list with a jurisdiction on every card (Brendan,
// 2026-09-09): the flag where the seal was, the name, and the headlines on
// file where the bill count was. Each card opens the jurisdiction's desk.
const headlines = (count: number | undefined) =>
  count
    ? `${fmtNumber(count)} ${count === 1 ? "Headline" : "Headlines"}`
    : "No headlines yet"

export function NewsIndex({ counts }: { counts: Record<string, number> }) {
  const [query, setQuery] = React.useState("")

  const groups = React.useMemo(() => {
    const q = query.trim()
    const rows = q
      ? JURISDICTIONS.filter((j) => matchesQuery(q, j.name, j.code))
      : JURISDICTIONS
    const federal = rows.filter((j) => j.code === CONGRESS)
    const states = rows.filter((j) => j.code !== CONGRESS)
    return [
      ["Congress", federal],
      ["States", states],
    ].filter(([, list]) => (list as typeof rows).length) as [
      string,
      typeof rows,
    ][]
  }, [query])

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        placeholder="Search desks by jurisdiction…"
      />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([group, rows]) => (
          <section key={group}>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              {group}
            </h3>
            <ProjectGrid>
              {rows.map((j) => (
                <ProjectCard
                  key={j.code}
                  href={`/news/${j.code.toLowerCase()}`}
                  title={j.name}
                  media={<FlagChip state={j.code} width={28} />}
                  meta={headlines(counts[j.code])}
                  feedHref={`/news/${j.code.toLowerCase()}/feed.xml`}
                />
              ))}
            </ProjectGrid>
          </section>
        ))}
        {!groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No desk
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </div>
    </>
  )
}
