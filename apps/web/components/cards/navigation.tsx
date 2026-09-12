"use client"

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
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { NavigationCardBody } from "@/components/cards/navigation-card"

// Navigation — one card where four demo cards used to sit. Real destinations,
// and the scoped ones carry the jurisdiction so a click keeps the state you
// are in.
export function NavigationCard() {
  const { state } = useJurisdiction()
  const scoped = (href: string) => `${href}?state=${state}`

  const groups = [
    {
      label: "ArXiv",
      items: [
        { name: "Bills", href: scoped("/bills"), icon: IconFileText },
        { name: "Committees", href: scoped("/committees"), icon: IconUsersGroup },
        { name: "Members", href: scoped("/members"), icon: IconUsers },
        { name: "Finance", href: scoped("/money"), icon: IconCoin },
      ],
    },
    {
      label: "Data",
      items: [
        { name: "Charts", href: "/charts", icon: IconChartBar },
        { name: "Data", href: "/workspace/data", icon: IconLayoutGrid },
        { name: "Calendar", href: "/calendar", icon: IconCalendarEvent },
        { name: "Typeset", href: "/workspace/typeset", icon: IconTypography },
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
      <NavigationCardBody groups={groups} title={<CardAnchor>Navigation</CardAnchor>} action={<ComponentActions />} />
    </CardFrame>
  )
}
