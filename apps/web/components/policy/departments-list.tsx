"use client"

import * as React from "react"

import { type Department, departmentsOf } from "@/lib/data/departments"
import { matchesQuery } from "@/lib/search-match"
import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { agencySeal } from "@/lib/seals"
import { useScoped } from "@/lib/policy/use-scoped"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { RecordAvatar } from "@/components/policy/record-item"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { H2 } from "@/components/typeset"

// The departments doc, on the committees page's design: the search field,
// then the cards — seal, name, bill count — two to a row, grouped by kind.
// The list itself is on file; the bill counts come from the departments
// resource, which counts the session's bills that name each one.

export function DepartmentsList() {
  const { data, state, resolved } = useScoped<{ counts: Record<string, number> }>("departments", { counts: {} })
  const [query, setQuery] = React.useState("")
  const departments = React.useMemo(() => {
    const rows = departmentsOf(state)
    const term = query.trim()
    return term ? rows.filter((d) => matchesQuery(term, d.name, d.kind)) : rows
  }, [state, query])
  const groups = React.useMemo(() => {
    const order: Department["kind"][] = ["Department", "Agency", "Authority"]
    return order.map((kind) => [kind, departments.filter((d) => d.kind === kind).sort((a, b) => a.name.localeCompare(b.name))] as const).filter(([, rows]) => rows.length)
  }, [departments])
  const counts = data?.counts ?? {}
  const media = (d: Department) => {
    const seal = d.state === "US" ? agencySeal(d.name) : null
    return seal ? <RecordAvatar src={seal.file} shape={seal.shape} alt="" size={28} /> : <ChamberSeal state={state} chamber={null} size={28} />
  }
  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder={resolved ? `Search ${stateName(state)} departments by name…` : "Search departments by name…"} />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([kind, rows]) => (
          <section key={kind}>
            {/* The detail pages' H2 (Brendan, 2026-09-20), in place of the small muted label. */}
            <H2 className="mt-0 mb-6">{kind === "Department" ? "Departments" : kind === "Agency" ? "Agencies" : "Authorities"}</H2>
            <ProjectGrid>
              {rows.map((d) => {
                const bills = counts[d.slug]
                return <ProjectCard key={d.slug} href={`/departments/${d.slug}`} title={d.name} media={media(d)} meta={bills != null ? `${fmtNumber(bills)} Bills` : d.kind} />
              })}
            </ProjectGrid>
          </section>
        ))}
        {!groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">{resolved && departmentsOf(state).length === 0 ? `No departments on file for ${stateName(state)} yet.` : `No departments${query ? ` matching “${query}”` : ""}.`}</p>
        )}
      </div>
    </>
  )
}
