"use client"

import * as React from "react"

import { type Department, departmentsOf } from "@/lib/data/departments"
import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { agencySeal } from "@/lib/seals"
import { useScoped } from "@/lib/policy/use-scoped"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { RecordAvatar } from "@/components/policy/record-item"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// The departments doc, on the committees page's design: the search field,
// then the cards — seal, name, bill count — two to a row, grouped by kind.
// The list itself is on file; the bill counts come from the departments
// resource, which counts the session's bills that name each one.

export function DepartmentsList() {
  const { data, state, resolved } = useScoped<{ counts: Record<string, number> }>("departments", { counts: {} })
  const [query, setQuery] = React.useState("")
  const departments = React.useMemo(() => {
    const rows = departmentsOf(state)
    const term = query.trim().toLowerCase()
    return term ? rows.filter((d) => d.name.toLowerCase().includes(term)) : rows
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
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">{kind === "Department" ? "Departments" : kind === "Agency" ? "Agencies" : "Authorities"}</h3>
            <ProjectGrid>
              {rows.map((d) => {
                const bills = counts[d.slug]
                return <ProjectCard key={d.slug} href={`/docs/departments/${d.slug}`} title={d.name} media={media(d)} meta={bills != null ? `${fmtNumber(bills)} Bills` : d.kind} />
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
