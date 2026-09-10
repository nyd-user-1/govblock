"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, ChevronRight, Columns2, History, MoreHorizontal, Plus, Trash2 } from "lucide-react"

import { AGENTS } from "@/lib/agents/registry"
import { CONGRESS, STATE_CODES, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
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

// The three columns under the search, as Cloudflare's account home has them
// (Brendan, 2026-09-07): the jurisdictions followed where it has Domains,
// our agents where it has Workers, and the pages opened last as Recents.
// Every row is a link with a chevron, ruled from the next; a chamber's row
// wears its seal (Brendan, 2026-09-07). Each column's ⋯ is a menu on
// Cloudflare's: Jurisdictions adds one or shows them all, Agents shows them
// all, Recents clears, and Change column swaps what a column holds. The
// jurisdictions followed and the order of the columns live in the browser.

type Kind = "jurisdictions" | "agents" | "recents"
const KINDS: Record<Kind, string> = { jurisdictions: "Jurisdictions", agents: "Agents", recents: "Recents" }
const ORDER: Kind[] = ["jurisdictions", "agents", "recents"]
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

function Column({ title, href, menu, children }: { title: string; href?: string; menu: React.ReactNode; children: React.ReactNode }) {
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

/** The column's ⋯: its own items first, then Change column, a radio over the three kinds that swaps this column with the one holding the choice. */
function ColumnMenu({ kind, columns, onColumns, children }: { kind: Kind; columns: Kind[]; onColumns: (next: Kind[]) => void; children?: React.ReactNode }) {
  const swap = (to: Kind) => {
    if (to === kind) return
    onColumns(columns.map((k) => (k === kind ? to : k === to ? kind : k)))
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
              {ORDER.map((k) => (
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
  const recents = useRecents(5)
  const [storedColumns, setColumns] = useStoredList<Kind>(COLUMNS_KEY, ORDER, isKind)
  // Congress is followed until it is unchecked; the jurisdiction in scope is always first.
  const [followed, setFollowed, followedReady] = useStoredList<string>(FOLLOWED_KEY, [CONGRESS], isCode)
  const columns = storedColumns.length === ORDER.length && ORDER.every((k) => storedColumns.includes(k)) ? storedColumns : ORDER
  const shown = [state, ...followed.filter((code) => code !== state)]
  const follow = (code: string, on: boolean) => setFollowed(on ? [...followed.filter((c) => c !== code), code] : followed.filter((c) => c !== code))
  const scope = `?state=${state}`

  const column = (kind: Kind) => {
    const menu = (children?: React.ReactNode) => (
      <ColumnMenu kind={kind} columns={columns} onColumns={setColumns}>
        {children}
      </ColumnMenu>
    )
    if (kind === "jurisdictions")
      return (
        <Column
          key={kind}
          title={KINDS[kind]}
          href={`/bills${scope}`}
          menu={menu(
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="whitespace-nowrap">
                  <Plus /> Add jurisdiction
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-max min-w-52 overflow-y-auto">
                  {STATE_CODES.map((code) => (
                    <DropdownMenuCheckboxItem
                      key={code}
                      className="whitespace-nowrap"
                      checked={shown.includes(code)}
                      disabled={code === state}
                      onCheckedChange={(checked) => follow(code, checked)}
                    >
                      <FlagChip state={code} width={20} /> {stateName(code)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="whitespace-nowrap" render={<Link href="/workspace/data" />}>
                <MoreHorizontal /> Show all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
        >
          {followedReady &&
            shown.flatMap((code) =>
              chambersOf(code).map((chamber) => (
                <Row key={`${code}-${chamber}`} href={`/bills?state=${code}&chamber=${encodeURIComponent(chamber)}`} icon={<ChamberSeal state={code} chamber={chamber} size={28} />}>
                  {chamberLabel(code, chamber)}
                </Row>
              ))
            )}
        </Column>
      )
    if (kind === "agents")
      return (
        <Column
          key={kind}
          title={KINDS[kind]}
          href="/agents"
          menu={menu(
            <>
              <DropdownMenuItem className="whitespace-nowrap" render={<Link href="/agents" />}>
                <MoreHorizontal /> Show all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
        >
          {AGENTS.map((a) => (
            <Row key={a.slug} href={`/agents/${a.slug}`} icon={<Bot className="size-4" />}>
              {a.name}
            </Row>
          ))}
        </Column>
      )
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
          recents.map((r) => (
            <Row key={r.href} href={r.href} icon={<History className="size-4" />} muted={r.group}>
              {r.title}
            </Row>
          ))
        ) : (
          <li className="m-0 p-0 py-4 text-sm text-muted-foreground">The pages you open will collect here.</li>
        )}
      </Column>
    )
  }

  return <div className="grid gap-8 md:grid-cols-3">{columns.map(column)}</div>
}
