import { stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"

import { PartyDot } from "@/components/policy/imagery"
import { MemberOffice, MemberOfficialPortrait } from "@/components/policy/member-congress"

// Ported from livingston-v3 components/policy/member-page.tsx. There was no
// member page: every surface that named a member stopped at the name. This is
// where they all point now — `memberHref` has been writing /docs/directory/<id>
// since the directory landed, and until today it went nowhere.
//
// Server components, deliberately, as in v3: the path names exactly one
// person, so a shared link, a crawler and a reader with slow JS all see who it
// is. The portrait and the tabs are the client pieces.


export function MemberHeader({
  peopleId,
  state,
  member,
  action,
}: {
  peopleId: number
  state: string
  member: Record<string, unknown>
  /** The Copy Page control, so it top-aligns with the name as /docs/bills does. */
  action?: React.ReactNode
}) {
  const name = String(member.name ?? "")
  const role = String(member.role ?? "")
  const chamber = String(member.chamber ?? "")
  const party = member.party ? String(member.party) : null
  const leadership = member.leadership_title ? String(member.leadership_title) : null
  const district = member.district ? String(member.district).replace(/^[A-Z]+-0*/, "District ") : null

  return (
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:gap-6">
      <MemberOfficialPortrait
        name={name}
        fallback={member.photo_url ? String(member.photo_url) : null}
        state={state}
        chamber={chamber}
        size={80}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {honorific(role, chamber)} {name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {leadership && (
            <>
              <span className="font-medium text-foreground">{leadership}</span>
              <span>•</span>
            </>
          )}
          {district && (
            <>
              <span>{district}</span>
              <span>•</span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <PartyDot party={party} />({party ?? "—"})
          </span>
          <span>•</span>
          {/* "Congress House" is not a thing anyone says. Every other
              jurisdiction reads "New York Assembly"; the federal one reads
              "U.S. House". */}
          <span>{state === "US" ? `U.S. ${chamber}` : `${stateName(state)} ${chamber}`}</span>
        </p>
        {/* The counts used to live here and are now on the Record pills, which
            is where someone looking for them goes. The office takes the space:
            it is the one thing about a member this page knew and never said. */}
        <MemberOffice />
      </div>
      {action && <div className="docs-nav hidden shrink-0 sm:block">{action}</div>}
      <span className="sr-only">{peopleId}</span>
    </header>
  )
}
