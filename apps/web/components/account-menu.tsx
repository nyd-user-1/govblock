"use client"

import * as React from "react"
import Link from "next/link"
import { CirclePlusIcon, CreditCardIcon, LogOutIcon, SettingsIcon, SquarePenIcon, UserIcon, UsersIcon } from "lucide-react"

import { DEFAULT_AVATAR, type Account } from "@/lib/auth/use-account"
import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"

// The header avatar's user menu (Brendan, 2026-09-14), built from
// @ss-blocks/dashboard-dropdown-02 (shadcnstudio) on our own nova primitives.
// The avatar is the trigger; the menu carries the reader's name, portrait and
// the account actions, with Logout in the destructive tone.
export function AccountMenu({ account }: { account: NonNullable<Account> }) {
  const label = account.name ?? account.email ?? "Account"
  const image = account.image ?? DEFAULT_AVATAR
  const initial = label.slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account — signed in as ${label}`}
        className="flex size-[31px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {account.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.image} alt="" width={31} height={31} className="size-full object-cover" />
        ) : (
          initial
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-max min-w-64">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="relative">
            <Avatar size="lg">
              <AvatarImage src={image} alt="" />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <span className="absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2 ring-background" />
          </div>
          <div className="flex flex-1 flex-col items-start">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {account.email ? <span className="text-xs text-muted-foreground">{account.email}</span> : null}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/workspace/dashboard/settings/profile" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <UserIcon className="size-4 text-foreground" />
            <span>My Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/workspace/dashboard/settings" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <SettingsIcon className="size-4 text-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/plan" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <CreditCardIcon className="size-4 text-foreground" />
            <span>Billing</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/account/team" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <UsersIcon className="size-4 text-foreground" />
            <span>Manage team</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/account/customization" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <SquarePenIcon className="size-4 text-foreground" />
            <span>Customization</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/account/team/new" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
            <CirclePlusIcon className="size-4 text-foreground" />
            <span>Add team account</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" render={<Link href="/auth?signout=1" />} className="gap-2.5 px-3 py-2 whitespace-nowrap">
          <LogOutIcon className="size-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
