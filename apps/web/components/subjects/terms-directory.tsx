"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { tagLetter } from "@/lib/data/tags"
import {
  subjectKind,
  subjectSlug,
  type SubjectKind,
} from "@/lib/policy/subject-kinds"
import { useScoped } from "@/lib/policy/use-scoped"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { FlagLoader } from "@/components/flag-loader"
import { HeadingAnchor } from "@/components/heading-anchor"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { cn } from "@govblock/ui/lib/utils"

// The tags index (Brendan, 2026-09-16, on daily.dev's shape in our own parts):
// the search field, the official sources behind the tags, a letter to jump to,
// the three lists that say what is moving, what is biggest and what is newest,
// then a section per letter with the tags four across. The jurisdiction's own
// filing — the Congressional Research Service's policy areas and legislative
// subjects — keeps its card grid, at the foot where the sources link to it.
// Policy Areas and Legislative Subjects mount this too, and get the cards alone.
type Term = { name: string; bills: number }
type Terms = { policyAreas: Term[]; subjects: Term[]; bills: number }
type TagRow = { slug: string; name: string; blurb: string; bills: number; recent: number; firstSeen: string }
const EMPTY: Terms = { policyAreas: [], subjects: [], bills: 0 }
const NO_TAGS: TagRow[] = []

const KIND_LABEL: Record<SubjectKind, string> = {
  general: "General",
  organization: "Organizations",
  geographic: "Geographic",
}
const KIND_ORDER: SubjectKind[] = ["general", "organization", "geographic"]

export type TermsKind = "policy" | "legislative" | "all"

const POLICY_BASE = "/policy-areas"
const SUBJECT_BASE = "/legislative-subjects"

const NOUN: Record<TermsKind, string> = {
  policy: "policy areas",
  legislative: "legislative subjects",
  all: "tags",
}

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"]
/** How many tags a letter shows before it offers the rest. */
const PER_LETTER = 40

