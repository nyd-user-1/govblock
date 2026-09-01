"use client"

import * as React from "react"

import CODES from "@/lib/data/congress/committee-codes.json"
import * as F from "@/lib/fixtures"
import { committeeKey } from "@/lib/policy/congress"
import { useScoped } from "@/lib/policy/use-scoped"
import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// Ported from livingston-v3 components/committees-list.tsx — two columns at a
// 24px gap, cards all the same size: seal, name, bill count — with the search
// field the bills page has, so the two directory pages read the same.
type Committee = { committee_name: string; chamber: string; bills: number }

// A federal committee has a page of its own, keyed by the system code
// congress.gov gives it. `committees` does not carry the code yet, so the map
// committed beside the fixtures supplies it; a committee without one keeps the
// card's older destination, the bills before it.
const codeFor = (chamber: string, name: string): string | undefined =>
  (CODES as { byName: Record<string, string> }).byName[committeeKey(chamber, name)]

export function CommitteesList() {
  const { data, state, resolved } = useScoped<Committee[]>("committees", F.committeesAll)
  const [query, setQuery] = React.useState("")

  const committees = React.useMemo(() => {
    const rows = data ?? []
    const q = query.trim().toLowerCase()
    return q ? rows.filter((c) => c.committee_name.toLowerCase().includes(q)) : rows
  }, [data, query])

  const groups = React.useMemo(() => {
    const order = new Map<string, typeof committees>()
    for (const committee of committees) {
      const bucket = order.get(committee.chamber) ?? []
      bucket.push(committee)
      order.set(committee.chamber, bucket)
    }
    for (const bucket of order.values()) bucket.sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    return [...order.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [committees])

  return (
    <>
      <SearchDirectory
        query={query}
        registriesCount={committees.length}
        setQuery={(value) => setQuery(value ?? "")}
        noun="committee"
        // The shell is prerendered once for every reader, so it cannot name a
        // jurisdiction until it knows which one was asked for.
        placeholder={resolved ? `Search ${stateName(state)} committees by name…` : "Search committees by name…"}
      />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([chamber, rows]) => (
          <section key={chamber}>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">{chamber}</h3>
            <ProjectGrid>
              {rows.map((committee) => {
                const code = state === "US" ? codeFor(committee.chamber, committee.committee_name) : undefined
                return (
                <ProjectCard
                  key={`${committee.chamber}/${committee.committee_name}`}
                  href={code ? `/docs/committees/${code}` : `/docs/bills?state=${state}&committee=${encodeURIComponent(committee.committee_name)}`}
                  title={committee.committee_name}
                  media={<ChamberSeal state={state} chamber={committee.chamber} size={28} />}
                  meta={`${fmtNumber(committee.bills)} Bills`}
                  feedHref={`/docs/committee-feed.xml?state=${state}&committee=${encodeURIComponent(committee.committee_name)}`}
                />
                )
              })}
            </ProjectGrid>
          </section>
        ))}
        {!groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No committees for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </div>
    </>
  )
}
