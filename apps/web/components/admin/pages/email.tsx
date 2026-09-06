"use client"

import * as React from "react"
import { ArchiveIcon, ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileIcon, FolderIcon, ForwardIcon, InboxIcon, MailIcon, MoreHorizontalIcon, PaperclipIcon, PenSquareIcon, PlusIcon, ReplyIcon, SearchIcon, SendIcon, ShieldCheckIcon, SparklesIcon, StarIcon, Trash2Icon, CalendarIcon, ListTodoIcon, LifeBuoyIcon, Settings2Icon, FileTextIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Progress } from "@govblock/ui/components/progress"
import { Separator } from "@govblock/ui/components/nova/separator"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Email app, rebuilt from its rendered page: a folder rail, the
// message list, and the open message with its attachments. The messages are
// the template's sample ones; the Agentic Inbox on the stage beside this one
// is where the site's real mail lives.

type Mail = { id: number; from: string; initial: string; when: string; subject: string; preview: string; attachment?: string; more?: number; label: string; unread?: boolean; starred?: boolean }

const MAIL: Mail[] = [
  { id: 1, from: "Jane Holmes", initial: "J", when: "Just now", subject: "Action Required: Unpaid Invoice #INV-2024-0892", preview: "Hi Alex, I wanted to follow up on the outstanding invoice #INV-2024-0892. The payment was due last Friday...", attachment: "Invoice.pdf", more: 2, label: "Operation", unread: true, starred: true },
  { id: 2, from: "Marcus Lee", initial: "M", when: "10 min ago", subject: "New Features in Profile Update Release v2.4", preview: "Hey team, we've just rolled out a series of improvements to the user profile section. Please review the attached changelog...", attachment: "Changelog.md", label: "Front-End", unread: true },
  { id: 3, from: "Sarah Connor", initial: "S", when: "1 hour ago", subject: "Weekly Sprint Standup Notes & Blockers", preview: "Here are the notes from today's standup. We covered the remaining tasks for the current sprint and discussed blockers...", label: "Debugs", unread: true },
  { id: 4, from: "Tom Adams", initial: "T", when: "3 hours ago", subject: "Design System Component Library Review", preview: "I've updated the Figma file with the latest component variants. Can you take a look and provide feedback on the color tokens...", attachment: "DesignTokens.json", label: "UI Design", starred: true },
  { id: 5, from: "Emily Chen", initial: "E", when: "5 hours ago", subject: "Q3 Revenue Forecast Report & Analysis", preview: "Please find the Q3 revenue forecast attached. Revenue is projected to grow 18% quarter over quarter driven by enterprise...", attachment: "Q3Report.xlsx", more: 1, label: "Operation" },
  { id: 6, from: "David Park", initial: "D", when: "Yesterday", subject: "API Rate Limiting Discussion & Strategy", preview: "We need to revisit our rate limiting strategy for the public API. Current limits are too restrictive for our enterprise...", label: "Debugs" },
]

const FOLDERS = [
  { title: "General", items: [{ icon: InboxIcon, label: "Inbox", count: 3 }, { icon: SendIcon, label: "Sent" }, { icon: FileTextIcon, label: "Drafts", count: 1 }] },
  { title: "AI Features", items: [{ icon: CalendarIcon, label: "Calendar" }, { icon: ListTodoIcon, label: "Tasks & To-dos" }] },
]
const LABELS = ["Operation", "Front-End", "UI Design", "Debugs"]