export function TermsDirectory({ kind }: { kind: TermsKind }) {
  const { data, state, resolved, pending } = useScoped<Terms>("subject-terms", EMPTY)
  const tags = useScoped<TagRow[]>(kind === "all" ? "tags" : null, NO_TAGS)
  const [query, setQuery] = React.useState("")
  const [letter, setLetter] = React.useState("ALL")
  const [opened, setOpened] = React.useState<Set<string>>(new Set())

  const rows = tags.data ?? []
  const q = query.trim()

  // Each group carries where its terms live. A policy area and a legislative
  // subject are not the same thing — the Congressional Research Service assigns
  // exactly one policy area to a bill and any number of subjects — so a term's
  // page is filed under the kind it is, and the group already knows which.
  const groups = React.useMemo<[string, Term[], string][]>(() => {
    const keep = (list: Term[]) =>
      (q ? list.filter((t) => matchesQuery(q, t.name)) : list).slice().sort((a, b) => a.name.localeCompare(b.name))
    const policy = keep(data?.policyAreas ?? [])
    const subjects = keep(data?.subjects ?? [])
    const out: [string, Term[], string][] = []
    if (kind !== "legislative") out.push(["Policy Areas", policy, POLICY_BASE])
    if (kind === "legislative") {
      for (const k of KIND_ORDER)
        out.push([KIND_LABEL[k], subjects.filter((t) => subjectKind(t.name) === k), SUBJECT_BASE])
    } else if (kind === "all") out.push(["Legislative Subjects", subjects, SUBJECT_BASE])
    return out.filter(([, list]) => list.length)
  }, [data, kind, q])

  // A section per letter, in letter order, of the tags that survive the search.
  const sections = React.useMemo<[string, TagRow[]][]>(() => {
    const kept = q ? rows.filter((t) => matchesQuery(q, t.name)) : rows
    return LETTERS.map((l) => [l, kept.filter((t) => tagLetter(t.name) === l)] as [string, TagRow[]])
      .filter(([l, list]) => list.length > 0 && (letter === "ALL" || letter === l))
  }, [rows, q, letter])

  const filled = React.useMemo(() => new Set(rows.map((t) => tagLetter(t.name))), [rows])
  const href = (slug: string) => `/tags/${slug}?state=${state}`
  const lists: [string, TagRow[]][] = [
    ["Trending tags", [...rows].sort((a, b) => b.recent - a.recent || b.bills - a.bills).filter((t) => t.recent > 0).slice(0, 8)],
    ["Popular tags", [...rows].sort((a, b) => b.bills - a.bills).slice(0, 8)],
    ["Recently added tags", [...rows].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.bills - a.bills).slice(0, 8)],
  ]
  const loading = !resolved || pending || (kind === "all" && tags.pending)

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        // The shell is prerendered once for every reader, so it cannot name a
        // jurisdiction until it knows which one was asked for.
        placeholder={resolved ? `Search ${stateName(state)} ${NOUN[kind]} by name…` : `Search ${NOUN[kind]} by name…`}
      />

      {kind === "all" && (
        <>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Official Sources:</span>
            <a href="#legislative-subjects" className="no-underline hover:underline">
              Legislative Subjects
            </a>
            <a href="#policy-areas" className="no-underline hover:underline">
              Policy Areas
            </a>
          </p>

          <nav aria-label="Tags by letter" className="mt-5 flex flex-wrap items-center justify-center gap-1">
            {["ALL", ...LETTERS].map((l) => {
              const dead = l !== "ALL" && !filled.has(l)
              return (
                <button
                  key={l}
                  type="button"
                  disabled={dead}
                  aria-pressed={letter === l}
                  onClick={() => setLetter(l)}
                  className={cn(
                    "h-8 min-w-8 cursor-pointer rounded-md px-2 text-sm font-medium transition-colors",
                    letter === l ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    dead && "cursor-default text-muted-foreground/40 hover:bg-transparent hover:text-muted-foreground/40"
                  )}
                >
                  {l}
                </button>
              )
            })}
          </nav>

          {letter === "ALL" && !q && lists.some(([, list]) => list.length > 0) && (
            <>
              <hr className="mt-8 mb-8 border-border" />
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {lists.map(([label, list]) => (
                  <section key={label}>
                    <h3 className="mb-4 text-base font-semibold">
                      <HeadingAnchor id={subjectSlug(label)}>{label}</HeadingAnchor>
                    </h3>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                      {list.map((t) => (
                        <li key={t.slug} className="m-0 p-0">
                          <a href={href(t.slug)} className="no-underline hover:underline">
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}

          {/* A section per letter, the tags four across, as daily.dev files them. */}
          <div className="mt-12 flex flex-col gap-12">
            {sections.map(([l, list]) => {
              const all = opened.has(l) || list.length <= PER_LETTER
              const shown = all ? list : list.slice(0, PER_LETTER)
              return (
                <section key={l}>
                  <h3 className="mb-6 flex items-center gap-4 text-2xl font-semibold">
                    <HeadingAnchor id={`letter-${l === "#" ? "other" : l.toLowerCase()}`}>{l}</HeadingAnchor>
                    <span className="h-px flex-1 bg-border" />
                  </h3>
                  <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-3 p-0 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    {shown.map((t) => (
                      <li key={t.slug} className="m-0 min-w-0 p-0">
                        <a href={href(t.slug)} title={`${fmtNumber(t.bills)} bills`} className="block truncate no-underline hover:underline">
                          {t.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {!all && (
                    <button
                      type="button"
                      onClick={() => setOpened((prev) => new Set(prev).add(l))}
                      className="mt-4 cursor-pointer text-sm text-muted-foreground hover:underline"
                    >
                      Show all {fmtNumber(list.length)} tags
                    </button>
                  )}
                </section>
              )
            })}
          </div>

          {loading && (
            <div className="flex justify-center py-16">
              <FlagLoader width={96} />
            </div>
          )}
          {!loading && !sections.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tags for {stateName(state)}
              {q ? ` matching “${q}”` : ""}
              {letter !== "ALL" ? ` under ${letter}` : ""}.
            </p>
          )}
        </>
      )}

      {/* The record's own filing, at the foot: the cards /datasets and the
          committees wear, one per term. */}
      <div className="my-12 flex flex-col gap-10">
        {kind === "all" && groups.length > 0 && <hr className="border-border" />}
        {groups.map(([group, list, base]) => (
          <section key={group} id={subjectSlug(group)} className="scroll-mt-24">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              <HeadingAnchor id={subjectSlug(group)}>{group}</HeadingAnchor>
            </h3>
            <ProjectGrid>
              {list.map((term) => (
                <ProjectCard
                  key={term.name}
                  href={`${base}/${state.toLowerCase()}/${subjectSlug(term.name)}?state=${state}`}
                  title={term.name}
                  media={<ChamberSeal state={state} size={28} />}
                  meta={`${fmtNumber(term.bills)} ${term.bills === 1 ? "Bill" : "Bills"}`}
                  feedHref={`/docs/subject-feed.xml?state=${state}&term=${encodeURIComponent(term.name)}`}
                />
              ))}
            </ProjectGrid>
          </section>
        ))}
        {kind !== "all" && loading && (
          <div className="flex justify-center py-16">
            <FlagLoader width={96} />
          </div>
        )}
        {kind !== "all" && !loading && !groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {NOUN[kind]} for {stateName(state)}
            {q ? ` matching “${q}”` : ""}.
          </p>
        )}
      </div>
    </>
  )
}
