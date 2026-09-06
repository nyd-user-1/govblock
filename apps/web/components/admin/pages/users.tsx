"use client"

import * as React from "react"
import { ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UserIcon } from "lucide-react"

import { honorific } from "@/lib/format"
import { useMembers } from "@/components/admin/data"
import { useAdminNav } from "@/components/admin/nav"
import { PageTitle } from "@/components/admin/page-title"
import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Users list, as the jurisdiction's members: search, two filters,
// ten to a page, and a menu per row that opens the member on the site.

const PAGE = 10

export function UsersPage() {
  const { go } = useAdminNav()
  const members = useMembers()
  const [query, setQuery] = React.useState("")
  const [chamber, setChamber] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members.data ?? []).filter((m) => (chamber === "all" || m.chamber === chamber) && (status === "all" || (status === "active" ? m.active : !m.active)) && (!q || m.name.toLowerCase().includes(q) || (m.district ?? "").toLowerCase().includes(q)))
  }, [members.data, query, chamber, status])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages)
  const slice = rows.slice((current - 1) * PAGE, current * PAGE)
  const chambers = [...new Set((members.data ?? []).map((m) => m.chamber).filter(Boolean))]

  return (
    <div>
      <PageTitle
        title="Members"
        endContent={
          <Button size="lg" className="gap-1.5" onClick={() => go("apps/users/create")}>
            <PlusIcon className="size-4" />
            Create
          </Button>
        }
      />
      <Card className="mt-4 gap-4 sm:mt-5">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative grow sm:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Search members"
                className="h-9 pl-8"
              />
            </div>
            <Select
              value={chamber}
              onValueChange={(v) => {
                setChamber(String(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 sm:w-36.25">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chambers</SelectItem>
                {chambers.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(String(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 sm:w-36.25">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="former">Former</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="ms-auto h-9">
                    Actions
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-max min-w-44">
                <DropdownMenuItem render={<a href="/docs/directory" />} className="whitespace-nowrap">Open Directory</DropdownMenuItem>
                <DropdownMenuItem render={<a href="/docs/datasets" />} className="whitespace-nowrap">Export as CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-12">Portrait</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Chamber</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Leadership</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.pending && !members.data
                ? Array.from({ length: PAGE }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : slice.map((m) => (
                    <TableRow key={m.people_id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={m.photo_url ?? undefined} alt={m.name} className="object-cover object-top" />
                          <AvatarFallback>{(m.first_name?.[0] ?? "") + (m.last_name?.[0] ?? "")}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium whitespace-nowrap">
                            {honorific(m.role, m.chamber)} {m.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">#{m.people_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>{m.chamber}</TableCell>
                      <TableCell>{m.party === "D" ? "Democrat" : m.party === "R" ? "Republican" : m.party || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("h-5 gap-1 lowercase", m.active ? "text-green-600" : "text-muted-foreground")}>
                          {m.active ? "active" : "former"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{m.district || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">{m.leadership_title || "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                                <MoreHorizontalIcon />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-max min-w-44">
                            <DropdownMenuItem render={<a href={`/docs/directory/${m.people_id}`} />} className="whitespace-nowrap">
                              <UserIcon />
                              View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem render={<a href={`/create?state=${members.scope.state}&member=${m.people_id}`} />} className="whitespace-nowrap">
                              <ExternalLinkIcon />
                              Open in Create
                            </DropdownMenuItem>
                            <DropdownMenuItem className="whitespace-nowrap">
                              <PencilIcon />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" className="whitespace-nowrap">
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{rows.length ? (current - 1) * PAGE + 1 : 0}</span> to <span className="font-medium text-foreground">{Math.min(current * PAGE, rows.length)}</span> of <span className="font-medium text-foreground">{rows.length}</span> results
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                Previous
              </Button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const n = current <= 3 ? i + 1 : Math.min(pages - 4, current - 2) + i
                return (
                  <Button key={n} variant={n === current ? "secondary" : "ghost"} size="sm" onClick={() => setPage(n)}>
                    {n}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
