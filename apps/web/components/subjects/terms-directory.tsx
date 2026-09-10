"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import {
  subjectKind,
  subjectSlug,
  type SubjectKind,
} from "@/lib/policy/subject-kinds"
import { useScoped } from "@/lib/policy/use-scoped"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// The committees list for subject terms (Brendan, 2026-09-09: "they both
// need to match this design pattern"): the search field, then groups of
// cards two across — the jurisdiction's seal, the term, its bill count —
// each opening the term's page. Three pages draw on it: Policy Areas, the
// one fixed few dozen; Legislative Subjects, grouped as the subjects doc
// splits them; and /tags, both together.
type Term = { name: string; bills: number }
type Terms = { policyAreas: Term[]; subjects: Term[]; bills: number }
const EMPTY: Terms = { policyAreas: [], subjects: [], bills: 0 }

const KIND_LABEL: Record<SubjectKind, string> = {
  general: "General",
  organization: "Organizations",
  geographic: "Geographic",
}
const KIND_ORDER: SubjectKind[] = ["general", "organization", "geographic"]

export type TermsKind = "policy" | "legislative" | "all"

const NOUN: Record<TermsKind, string> = {
  policy: "policy areas",
  legislative: "legislative subjects",
  all: "tags",
}

export function TermsDirectory({ kind }: { kind: TermsKind }) {
  const { data, state, resolved } = useScoped<Terms>("subject-terms", EMPTY)
  const [query, setQuery] = React.useState("")

  const groups = React.useMemo<[string, Term[]][]>(() => {
    const q = query.trim()
    const keep = (rows: Term[]) =>
      (q ? rows.filter((t) => matchesQuery(q, t.name)) : rows)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
    const policy = keep(data?.policyAreas ?? [])
    const subjects = keep(data?.subjects ?? [])
    const out: [string, Term[]][] = []
    if (kind !== "legislative") out.push(["Policy Areas", policy])
    if (kind === "legislative") {
      for (const k of KIND_ORDER)
        out.push([
          KIND_LABEL[k],
          subjects.filter((t) => subjectKind(t.name) === k),
        ])
    } else if (kind === "all") out.push(["Legislative Subjects", subjects])
    return out.filter(([, rows]) => rows.length)
  }, [data, kind, query])

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        // The shell is prerendered once for every reader, so it cannot name a
        // jurisdiction until it knows which one was asked for.
        placeholder={
          resolved
            ? `Search ${stateName(state)} ${NOUN[kind]} by name…`
            : `Search ${NOUN[kind]} by name…`
        }
      />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([group, rows]) => (
          <section key={group}>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              {group}
            </h3>
            <ProjectGrid>
              {rows.map((term) => (
                <ProjectCard
                  key={term.name}
                  href={`/docs/subjects/${state.toLowerCase()}/${subjectSlug(term.name)}?state=${state}`}
                  title={term.name}
                  media={<ChamberSeal state={state} size={28} />}
                  meta={`${fmtNumber(term.bills)} ${term.bills === 1 ? "Bill" : "Bills"}`}
                  feedHref={`/docs/subject-feed.xml?state=${state}&term=${encodeURIComponent(term.name)}`}
                />
              ))}
            </ProjectGrid>
          </section>
        ))}
        {!groups.length && resolved && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {NOUN[kind]} for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </div>
    </>
  )
}
