"use client"

import * as React from "react"
import { ArrowLeftIcon, ExternalLinkIcon, FileIcon, InfoIcon, MoreHorizontalIcon, PaperclipIcon, PhoneIcon, SearchIcon, SendIcon, SmileIcon, VideoIcon, PenSquareIcon, BellIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { Input } from "@govblock/ui/components/nova/input"
import { Separator } from "@govblock/ui/components/nova/separator"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Chat app, rebuilt from its rendered page: the chats rail, the
// conversation, and the shared media panel. The conversation is the
// template's sample one; the site's own chat is the agents' chat.

const CHATS = [
  { id: 1, name: "John Shinoda", when: "08:30", text: "Yeah, I'll send the updated wireframes tonight for review." },
  { id: 2, name: "Dina Harrison", when: "12:31", text: "That sounds like a great idea! Let's discuss it over coffee 😊", online: true },
  { id: 3, name: "Mandy Guoles", when: "Yesterday", text: "Can you check the latest PR? I've pushed the fixes." },
  { id: 4, name: "Sam Pettersen", when: "Yesterday", text: "Meeting at 3pm has been moved to the main conference room." },
  { id: 5, name: "Elisa Moreno", when: "Mon", text: "Thanks for the quick turnaround on those designs!" },
  { id: 6, name: "Ryan Clarke", when: "Mon", text: "The deployment went smoothly. All systems are green." },
]

const THREAD = [
  { me: false, text: "Hey Travis! I just finished reviewing the mockups you sent over. They look really clean 🎨", at: "20:18" },
  { me: false, text: "I especially love the dashboard layout — the card-based approach feels modern and easy to navigate.", at: "20:19", reaction: "👍 1" },
  { me: true, text: "Thanks Dina! Glad you liked the direction. I spent some extra time on the spacing and typography to make it feel premium.", at: "20:21" },
  { me: false, text: "It shows! One small note — could we try a slightly warmer background tone? Something like a very light cream instead of pure white?", at: "20:22" },
  { me: true, text: "Absolutely, I'll experiment with a few warm neutrals and send an updated version by tonight. Any other feedback?", at: "20:24", reaction: "😁 1" },
  { me: false, text: "That sounds like a great idea! Let's discuss it over coffee 😊", at: "12:31" },
]

export function ChatPage() {
  const [active, setActive] = React.useState(2)
  const [draft, setDraft] = React.useState("")
  const [messages, setMessages] = React.useState(THREAD)
  const [infoOpen, setInfoOpen] = React.useState(false)
  const chat = CHATS.find((c) => c.id === active) ?? CHATS[1]
  const send = () => {
    if (!draft.trim()) return
    setMessages((m) => [...m, { me: true, text: draft.trim(), at: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) }])
    setDraft("")
  }

  return (
    <div className="grid min-h-[70vh] gap-4 sm:gap-5 md:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
      <Card className="gap-0 py-0 max-md:hidden">
        <CardContent className="flex flex-col gap-3 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar>
              <AvatarFallback>DN</AvatarFallback>
            </Avatar>
            <span className="grow truncate text-sm font-medium">Travis Taylor</span>
            {[BellIcon, PenSquareIcon, MoreHorizontalIcon].map((Icon, i) => (
              <Button key={i} variant="ghost" size="icon-sm" aria-label="Action">
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Friends Online</p>
            <Badge variant="secondary" className="h-4 min-w-5 justify-center px-1 text-[10px]">
              6
            </Badge>
          </div>
          <div className="flex gap-2">
            {["O", "M", "S", "J", "M", "E"].map((i, k) => (
              <div key={k} className="relative">
                <Avatar>
                  <AvatarFallback>{i}</AvatarFallback>
                </Avatar>
                <span className="absolute right-0 bottom-0 size-2 rounded-full bg-green-500 ring-2 ring-background" />
              </div>
            ))}
          </div>
          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase">Chats</p>
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search chats" className="h-9 pl-8" />
          </div>
          <div className="flex flex-col">
            {CHATS.map((c) => (
              <button key={c.id} type="button" onClick={() => setActive(c.id)} className={cn("flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted", c.id === active && "bg-muted")}>
                <Avatar>
                  <AvatarFallback>{c.name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 grow">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{c.when}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.text}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardContent className="flex h-full flex-col px-0">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back">
              <ArrowLeftIcon />
            </Button>
            <Avatar>
              <AvatarFallback>{chat.name[0]}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 leading-tight">
              <span className="truncate text-sm font-medium">{chat.name}</span>
              <span className="text-xs text-green-600">Online</span>
            </div>
            <div className="ms-auto flex gap-0.5">
              {[PhoneIcon, VideoIcon, MoreHorizontalIcon].map((Icon, i) => (
                <Button key={i} variant="ghost" size="icon-sm" aria-label="Action">
                  <Icon className="size-4" />
                </Button>
              ))}
              <Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Info" onClick={() => setInfoOpen((o) => !o)}>
                <InfoIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex grow flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex max-w-[80%] items-end gap-2", m.me ? "self-end flex-row-reverse" : "self-start")}>
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">{m.me ? "DN" : chat.name[0]}</AvatarFallback>
                </Avatar>
                <div className={cn("relative rounded-2xl px-3 py-2 text-sm", m.me ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
                  {m.text}
                  <div className={cn("mt-1 flex items-center gap-2 text-[10px]", m.me ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {m.reaction && <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-foreground">{m.reaction}</span>}
                    <span>{m.at}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <Button variant="ghost" size="icon-sm" aria-label="Attach">
              <PaperclipIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Emoji">
              <SmileIcon className="size-4" />
            </Button>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message" className="h-9" />
            <Button size="icon" aria-label="Send" onClick={send}>
              <SendIcon className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className={cn("gap-0 py-0", infoOpen ? "" : "max-xl:hidden")}>
        <CardContent className="flex flex-col gap-4 px-4 py-4">
          <p className="text-sm font-semibold">Shared Media & Info</p>
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg">
              <AvatarFallback>{chat.name[0]}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">{chat.name}</p>
            <p className="text-xs text-green-600">Active now</p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Shared Files</p>
            <Button variant="link" size="xs">
              See all
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              ["PhotoDanver.jpg", "10.03.2021 at 11:43", "175 Kb"],
              ["Dashboard_v2.fig", "08.03.2021 at 09:15", "2.4 Mb"],
              ["BrandGuide.pdf", "05.03.2021 at 14:22", "890 Kb"],
            ].map(([n, d, s]) => (
              <div key={n} className="flex items-center gap-2.5 text-sm">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileIcon className="size-4" />
                </div>
                <div className="min-w-0 grow">
                  <p className="truncate font-medium">{n}</p>
                  <p className="text-[11px] text-muted-foreground">{d}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{s}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Shared Links</p>
            <Button variant="link" size="xs">
              See all
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              ["🏀", "Dribbble.com", "10.12.2020", "10:32pm"],
              ["🏆", "Awwwards.com", "08.12.2020", "09:15am"],
            ].map(([e, n, d, t]) => (
              <div key={n} className="flex items-center gap-2.5 text-sm">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">{e}</div>
                <div className="min-w-0 grow">
                  <p className="flex items-center gap-1 truncate font-medium">
                    {n}
                    <ExternalLinkIcon className="size-3 text-muted-foreground" />
                  </p>
                  <p className="text-[11px] text-muted-foreground">{d}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
