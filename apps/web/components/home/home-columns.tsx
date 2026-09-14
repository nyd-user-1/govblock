"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, ChevronRight, Columns2, History, MoreHorizontal, Plus, Radar, Tag, Trash2 } from "lucide-react"

import { AGENTS } from "@/lib/agents/registry"
import { useAccount } from "@/lib/auth/use-account"
import { CONGRESS, memberHref, STATE_CODES, stateName } from "@/lib/filters"
import { geoUrl } from "@/lib/map/geo-url"
import { representationAt, type Representation } from "@/lib/map/join"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { MemberRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { chambersOf } from "@/lib/workspace/datasets"
import { ChamberSeal, FlagChip } from "@/components/policy/imagery"
import { clearRecents, useRecents } from "@/components/home/recents"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"
import { Separator } from "@govblock/ui/components/nova/separator"

// The columns under the search, as Cloudflare's account home has them
// (Brendan, 2026-09-07), and since 2026-09-13 two rows of three, four rows
// to a column, a View all under each and a rule between the sections: the
// first row is the reader's record — the jurisdictions they follow, the
// committees and the members their answers at sign-up point to — and the
// second is what they do with it — what they track, what they follow, and
// the agents, last on purpose. Recents leads the first row (2026-09-13).
// Every row is a link with a chevron, ruled from the next; a chamber's
// row wears its seal. Each column's ⋯ is a menu on Cloudflare's, and Change
// column swaps what a column holds. The jurisdictions followed and the order
// of the columns live in the browser; the rest comes from the profile.

type Kind = "jurisdictions" | "committees" | "members" | "tracking" | "interests" | "agents" | "recents"
const KINDS: Record<Kind, string> = { jurisdictions: "Jurisdictions", committees: "Committees", members: "Members", tracking: "Tracking", interests: "Interests", agents: "Agents", recents: "Recents" }
// Recents first (Brendan, 2026-09-13), two rows of three, Agents last; Tracking is a column a reader can swap in.
const ORDER: Kind[] = ["recents", "jurisdictions", "committees", "members", "interests", "agents"]
const FIRST_ROW = 3
/** The first row's columns stop at four rows; the second's run their full length — the descending array (Brendan, 2026-09-13). */
const ROWS = 4
const ALL = Infinity
const COLUMNS_KEY = "govblock:home-columns"
const FOLLOWED_KEY = "govblock:home-jurisdictions"

const isKind = (value: string): value is Kind => value in KINDS
const isCode = (value: string): value is string => STATE_CODES.includes(value)

/** A list of strings kept in localStorage: the fallback until the browser has answered, then whatever it holds. */
function useStoredList<T extends string>(key: string, fallback: T[], valid: (value: string) => value is T) {
  const [list, setList] = React.useState<T[]>(fallback)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      if (Array.isArray(parsed)) setList(parsed.filter((v): v is T => typeof v === "string" && valid(v)))
    } catch {
      // The default stands.
    }
    setReady(true)
  }, [key, valid])
  const write = React.useCallback(
    (next: T[]) => {
      setList(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // A convenience, not a record.
      }
    },
    [key]
  )
  return [list, write, ready] as const
}

/** The reader's profile, read once: the home state, the interests, and the address as a point. */
type HomeProfile = { home_state: string | null; interests: string[]; lng: number | null; lat: number | null }
function useProfile(signedIn: boolean) {
  const [profile, setProfile] = React.useState<HomeProfile | null | undefined>(undefined)
  React.useEffect(() => {
    if (!signedIn) return setProfile(null)
    let alive = true
    fetch("/api/profile", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((j: { profile: HomeProfile | null }) => alive && setProfile(j.profile ?? null))
      .catch(() => alive && setProfile(null))
    return () => {
      alive = false
    }
  }, [signedIn])
  return profile
}

/** What the reader tracks: their watches. */
type Watch = { id: string; name: string }
function useWatches(signedIn: boolean) {
  const [watches, setWatches] = React.useState<Watch[] | null>(null)
  React.useEffect(() => {
    if (!signedIn) return setWatches([])
    let alive = true
    fetch("/api/watches", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { watches: [] }))
      .then((j: { watches?: Watch[] }) => alive && setWatches(j.watches ?? []))
      .catch(() => alive && setWatches([]))
    return () => {
      alive = false
    }
  }, [signedIn])
  return watches
}

