"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BuildingIcon, CheckIcon, LandmarkIcon, LockIcon, MapIcon } from "lucide-react"

import { useAccount } from "@/lib/auth/use-account"
import { stateName } from "@/lib/filters"
import type { Look } from "@/components/create/folder-view"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { SessionRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { accessTo, DATASETS, LAYOUT_KEY, type Access, type Dataset } from "@/lib/workspace/datasets"
import { buildWorkspacePath } from "@/lib/workspace/path"
import { readSort, sortRows } from "@/lib/workspace/sort"
import { useUrlParams } from "@/lib/policy/url-state"
import { ChamberSeal } from "@/components/policy/imagery"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@govblock/ui/components/dropdown-menu"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// /workspace/data (Brendan, 2026-09-07): every dataset as a card on the
// standard grid. The lock at the top left is the plan: open for Congress,
// open for a signed-in reader's home state, shut for everything else until
// there is a plan to buy. Explore opens the dataset at its path,
// /workspace/data/us/house; Download takes a session as a file. The current
// session is free, an earlier one waits on the plan too.

function Seal({ seal, size = 96 }: { seal: Dataset["seal"]; size?: number }) {
  if (seal.kind === "chamber") return <ChamberSeal state={seal.state} chamber={seal.chamber} size={size} />
  return (
    <span data-slot="chamber-seal" className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60" style={{ width: size, height: size }}>
      {/* Plain <img>: the seals are the agencies' own files, not optimised assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={seal.src} alt="" className="h-full w-full object-contain p-0.5" />
    </span>
  )
}

function useSessions(state: string | undefined) {
  const { data } = usePolicy<SessionRow[]>(state ? "sessions" : null, { state })
  return data ?? []
}

const fileUrl = (state: string, session: number, format: "csv" | "json") => `/api/dataset/${state.toLowerCase()}/${session}/bills.${format}`
// The route answers with an attachment, so the page stays where it is.
const download = (url: string) => window.location.assign(url)

/** Choose Year: the current one is free, the earlier ones wait on the plan. */
function ChooseSession({ dataset, chosen, onChoose }: { dataset: Dataset; chosen?: number; onChoose: (session: number) => void }) {
  const sessions = useSessions(dataset.state)
  const current = sessions[0]?.session_id
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Choose Year</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-max min-w-44">
        <DropdownMenuRadioGroup value={String(chosen ?? current ?? "")} onValueChange={(value) => onChoose(Number(value))}>
          {sessions.map((row) => (
            <DropdownMenuRadioItem key={row.session_id} value={String(row.session_id)} disabled={row.session_id !== current} className="whitespace-nowrap" title={row.session_id !== current ? "Earlier years wait on a paid plan" : row.title}>
              {String(row.session_id)}
              {row.session_id !== current && <LockIcon className="ml-auto size-3.5 text-muted-foreground" aria-label="Locked" />}
            </DropdownMenuRadioItem>
          ))}
          {!sessions.length && <DropdownMenuItem disabled>Loading years…</DropdownMenuItem>}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function FileItems({ dataset, chosen, disabled }: { dataset: Dataset; chosen?: number; disabled: boolean }) {
  const sessions = useSessions(disabled ? undefined : dataset.state)
  const session = chosen ?? sessions[0]?.session_id
  const ready = !disabled && !!dataset.state && !!session
  return (
    <>
      <DropdownMenuItem disabled={!ready} onClick={() => ready && download(fileUrl(dataset.state!, session!, "csv"))}>
        Download data (CSV)
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!ready} onClick={() => ready && download(fileUrl(dataset.state!, session!, "json"))}>
        Download data (JSON)
      </DropdownMenuItem>
    </>
  )
}

/** The mark, and what it means for this reader: a green check on what is open (Brendan, 2026-09-07), the lock on what waits. */
function Plan({ dataset, access, signedIn, home }: { dataset: Dataset; access: Access; signedIn: boolean; home: string }) {
  const title = dataset.group === "congress" ? "Open to everyone" : dataset.group === "department" && access === "open" ? "Open: its forms and filings are on file" : dataset.group === "state" && dataset.state === home ? (signedIn ? `Yours: ${stateName(home)} is your home state` : `Sign in to open ${stateName(home)}, your home state`) : "Waits on a paid plan"
  if (access === "open")
    return (
      <span title={title}>
        <CheckIcon className="size-4 text-emerald-500" aria-label="Open" />
      </span>
    )
  return (
    <span title={title}>
      <LockIcon className="size-4" aria-label="Locked" />
    </span>
  )
}

const SESSIONS_KEY = "govblock:workspace:data:sessions"

export function DatasetGrid({ look = "cards" }: { look?: Look }) {
  const router = useRouter()
  const { signedIn } = useAccount()
  const { state: home } = useJurisdiction()
  const [chosen, setChosen] = React.useState<Record<string, number>>({})
  React.useEffect(() => {
    try {
      setChosen(JSON.parse(window.localStorage.getItem(SESSIONS_KEY) || "{}"))
    } catch {
      // Nothing chosen.
    }
  }, [])
  const choose = (key: string, session: number) =>
    setChosen((current) => {
      const next = { ...current, [key]: session }
      try {
        window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the choice lasts for this page.
      }
      return next
    })

  const { sort: sortParam } = useUrlParams(["sort"] as const)
  const sort = readSort(sortParam)
  const ordered = React.useMemo(() => sortRows(DATASETS, sort, { name: (d) => d.title, kind: (d) => ({ congress: "0", state: "1", department: "2" })[d.group], time: () => null }), [sort])
  const items = React.useMemo<GridItem[]>(
    () =>
      ordered.map((d) => {
        const access = accessTo(d, { signedIn, home })
        const locked = access === "locked"
        const path = d.state && d.chamber ? buildWorkspacePath({ state: d.state, chamber: d.chamber, session: chosen[d.key] ?? null, location: { at: "", committee: "", member: "", bill: "", rollcall: "" } }) : (d.href ?? null)
        const explore = () => path && router.push(path)
        return {
          key: `dataset-${d.key}`,
          group: d.group,
          badge: <Plan dataset={d} access={access} signedIn={signedIn} home={home} />,
          media: <Seal seal={d.seal} />,
          title: d.title,
          // No buttons (Brendan, 2026-09-07): the card opens the dataset; the files are in its menu.
          onOpen: locked || !path ? undefined : explore,
          menu: (
            <>
              {d.state && <ChooseSession dataset={d} chosen={chosen[d.key]} onChoose={(session) => choose(d.key, session)} />}
              <DropdownMenuItem disabled={locked || !path} onClick={explore}>
                Explore
              </DropdownMenuItem>
              <FileItems dataset={d} chosen={chosen[d.key]} disabled={locked} />
            </>
          ),
        }
      }),
    [ordered, signedIn, home, chosen, router]
  )

  if (look === "table") return <DatasetTable chosen={chosen} rows={ordered} />
  return <WorkspaceGrid storageKey={LAYOUT_KEY} items={items} keepOrder={!!sort} />
}

/** The datasets as the standard table: the seal and name, the jurisdiction, the plan. */
function DatasetTable({ chosen, rows }: { chosen: Record<string, number>; rows: Dataset[] }) {
  const router = useRouter()
  const { signedIn } = useAccount()
  const { state: home } = useJurisdiction()
  const columns = ["Dataset", "Jurisdiction", "Plan"]
  return (
    <div className="m-4 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {columns.map((label, i) => (
              <TableHead key={label} className={cn(i === 2 && "text-right")}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => {
            const access = accessTo(d, { signedIn, home })
            const path = d.state && d.chamber ? buildWorkspacePath({ state: d.state, chamber: d.chamber, session: chosen[d.key] ?? null, location: { at: "", committee: "", member: "", bill: "", rollcall: "" } }) : (d.href ?? null)
            const open = access === "open" && !!path
            return (
              <TableRow key={d.key} className={cn("group/row", open && "cursor-pointer")} onClick={() => open && router.push(path!)}>
                <TableCell className="max-w-0">
                  <span className="flex items-center gap-2.5 font-medium">
                    <Seal seal={d.seal} size={22} />
                    <span className={cn("truncate", open && "group-hover/row:text-primary group-hover/row:underline")}>{d.title}</span>
                  </span>
                </TableCell>
                <TableCell className="max-w-0">
                  <span className="block truncate text-muted-foreground">{d.state ? stateName(d.state) : "Federal"}</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {access === "open" ? <CheckIcon className="size-3.5 text-emerald-500" aria-hidden /> : <LockIcon className="size-3.5" aria-hidden />}
                    {access === "open" ? "Open" : "Locked"}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

const GROUPS: { key: "congress" | "department" | "state"; label: string; icon: typeof LandmarkIcon }[] = [
  { key: "congress", label: "Congress", icon: LandmarkIcon },
  { key: "department", label: "Departments", icon: BuildingIcon },
  { key: "state", label: "States", icon: MapIcon },
]

/** The datasets' rail: the three groups, each a jump to its first card. */
export function DatasetRail() {
  const jump = (group: string) => document.querySelector(`[data-slot=workspace-grid] [data-group=${group}]`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Data · {DATASETS.length} datasets</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {GROUPS.map((g) => {
              const Icon = g.icon
              return (
                <SidebarMenuItem key={g.key}>
                  <SidebarMenuButton onClick={() => jump(g.key)}>
                    <Icon />
                    <span className="flex-1 truncate">{g.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{DATASETS.filter((d) => d.group === g.key).length}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
