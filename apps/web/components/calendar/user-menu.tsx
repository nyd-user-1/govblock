"use client"

import * as React from "react"
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  SunMoonIcon,
  UserIcon,
} from "lucide-react"

import { Icons } from "@/components/icons"
import { useTheme } from "next-themes"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"

const user = {
  name: "Livingston",
  avatar: "/avatars/01.png",
}

export function UserMenu() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 w-full justify-start px-2 aria-expanded:bg-muted"
          />
        }
      >
        <Avatar className="size-6">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{user.name}</span>
        <ChevronsUpDownIcon className="ml-auto text-muted-foreground/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-(--anchor-width) min-w-56"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          {user.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoonIcon />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                checked={resolvedTheme === "light"}
                onCheckedChange={() => setTheme("light")}
              >
                <SunIcon />
                Light
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={resolvedTheme === "dark"}
                onCheckedChange={() => setTheme("dark")}
              >
                <MoonIcon />
                Dark
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <a
                href="https://ui.shadcn.com/docs"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <BookOpenIcon />
            Documentation
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a
                href="https://github.com/nyd-user-1/livingston-v3"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Icons.gitHub />
            GitHub repository
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