/** Who sits for the address: the two senators, the House member, the state chambers' members. */
function useRepresentatives(home: string | null, point: { lng: number; lat: number } | null) {
  const { data: senate } = usePolicy<MemberRow[]>(home ? "members" : null, { state: CONGRESS, chamber: "Senate" }, { limit: 120 })
  const senators = React.useMemo(() => (Array.isArray(senate) && home ? senate.filter((m) => m.district === `SD-${home}` && m.active !== false) : []), [senate, home])
  const [rep, setRep] = React.useState<Representation | null>(null)
  React.useEffect(() => {
    if (!point) return
    let alive = true
    ;(async () => {
      try {
        const party = (await (await fetch(geoUrl("/geo/cd119-party.json"))).json()) as { districts: Record<string, { party: string | null; name: string | null; people_id: number | null }> }
        const found = await representationAt([point.lng, point.lat], party.districts ?? {}, () => true)
        if (alive) setRep(found)
      } catch {
        if (alive) setRep(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [point])
  return { senators, rep }
}

/** An interest's committees: the first committee in each body whose name carries one of the interest's words. */
const COMMITTEE_WORDS: Record<string, string[]> = {
  Housing: ["housing"],
  Health: ["health"],
  Education: ["education"],
  Labor: ["labor", "workforce"],
  Environment: ["environment"],
  "Taxes and budget": ["ways and means", "budget", "finance", "appropriations"],
  "Public safety": ["public safety", "codes", "judiciary", "homeland"],
  Elections: ["election"],
  Transportation: ["transportation"],
  Technology: ["technology", "science"],
  Agriculture: ["agricultur"],
  Veterans: ["veteran"],
}
type CommitteeRow = { committee_name: string; chamber: string; bills: number }
function committeesFor(interests: string[], rows: CommitteeRow[]): CommitteeRow[] {
  const out: CommitteeRow[] = []
  for (const interest of interests) {
    const words = COMMITTEE_WORDS[interest] ?? [interest.toLowerCase()]
    const hit = rows.find((r) => !/^subcommittee/i.test(r.committee_name) && words.some((w) => r.committee_name.toLowerCase().includes(w)) && !out.includes(r))
    if (hit) out.push(hit)
  }
  return out
}

function Column({ title, href, menu, all, children }: { title: string; href?: string; menu: React.ReactNode; /** View all, under the rows. */ all?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex h-8 items-center gap-1 text-sm text-muted-foreground">
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 no-underline hover:text-foreground">
            {title} <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <span>{title}</span>
        )}
        {menu}
      </div>
      <ul className="m-0 mt-2 list-none divide-y p-0">{children}</ul>
      {all && (
        <Link href={all} className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">
          View all <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}

function Row({ href, icon, children, muted }: { href: string; icon: React.ReactNode; children: React.ReactNode; muted?: React.ReactNode }) {
  return (
    <li className="m-0 p-0">
      <Link href={href} className="group/row flex h-[66px] items-center gap-3 text-[15px] font-medium text-foreground no-underline">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate">
          {muted && <span className="font-normal text-muted-foreground">{muted} / </span>}
          {children}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5" />
      </Link>
    </li>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="m-0 p-0 py-4 text-sm text-muted-foreground">{children}</li>
}

/** The column's ⋯: its own items first, then Change column, a radio over every kind that swaps this column with the one holding the choice, or takes the choice in if no column holds it. */
function ColumnMenu({ kind, columns, onColumns, children }: { kind: Kind; columns: Kind[]; onColumns: (next: Kind[]) => void; children?: React.ReactNode }) {
  const swap = (to: Kind) => {
    if (to === kind) return
    onColumns(columns.includes(to) ? columns.map((k) => (k === kind ? to : k === to ? kind : k)) : columns.map((k) => (k === kind ? to : k)))
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="-mr-1.5 ml-auto size-7 text-muted-foreground" aria-label={`${KINDS[kind]} menu`}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-max min-w-44">
        {children}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="whitespace-nowrap">
            <Columns2 /> Change column
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-max min-w-44">
            <DropdownMenuRadioGroup value={kind} onValueChange={(value) => swap(value as Kind)}>
              {(Object.keys(KINDS) as Kind[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k} className="whitespace-nowrap">
                  {KINDS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const chamberLabel = (code: string, chamber: string) => `${code === CONGRESS ? "U.S." : stateName(code)} ${chamber}`

export function HomeColumns() {
  const { state } = useJurisdiction()
  const { signedIn } = useAccount()
  const profile = useProfile(signedIn)
  const home = profile?.home_state && profile.home_state !== CONGRESS ? profile.home_state : null
  const point = profile?.lng != null && profile?.lat != null ? { lng: profile.lng, lat: profile.lat } : null
  const interests = profile?.interests ?? []
  const recents = useRecents(ALL === Infinity ? 20 : ROWS)
  const watches = useWatches(signedIn)
  const { senators, rep } = useRepresentatives(home, point)
  const { data: homeCommittees } = usePolicy<CommitteeRow[]>(home ? "committees" : null, { state: home ?? "" }, { limit: 300 })
  const { data: usCommittees } = usePolicy<CommitteeRow[]>("committees", { state: CONGRESS }, { limit: 300 })

  const [storedColumns, setColumns] = useStoredList<Kind>(COLUMNS_KEY, ORDER, isKind)
  // Congress is followed until it is unchecked; the home state, or the jurisdiction in scope, sits beside it.
  const [followed, setFollowed, followedReady] = useStoredList<string>(FOLLOWED_KEY, [CONGRESS], isCode)
  const columns = storedColumns.length === ORDER.length && new Set(storedColumns).size === ORDER.length ? storedColumns : ORDER
  const scoped = home ?? state
  const shown = [CONGRESS, scoped, ...followed].filter((code, i, all) => all.indexOf(code) === i)
  const follow = (code: string, on: boolean) => setFollowed(on ? [...followed.filter((c) => c !== code), code] : followed.filter((c) => c !== code))
  const scope = `?state=${scoped}`

  const committees = React.useMemo(() => {
    const rows = [...(Array.isArray(homeCommittees) ? homeCommittees.map((r) => ({ ...r, state: home ?? CONGRESS })) : []), ...(Array.isArray(usCommittees) ? usCommittees.map((r) => ({ ...r, state: CONGRESS })) : [])]
    const picked = committeesFor(interests, rows) as (CommitteeRow & { state: string })[]
    return picked.length ? picked : rows.slice(0, ROWS)
  }, [homeCommittees, usCommittees, interests, home])

  const column = (kind: Kind, cap: number) => {
    const menu = (children?: React.ReactNode) => (
      <ColumnMenu kind={kind} columns={columns} onColumns={setColumns}>
        {children}
      </ColumnMenu>
    )
    const showAll = (href: string) => (
      <>
        <DropdownMenuItem className="whitespace-nowrap" render={<Link href={href} />}>
          <MoreHorizontal /> Show all
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </>
    )
    switch (kind) {
      case "jurisdictions":
        return (
          <Column
            key={kind}
            title={KINDS[kind]}
            href={`/bills${scope}`}
            all="/workspace/data"
            menu={menu(
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="whitespace-nowrap">
                    <Plus /> Add jurisdiction
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 w-max min-w-52 overflow-y-auto">
                    {STATE_CODES.map((code) => (
                      <DropdownMenuCheckboxItem key={code} className="whitespace-nowrap" checked={shown.includes(code)} disabled={code === scoped || code === CONGRESS} onCheckedChange={(checked) => follow(code, checked)}>
                        <FlagChip state={code} width={20} /> {stateName(code)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                {showAll("/workspace/data")}
              </>
            )}
          >
            {followedReady &&
              shown
                .flatMap((code) => chambersOf(code).map((chamber) => ({ code, chamber })))
                .slice(0, cap)
                .map(({ code, chamber }) => (
                  <Row key={`${code}-${chamber}`} href={`/bills?state=${code}&chamber=${encodeURIComponent(chamber)}`} icon={<ChamberSeal state={code} chamber={chamber} size={28} />}>
                    {chamberLabel(code, chamber)}
                  </Row>
                ))}
          </Column>
        )
      case "committees":
        return (
          <Column key={kind} title={KINDS[kind]} href={`/committees${scope}`} all={`/committees${scope}`} menu={menu(showAll(`/committees${scope}`))}>
            {committees.length ? (
              committees.slice(0, cap).map((c) => (
                <Row key={`${c.state}-${c.chamber}-${c.committee_name}`} href={`/bills?state=${c.state}&committee=${encodeURIComponent(c.committee_name)}`} icon={<ChamberSeal state={c.state} chamber={c.chamber} size={28} />}>
                  {c.committee_name}
                </Row>
              ))
            ) : (
              <Empty>{signedIn ? "Loading…" : "Sign in and the committees your interests point to collect here."}</Empty>
            )}
          </Column>
        )
      case "members": {
        const rows = [
          ...senators.map((m) => ({ key: `us-${m.people_id}`, href: memberHref(m.people_id), state: CONGRESS, chamber: "Senate", name: m.name })),
          ...(rep?.congress?.seat ? [{ key: "us-house", href: rep.congress.seat.people_id ? memberHref(rep.congress.seat.people_id) : `/members${scope}`, state: CONGRESS, chamber: "House", name: rep.congress.seat.name }] : []),
          ...(rep?.chambers ?? []).flatMap((c) => c.seats.map((s) => ({ key: `${c.id}-${s.name}`, href: s.people_id ? memberHref(s.people_id, home ?? undefined) : `/members${scope}`, state: home ?? CONGRESS, chamber: c.chamber, name: s.name }))),
        ]
        return (
          <Column key={kind} title={KINDS[kind]} href={`/members${scope}`} all={`/members${scope}`} menu={menu(showAll(`/members${scope}`))}>
            {rows.length ? (
              rows.slice(0, cap).map((r) => (
                <Row key={r.key} href={r.href} icon={<ChamberSeal state={r.state} chamber={r.chamber} size={28} />}>
                  {r.name}
                </Row>
              ))
            ) : (
              <Empty>{signedIn ? (point ? "Finding them…" : "Add your address and the people who sit for it collect here.") : "Sign in and the people who sit for your address collect here."}</Empty>
            )}
          </Column>
        )
      }
      case "tracking":
        return (
          <Column key={kind} title={KINDS[kind]} href="/watches" all="/watches" menu={menu(showAll("/watches"))}>
            {watches && watches.length ? (
              watches.slice(0, cap).map((w) => (
                <Row key={w.id} href={`/watches/${w.id}`} icon={<Radar className="size-4" />}>
                  {w.name}
                </Row>
              ))
            ) : (
              <Empty>{signedIn ? "Nothing tracked yet." : "Sign in and what you track collects here."}</Empty>
            )}
          </Column>
        )
      case "interests":
        return (
          <Column key={kind} title={KINDS[kind]} href="/workspace/dashboard/settings/profile" all="/workspace/dashboard/settings/profile" menu={menu(showAll("/workspace/dashboard/settings/profile"))}>
            {interests.length ? (
              interests.slice(0, cap).map((interest) => (
                <Row key={interest} href={`/search?q=${encodeURIComponent(interest)}&state=${scoped}`} icon={<Tag className="size-4" />}>
                  {interest}
                </Row>
              ))
            ) : (
              <Empty>{signedIn ? "Nothing followed yet." : "Sign in and what you follow collects here."}</Empty>
            )}
          </Column>
        )
      case "agents":
        return (
          <Column key={kind} title={KINDS[kind]} href="/agents" all="/agents" menu={menu(showAll("/agents"))}>
            {AGENTS.slice(0, cap).map((a) => (
              <Row key={a.slug} href={`/agents/${a.slug}`} icon={<Bot className="size-4" />}>
                {a.name}
              </Row>
            ))}
          </Column>
        )
      case "recents":
        return (
          <Column
            key={kind}
            title={KINDS[kind]}
            menu={menu(
              <>
                <DropdownMenuItem className="whitespace-nowrap" disabled={!recents.length} onClick={clearRecents}>
                  <Trash2 /> Clear recents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
          >
            {recents.length ? (
              recents.slice(0, cap).map((r) => (
                <Row key={r.href} href={r.href} icon={<History className="size-4" />} muted={r.group}>
                  {r.title}
                </Row>
              ))
            ) : (
              <Empty>The pages you open will collect here.</Empty>
            )}
          </Column>
        )
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-3">{columns.slice(0, FIRST_ROW).map((k) => column(k, ROWS))}</div>
      <Separator />
      <div className="grid gap-8 md:grid-cols-3">{columns.slice(FIRST_ROW).map((k) => column(k, ALL))}</div>
    </div>
  )
}
