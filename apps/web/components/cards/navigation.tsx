"use client"

import Link from "next/link"
import {
  IconCalendarEvent,
  IconChartBar,
  IconCoin,
  IconFileText,
  IconGavel,
  IconLayoutGrid,
  IconNews,
  IconTypography,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"

import * as F from "@/lib/fixtures"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@govblock/ui/components/sidebar"

// Navigation — one card where four demo cards used to sit. Real destinations,
// and the scoped ones carry the jurisdiction so a click keeps the state you
// are in.
export function NavigationCard() {
  const { state } = useJurisdiction()
  const scoped = (href: string) => `${href}?state=${state}`

  const groups = [
    {
      label: "Directory",
      items: [
        { name: "Bills", href: scoped("/docs/bills"), icon: IconFileText },
        { name: "Committees", href: scoped("/docs/committees"), icon: IconUsersGroup },
        { name: "Members", href: scoped("/docs/directory"), icon: IconUsers },
        { name: "Finance", href: scoped("/docs/money"), icon: IconCoin },
      ],
    },
    {
      label: "Data",
      items: [
        { name: "Charts", href: "/charts", icon: IconChartBar },
        { name: "Create", href: scoped("/create"), icon: IconLayoutGrid },
        { name: "Calendar", href: "/calendar", icon: IconCalendarEvent },
        { name: "Typeset", href: scoped("/typeset"), icon: IconTypography },
      ],
    },
    {
      label: "Docs",
      items: [
        { name: "Docs", href: "/docs", icon: IconGavel },
        { name: "Changelog", href: "/changelog", icon: IconNews },
      ],
    },
  ]

  return (
    <CardFrame id="nav">
      <CardHeader>
        <CardTitle>Navigation</CardTitle>
        <CardDescription>Everything else, scoped to where you are</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <SidebarProvider className="min-h-0">
          <Sidebar collapsible="none" className="w-full bg-transparent">
            <SidebarContent className="gap-0">
              {groups.map((group) => (
                <SidebarGroup key={group.label} className="py-1">
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton render={<Link href={item.href} />}>
                            <item.icon />
                            <span>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </CardContent>
    </CardFrame>
  )
}
