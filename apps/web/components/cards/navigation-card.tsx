"use client"

import * as React from "react"
import Link from "next/link"

import { CardHead, CardShell, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@govblock/ui/components/sidebar"

// Navigation — groups of links drawn as a sidebar inside a card.
export type NavGroup = { label: string; items: { name: string; href: string; icon?: React.ComponentType<{ className?: string }> }[] }

export function NavigationCardBody({ groups, title = "Navigation", action }: CardBodyProps & { groups: NavGroup[] }) {
  return (
    <>
      <CardHead title={title} action={action} />
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
                            {item.icon && <item.icon />}
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
    </>
  )
}

export function NavigationCard(props: React.ComponentProps<typeof NavigationCardBody>) {
  return (
    <CardShell>
      <NavigationCardBody {...props} />
    </CardShell>
  )
}
