"use client"

import * as React from "react"
import { BadgeCheckIcon, BellIcon, Check, ChevronsUpDownIcon, Copy, CreditCardIcon, Gift, LogOutIcon, SearchIcon, Share, Sparkles, UserIcon, Users, XIcon } from "lucide-react"

import { ADMIN_USER } from "@/components/admin/rail"
import { useAdminNav } from "@/components/admin/nav"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { congressName } from "@/lib/policy/scope"
import type { SessionRow } from "@/lib/policy/types"
import { writeUrlParams } from "@/lib/policy/url-state"
import { usePolicy } from "@/lib/policy/use-policy"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card } from "@govblock/ui/components/nova/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@govblock/ui/components/nova/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Input } from "@govblock/ui/components/nova/input"
import { Kbd } from "@govblock/ui/components/nova/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

// paceui's layout blocks — the topbar's search, refer, notifications and
// profile — for the block shell's actions slot (Brendan, 2026-09-05). The
// flag is our jurisdiction switcher, which is what a flag in this header
// means, and the theme toggle is the site's own.

/** The search button opens the site's command menu, the way ⌘K does. */
export function SearchButton() {
  const open = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
  return (
    <>
      <Button variant="outline" size="sm" className="w-48 justify-between shadow-none max-md:hidden" onClick={open}>
        <span className="font-normal text-muted-foreground">Search...</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Search" onClick={open}>
        <SearchIcon className="size-4.5" />
      </Button>
    </>
  )
}

const shortSession = (title: string) =>
  title
    .replace(/\s*(Regular|General)\s+Session$/i, "")
    .replace(/\s*Session$/i, "")
    .trim()

/** The session filter, where the search was (Brendan, 2026-09-07): the session in scope, and a menu of the jurisdiction's sessions, newest first, that writes the pick into the URL for every card to follow. */
export function SessionFilter() {
  const { state, session } = useJurisdiction()
  const { data } = usePolicy<SessionRow[]>("sessions", { state }, { titles: 1 })
  const sessions = data ?? []
  const label = (id: number, title?: string | null) => (state === "US" ? congressName(id) : (title && shortSession(title)) || String(id))
  const current = session ? label(session, sessions.find((row) => Number(row.session_id) === session)?.title) : "Session"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="justify-between shadow-none md:w-48" aria-label="Filter by session" />}>
        <span className="truncate font-normal">{current}</span>
        <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-48">
        {sessions.map((row) => {
          const active = Number(row.session_id) === session
          return (
            <DropdownMenuItem key={row.session_id} className="whitespace-nowrap" onClick={() => !active && writeUrlParams({ session: String(row.session_id) }, { history: "push" })}>
              {label(Number(row.session_id), row.title)}
              {active && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          )
        })}
        {!sessions.length && <DropdownMenuItem disabled>Loading sessions…</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Notification1() {
  const [open, setOpen] = React.useState(false)
  const notes = [
    { title: "New message received", when: "2 minutes ago" },
    { title: "Your report is ready", when: "1 hour ago" },
    { title: "System update completed", when: "3 hours ago" },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
            <BellIcon className="size-4.5" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full p-0 text-[0.625rem]">
              3
            </Badge>
          </Button>
        }
      />
      <PopoverContent className="w-80 gap-0 space-y-0 p-0 shadow-none" align="end">
        <div className="flex items-center justify-between border-b px-4 py-1.5">
          <h4 className="text-base font-medium">Notifications</h4>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <XIcon />
          </Button>
        </div>
        <div className="space-y-1 p-2">
          {notes.map((n) => (
            <div key={n.title} className="cursor-pointer rounded-md px-3 py-1.5 transition-colors hover:bg-muted">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.when}</p>
            </div>
          ))}
        </div>
        <div className="border-t p-0.5">
          <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Profile1() {
  const { go } = useAdminNav()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Profile">
            <Avatar size="sm">
              <AvatarFallback>
                <UserIcon />
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-max min-w-44 shadow-none">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar>
            <AvatarFallback>
              <UserIcon />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-sm font-medium">{ADMIN_USER.name}</p>
            <p className="text-xs text-muted-foreground">{ADMIN_USER.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => go("settings/account-security")} className="whitespace-nowrap">
            <BadgeCheckIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go("settings/billing")} className="whitespace-nowrap">
            <CreditCardIcon />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => go("settings/notifications")} className="whitespace-nowrap">
            <BellIcon />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("auth-1/login")} className="whitespace-nowrap">
          <LogOutIcon />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** paceui's Refer a Friend dialog, the gift in the topbar. */
export function ReferDialog() {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const link = "https://policy.nysgpt.com/?ref=ABC123XYZ"
  const copy = () => {
    void navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const why = [
    { icon: Sparkles, title: "2 Months Free Premium", text: "Get instant access to all premium features" },
    { icon: Users, title: "Help Your Friends", text: "They get 2 months free too when they sign up" },
    { icon: Check, title: "Unlimited Referrals", text: "No limit on how many friends you can refer" },
  ]
  const how = ["Copy your unique referral link below", "Share it with friends via email or social media", "Both get 2 months free when they sign up!"]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Refer a Friend">
            <Gift className="size-4.5" />
          </Button>
        }
      />
      <DialogContent className="max-w-lg gap-6">
        <DialogHeader className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Gift className="size-7 text-primary" />
          </div>
          <div className="flex flex-col gap-1 text-center">
            <DialogTitle className="text-2xl font-medium">Refer a Friend & Get Rewarded</DialogTitle>
            <DialogDescription>Share the love and both of you will receive 2 months of free premium access</DialogDescription>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h4 className="font-medium">Why refer?</h4>
            <div className="flex flex-col gap-2.5">
              {why.map((w) => (
                <div key={w.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <w.icon className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{w.title}</p>
                    <p className="text-sm text-muted-foreground">{w.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-medium">How it works</h4>
            <div className="flex flex-col gap-2">
              {how.map((step, i) => (
                <div key={step} className="flex items-center gap-2.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="flex flex-col gap-2 bg-muted/50 p-4">
            <label className="block text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <Input readOnly value={link} className="bg-background shadow-none" />
              <Button variant="outline" size="icon" className="shrink-0 shadow-none" onClick={copy} aria-label="Copy">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </Card>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={() => setOpen(false)}>
              <Share className="size-4" />
              Share Link
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The topbar's right half, as the block shell's actions: the session filter and the bell (Brendan, 2026-09-07: the search became a filter with a dropdown for sessions). The flag moved to the site header; the gift, the theme toggle and the profile are gone. */
export function AdminTopbar() {
  return (
    <div className="flex items-center gap-1.5">
      <SessionFilter />
      <div className="h-6.5 w-px bg-border max-sm:hidden" />
      <Notification1 />
    </div>
  )
}
