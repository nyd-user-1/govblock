"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Committee } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { ChamberSeal } from "@/components/policy/imagery"
import {
  EditDetailsDialog,
  ProjectCard,
  useProjectDetails,
  type ProjectDetails,
} from "@/components/project-card"
import {
  RailAndCards,
  type RailGroup,
} from "@/components/policy/rail-and-cards"
import { Badge } from "@govblock/ui/components/nova/badge"

// The rail-and-cards shape's first instance: Committees. Lives here rather
// than in a block so both registries' sidebar-12 render the same thing.
//
// Brendan took the month calendar out of this block and saw the general form
// — a rail of categories on the left, a grid of appropriately sized cards on
// the right — and said it suits the many kinds of thing we hold. So the shape
// is `components/policy/rail-and-cards.tsx` and this page is one instance of
// it. Members, bills, reports, PDFs, forms and applications are the same
// shape with a different rail and a different card.

const ALL = "__all__"

export function CommitteesBoard() {
  const { state, session } = useJurisdiction()
  const scope = { state }
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")

  const { data: committees } = usePolicy<Committee[]>("committees", scope)
  const { pinned, togglePin, details, setDetails } = useProjectDetails(
    `committees:${state}`
  )
  const [editing, setEditing] = React.useState<string | null>(null)

  const rows = React.useMemo(() => {
    const all = committees ?? []
    const query = search.trim().toLowerCase()
    const rank = (name: string) => {
      const index = pinned.indexOf(name)
      return index < 0 ? Infinity : index
    }
    return all
      .filter((committee) => {
        const name = committee.committee_name ?? ""
        if (query && !name.toLowerCase().includes(query)) return false
        if (selected === ALL) return true
        return (committee.chamber ?? "") === selected
      })
      .sort(
        (a, b) =>
          rank(a.committee_name) - rank(b.committee_name) ||
          a.committee_name.localeCompare(b.committee_name)
      )
  }, [committees, pinned, search, selected])

  const groups = React.useMemo<RailGroup[]>(() => {
    const chambers = [
      ...new Set(
        (committees ?? []).map((c) => c.chamber ?? "").filter(Boolean)
      ),
    ].sort()
    return [
      {
        label: "Chambers",
        items: [
          {
            value: ALL,
            label: "Every committee",
            hint: String((committees ?? []).length),
          },
          ...chambers.map((chamber) => ({
            value: chamber,
            label: chamber,
            hint: String(
              (committees ?? []).filter((c) => c.chamber === chamber).length
            ),
          })),
        ],
      },
      {
        label: "Committees",
        items: (committees ?? [])
          .filter((c) => selected === ALL || c.chamber === selected)
          .map((committee) => ({
            value: committee.committee_name,
            label: committee.committee_name,
            hint: fmtNumber(committee.bills ?? 0),
          })),
      },
    ]
  }, [committees, selected])

  return (
    <RailAndCards
      groups={groups}
      selected={selected}
      onSelect={(value) =>
        setSelected((current) => (current === value ? ALL : value))
      }
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search committees…"
      className="gap-6 p-6 xl:grid-cols-2"
      header={
        <>
          <span className="text-sm font-medium">
            {stateName(state)} committees
          </span>
          <Badge variant="outline" className="font-normal">
            {fmtNumber(rows.length)} · {session} session
          </Badge>
        </>
      }
    >
      {rows.map((committee) => {
        const id = committee.committee_name
        const detail = details[id] ?? {}
        return (
          <ProjectCard
            key={id}
            href={`/docs/bills?state=${state}&committee=${encodeURIComponent(
              committee.committee_name
            )}`}
            title={detail.label || committee.committee_name}
            note={detail.note}
            media={
              <ChamberSeal
                state={state}
                chamber={committee.chamber}
                size={28}
              />
            }
            meta={`${fmtNumber(committee.bills ?? 0)} Bills`}
            menu={{
              pinned: pinned.includes(id),
              onPin: () => togglePin(id),
              onEdit: () => setEditing(id),
              feedHref: `/docs/committee-feed.xml?state=${state}&committee=${encodeURIComponent(
                committee.committee_name
              )}`,
            }}
          />
        )
      })}
      {!rows.length && (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          No committees for {stateName(state)}
          {search ? ` matching “${search}”` : ""}.
        </p>
      )}
      <EditDetailsDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        id={editing}
        fallbackLabel={editing ?? ""}
        value={(editing ? details[editing] : undefined) ?? {}}
        onSave={(next: ProjectDetails) =>
          setDetails((current) => ({ ...current, [editing ?? ""]: next }))
        }
      />
    </RailAndCards>
  )
}
