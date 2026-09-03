"use client"

import * as React from "react"

import { memberHref, partyName, stateName } from "@/lib/filters"
import { fmtNumber, honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { memberInScope, useScope } from "@/lib/policy/scope"
import type { MemberRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { EditDetailsDialog, ProjectCard, useProjectDetails, type ProjectDetails } from "@/components/project-card"
import {
  RailAndCards,
  type RailGroup,
} from "@/components/policy/rail-and-cards"
import { Badge } from "@govblock/ui/components/nova/badge"

// Chamber — the third instance of the rail-and-cards shell. Rail = chamber,
// then party; cards = the people who sit there, on the same card the
// committees wear (Brendan, 2026-09-03: "all these cards should have the same
// styling/treatment as do the cards on /docs/committees") — the portrait, the
// name, one meta line, and the ⋮ menu with Pin, Edit details, Subscribe and
// Alert. Pinned members float to the front.

const ALL = "__all__"

export function ChamberBoard() {
  // The rail's scope: the jurisdiction, and whatever narrows it.
  const { state, session, filters } = useScope()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")
  const { data, isLoading } = usePolicy<MemberRow[]>("members", { state, session: filters.session })
  const { pinned, togglePin, details, setDetails } = useProjectDetails(`members:${state}`)
  const [editing, setEditing] = React.useState<string | null>(null)

  const sitting = React.useMemo(
    () => (data ?? []).filter((member) => member.active && memberInScope(member, filters)),
    [data, filters]
  )

  const rows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const rank = (id: string) => {
      const index = pinned.indexOf(id)
      return index < 0 ? Infinity : index
    }
    return sitting
      .filter((member) => {
        if (selected !== ALL) {
          const [kind, value] = selected.split(":")
          if (kind === "chamber" && member.chamber !== value) return false
          if (kind === "party" && (member.party || "I") !== value) return false
        }
        if (!query) return true
        return (
          member.name.toLowerCase().includes(query) ||
          (member.district ?? "").toLowerCase().includes(query)
        )
      })
      .sort((a, b) => rank(String(a.people_id)) - rank(String(b.people_id)))
  }, [sitting, search, selected, pinned])

  const groups = React.useMemo<RailGroup[]>(() => {
    const chambers = [
      ...new Set(sitting.map((m) => m.chamber).filter(Boolean)),
    ].sort()
    const parties = [...new Set(sitting.map((m) => m.party || "I"))].sort()
    return [
      {
        label: "Chambers",
        items: [
          { value: ALL, label: "Every member", hint: String(sitting.length) },
          ...chambers.map((chamber) => ({
            value: `chamber:${chamber}`,
            label: chamber,
            hint: String(sitting.filter((m) => m.chamber === chamber).length),
          })),
        ],
      },
      {
        label: "Parties",
        items: parties.map((party) => ({
          value: `party:${party}`,
          label: partyName(party) || party,
          hint: String(
            sitting.filter((m) => (m.party || "I") === party).length
          ),
        })),
      },
    ]
  }, [sitting])

  return (
    <RailAndCards
      groups={groups}
      selected={selected}
      onSelect={(value) =>
        setSelected((current) => (current === value ? ALL : value))
      }
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search members…"
      className="gap-6 p-6 xl:grid-cols-2"
      header={
        <>
          <span className="text-sm font-medium">
            {stateName(state)} members
          </span>
          <Badge variant="outline" className="font-normal">
            {fmtNumber(rows.length)} · {session} session
          </Badge>
        </>
      }
    >
      {rows.map((member) => {
        const id = String(member.people_id)
        const detail = details[id] ?? {}
        return (
          <ProjectCard
            key={id}
            href={memberHref(member.people_id, state)}
            title={detail.label || `${honorific(member.role, member.chamber)} ${member.name}`}
            note={detail.note}
            media={
              <span className="relative">
                <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={28} />
                <PartyDot party={member.party} serving={member.active} className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-card" />
              </span>
            }
            meta={[member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party), member.leadership_title].filter(Boolean).join(" · ")}
            menu={{
              pinned: pinned.includes(id),
              onPin: () => togglePin(id),
              onEdit: () => setEditing(id),
              feedHref: `/docs/member-feed.xml?state=${state}&member=${member.people_id}`,
            }}
          />
        )
      })}
      {!rows.length && (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `No members for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}
        </p>
      )}
      <EditDetailsDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        id={editing}
        fallbackLabel={editing ? (sitting.find((m) => String(m.people_id) === editing)?.name ?? editing) : ""}
        value={(editing ? details[editing] : undefined) ?? {}}
        onSave={(next: ProjectDetails) => setDetails((current) => ({ ...current, [editing ?? ""]: next }))}
      />
    </RailAndCards>
  )
}