export function EmailPage() {
  const [selected, setSelected] = React.useState(1)
  const [filter, setFilter] = React.useState<"all" | "unread" | "starred">("all")
  const [railOpen, setRailOpen] = React.useState(false)
  const list = MAIL.filter((m) => (filter === "unread" ? m.unread : filter === "starred" ? m.starred : true))
  const mail = MAIL.find((m) => m.id === selected) ?? MAIL[0]
  const index = MAIL.indexOf(mail)
  const next = MAIL[index + 1]

  return (
    <div className="flex min-h-[70vh] gap-4 sm:gap-5">
      <aside className={cn("flex w-56 shrink-0 flex-col gap-3 xl:w-64 2xl:flex", railOpen ? "flex" : "max-2xl:hidden")}>
        <div className="flex items-center gap-2.5">
          <Avatar>
            <AvatarFallback>DN</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 text-sm leading-tight">
            <span className="truncate font-medium">Den N.</span>
            <span className="truncate text-xs text-muted-foreground">mail@gmail.com</span>
          </div>
          <Button variant="ghost" size="icon-sm" className="ms-auto" aria-label="More">
            <MoreHorizontalIcon />
          </Button>
        </div>
        <Button className="gap-2">
          <PenSquareIcon className="size-4" />
          Compose email
        </Button>
        <Separator />
        {FOLDERS.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground uppercase">{group.title}</p>
            {group.items.map((item) => (
              <button key={item.label} type="button" className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted", item.label === "Inbox" && "bg-muted font-medium")}>
                <item.icon className="size-4" />
                <span className="grow text-left">{item.label}</span>
                {item.count && (
                  <Badge variant="secondary" className="h-4.5 min-w-5 justify-center px-1">
                    {item.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Folders</p>
            <Button variant="ghost" size="icon-xs" aria-label="Add folder">
              <PlusIcon />
            </Button>
          </div>
          {LABELS.map((l, i) => (
            <button key={l} type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <span className="size-2 rounded-full" style={{ background: `var(--chart-${i + 1})` }} />
              {l}
            </button>
          ))}
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-1">
          <Button variant="outline" size="lg" className="gap-1.5">
            <LifeBuoyIcon className="size-4" />
            Support
          </Button>
          <Button variant="outline" size="lg" className="gap-1.5">
            <Settings2Icon className="size-4" />
            Settings
          </Button>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Pace AI Pro</p>
              <p className="text-xs text-muted-foreground">$12 / month</p>
            </div>
            <Badge variant="outline" className="h-5 text-green-600">
              Active
            </Badge>
          </div>
          <Card className="gap-2.5 py-3">
            <CardContent className="flex flex-col gap-2 px-3">
              <div className="flex justify-between text-xs">
                <span>Storage</span>
                <span className="font-medium">39%</span>
              </div>
              <Progress value={39} className="**:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-track]:h-1.5" />
              <p className="text-[11px] text-muted-foreground">100 GB of 256 GB used</p>
            </CardContent>
          </Card>
        </div>
      </aside>
      <div className="flex min-w-0 grow flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="min-h-0 gap-0 py-0">
          <CardContent className="flex flex-col px-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Button variant="ghost" size="icon-sm" className="2xl:hidden" aria-label="Folders" onClick={() => setRailOpen((o) => !o)}>
                <FolderIcon />
              </Button>
              <p className="font-medium">
                Inbox <span className="text-muted-foreground">6 Messages</span>
              </p>
            </div>
            <div className="flex items-center gap-1 border-b px-4 py-2">
              {(["all", "unread", "starred"] as const).map((f) => (
                <Button key={f} variant={filter === f ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(f)} className="capitalize">
                  {f} <span className="text-muted-foreground">{f === "all" ? 6 : f === "unread" ? 3 : 2}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-col">
              {list.map((m) => (
                <button key={m.id} type="button" onClick={() => setSelected(m.id)} className={cn("flex gap-3 border-b px-4 py-3 text-left hover:bg-muted/60", m.id === selected && "bg-muted")}>
                  <Avatar>
                    <AvatarFallback>{m.initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", m.unread && "font-semibold")}>{m.from}</span>
                      <span className="ms-auto shrink-0 text-xs text-muted-foreground">{m.when}</span>
                      <StarIcon className={cn("size-3.5 shrink-0", m.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                    </div>
                    <p className={cn("truncate text-sm", m.unread && "font-medium")}>{m.subject}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{m.preview}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {m.attachment && (
                        <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px]">
                          <PaperclipIcon className="size-2.5" />
                          {m.attachment}
                        </Badge>
                      )}
                      {m.more && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          +{m.more}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {m.label}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="min-h-0 gap-0 py-0">
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2">
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back">
                <ArrowLeftIcon />
              </Button>
              <div className="relative max-w-56 grow">
                <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search mail" className="h-8 pl-7 text-xs" />
              </div>
              <div className="ms-auto flex items-center gap-0.5">
                {[ArchiveIcon, Trash2Icon, MailIcon, StarIcon, ReplyIcon, ForwardIcon].map((Icon, i) => (
                  <Button key={i} variant="ghost" size="icon-sm" aria-label="Action">
                    <Icon className="size-4" />
                  </Button>
                ))}
                <span className="mx-1 text-xs text-muted-foreground">
                  {index + 1} of {MAIL.length}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => setSelected(MAIL[Math.max(0, index - 1)].id)}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => setSelected(MAIL[Math.min(MAIL.length - 1, index + 1)].id)}>
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{mail.subject}</h2>
                <Badge variant="secondary" className="h-5">
                  {mail.label}
                </Badge>
                <span className="ms-auto text-xs text-muted-foreground">15 Feb 2025, 10:43 PM</span>
              </div>
              <div className="flex items-start gap-3">
                <Avatar className="sm:size-10">
                  <AvatarFallback>{mail.initial}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 text-sm">
                  <span className="font-medium">{mail.from}</span>
                  <span className="text-xs text-muted-foreground">heyjane1997@gmail.com</span>
                  <span className="text-xs text-muted-foreground">
                    To: <span className="text-foreground">Alex Rivers</span> · Cc: <span className="text-foreground">Jonathan Amiri</span>
                  </span>
                </div>
                <div className="ms-auto flex gap-0.5">
                  {[ReplyIcon, ForwardIcon, MoreHorizontalIcon].map((Icon, i) => (
                    <Button key={i} variant="ghost" size="icon-sm" aria-label="Action">
                      <Icon className="size-4" />
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <SparklesIcon className="size-3.5" />
                  Pace AI Insights
                </p>
                <p className="text-muted-foreground">
                  High priority email from <span className="font-medium text-foreground">{mail.from}</span>. Requires follow-up regarding invoice payment.
                </p>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <p>Hi Alex,</p>
                <p>
                  I wanted to follow up on the outstanding invoice <span className="font-medium">#INV-2024-0892</span>. The payment was due last Friday and we haven't received it yet. Could you please check the status on your end?
                </p>
                <p>
                  The total amount is <span className="font-medium">$4,250.00</span>
                </p>
                <p>
                  Best regards,
                  <br />
                  {mail.from}
                  <br />
                  <span className="text-muted-foreground">Senior Account Manager</span>
                </p>
              </div>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Attachments</p>
                <Badge variant="outline" className="h-5 gap-1">
                  <ShieldCheckIcon className="size-3" />
                  Secured by Pace Shield
                </Badge>
                <Button variant="outline" size="sm" className="ms-auto gap-1.5">
                  <DownloadIcon className="size-3.5" />
                  Download All (3)
                </Button>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Invoice.pdf", "12MB"],
                  ["Screenshot.jpg", "23KB"],
                  ["Screenrecord.mp4", "184MB"],
                ].map(([name, size]) => (
                  <Card key={name} className="min-w-0 gap-2 py-3">
                    <CardContent className="flex min-w-0 items-center gap-3 px-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileIcon className="size-4" />
                      </div>
                      <div className="min-w-0 grow">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{size}</p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Download">
                        <DownloadIcon className="size-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <button type="button" className="flex h-10 items-center gap-2.5 rounded-lg border px-3 text-left text-sm text-muted-foreground hover:bg-muted">
                <ReplyIcon className="size-4" />
                Click here to reply to {mail.from}...
              </button>
              {next && (
                <button type="button" onClick={() => setSelected(next.id)} className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted">
                  <div className="min-w-0 grow">
                    <p className="text-xs text-muted-foreground">Next Message</p>
                    <p className="truncate text-sm font-medium">{next.subject}</p>
                    <p className="text-xs text-muted-foreground">{next.when}</p>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
