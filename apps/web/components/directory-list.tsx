"use client"

import * as React from "react"

import members from "@/lib/data/members-us.json"
import { useScoped } from "@/lib/policy/use-scoped"
import { memberHref, partyName, stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { SearchDirectory } from "@/components/directory-search"
import { ListPager, PAGE_SIZE, pageCount } from "@/components/list-pager"
import { MemberPortrait } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// Ported from livingston-v3 components/directory-list.tsx: every sitting
// member, fifty to a page, searchable by name, district or party. Each row is
// the canon item (Brendan, 2026-09-02 20:30 ET): portrait, name, the
// leadership title beside it, chamber · district · party beneath. The whole
// row is the link to the member page, which is where the record lives — the
// Record button that opened an unwired dialog of zeros is gone with it.

type Member = (typeof members)[number]

const matches = (m: Member, q: string) =>
  m.name.toLowerCase().includes(q) || (m.district ?? "").toLowerCase().includes(q) || partyName(m.party).toLowerCase().includes(q) || (m.chamber ?? "").toLowerCase().includes(q)

export function DirectoryList() {
  const { data, state, resolved } = useScoped<Member[]>("members", members)
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(1)

  // The page is "every sitting member": the roster is who sits this session.
  // Former members come back too — they sponsored the bills the rest of the app
  // links to — but they do not belong in a directory of the current chamber.
  const sitting = React.useMemo(() => (data ?? []).filter((m) => m.active), [data])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? sitting.filter((m) => matches(m, q)) : sitting
  }, [sitting, query])
  React.useEffect(() => setPage(1), [state])

  const pages = pageCount(rows.length)
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => {
          setQuery(value ?? "")
          setPage(1)
        }}
        placeholder={resolved ? `Search ${stateName(state)} members by name, district or party…` : "Search members by name, district or party…"}
      />
      <RecordList className="my-8">
        {shown.map((member) => (
          <RecordItem
            key={member.people_id}
            href={memberHref(member.people_id, state)}
            avatar={<MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={36} />}
            title={`${honorific(member.role, member.chamber)} ${member.name}`.trim()}
            lead={member.leadership_title}
            meta={[member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party)]}
          />
        ))}
        {!shown.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No members for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </RecordList>
      <ListPager page={current} pages={pages} onPage={setPage} />
    </>
  )
}
