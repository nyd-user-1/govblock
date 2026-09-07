"use client"

import * as React from "react"

import { BLOCK_TABS } from "@/lib/blocks-tabs"
import type { Size } from "@/lib/workspace/datasets"
import { BulkDatasetsCard, BusiestCommitteesCard, LegislativeActivityCard, SalesStatCard, SeatsByPartyCard, TopSponsorsCard } from "@/components/admin/pages/sales"
import { AdoptedBillsCard } from "@/components/cards/adopted"
import { ApiCard } from "@/components/cards/api"
import { BillsCard } from "@/components/cards/bills"
import { CalendarCard } from "@/components/cards/calendar"
import { ChambersCard } from "@/components/cards/chambers"
import { CommitteesCard } from "@/components/cards/committees"
import { ConnectCard } from "@/components/cards/connect"
import { LobbyingCard } from "@/components/cards/lobbying"
import { MembersCard } from "@/components/cards/members"
import { ModelBillsCard } from "@/components/cards/model-bills"
import { NavigationCard } from "@/components/cards/navigation"
import { NotificationSettings } from "@/components/cards/notifications"
import { PartyCard } from "@/components/cards/party"
import { SessionsCard } from "@/components/cards/sessions"
import { NoTeamMembers } from "@/components/cards/team"
import { TopicsCard } from "@/components/cards/topics"
import { BarChartCard } from "@/components/cards/traffic"
import { VotesCard } from "@/components/cards/votes"
import { METRIC_CARDS, MetricCard } from "@/components/home/analytics-grid"

// /workspace/blocks (Brendan, 2026-09-07): every block the site is built
// from, as a catalogue the grid draws one card from — the home page's cards,
// the account home's metric tiles, the Sales dashboard's cards, and the
// full-page blocks /blocks shows one at a time. Each carries the size it
// needs on the four-column grid, so it always fits; on the eight-column grid
// that size doubles. Each lives at /workspace/blocks/{slug}.

export type BlockGroup = "home" | "analytics" | "dashboard" | "page"

export type BlockEntry = {
  slug: string
  title: string
  group: BlockGroup
  /** What it needs on the four-column grid. */
  size: Size
  /** The block itself; a full page renders through its viewer frame instead. */
  render?: () => React.ReactNode
  /** The registry name of a full-page block. */
  block?: string
}

const home = (slug: string, title: string, render: () => React.ReactNode, size: Size = { cols: 1, rows: 1 }): BlockEntry => ({ slug, title, group: "home", size, render })

export const HOME_BLOCKS: BlockEntry[] = [
  home("bills", "Bills", () => <BillsCard />),
  home("votes", "Votes", () => <VotesCard />),
  home("topics", "Topics", () => <TopicsCard />),
  home("lobbying", "Lobbying", () => <LobbyingCard />),
  home("connect", "Connect", () => <ConnectCard />),
  home("party", "Party", () => <PartyCard />),
  home("sessions", "Sessions", () => <SessionsCard />),
  home("model-bills", "Model Bills", () => <ModelBillsCard />),
  home("committees", "Committees", () => <CommitteesCard />),
  home("traffic", "Traffic", () => <BarChartCard />),
  home("notifications", "Notifications", () => <NotificationSettings />),
  home("navigation", "Navigation", () => <NavigationCard />),
  home("adopted", "Adopted Bills", () => <AdoptedBillsCard />),
  home("calendar", "Calendar", () => <CalendarCard />),
  home("members", "Members", () => <MembersCard />),
  home("api", "API", () => <ApiCard />),
  home("team", "Team", () => <NoTeamMembers />),
  home("chambers", "Chambers", () => <ChambersCard />),
]

export const ANALYTICS_BLOCKS: BlockEntry[] = METRIC_CARDS.map((m) => ({ slug: `metric-${m.key}`, title: m.label, group: "analytics", size: { cols: 1, rows: 1 }, render: () => <MetricCard metric={m.key} /> }))

export const DASHBOARD_BLOCKS: BlockEntry[] = [
  { slug: "stat-bills", title: "Bills", group: "dashboard", size: { cols: 1, rows: 1 }, render: () => <SalesStatCard index={0} /> },
  { slug: "stat-adopted", title: "Adopted", group: "dashboard", size: { cols: 1, rows: 1 }, render: () => <SalesStatCard index={1} /> },
  { slug: "stat-roll-calls", title: "Roll Calls", group: "dashboard", size: { cols: 1, rows: 1 }, render: () => <SalesStatCard index={2} /> },
  { slug: "stat-seats", title: "Seats", group: "dashboard", size: { cols: 1, rows: 1 }, render: () => <SalesStatCard index={3} /> },
  { slug: "legislative-activity", title: "Legislative Activity", group: "dashboard", size: { cols: 2, rows: 2 }, render: () => <LegislativeActivityCard /> },
  { slug: "top-sponsors", title: "Top Sponsors", group: "dashboard", size: { cols: 2, rows: 2 }, render: () => <TopSponsorsCard /> },
  { slug: "seats-by-party", title: "Seats by Party", group: "dashboard", size: { cols: 1, rows: 2 }, render: () => <SeatsByPartyCard /> },
  { slug: "busiest-committees", title: "Busiest Committees", group: "dashboard", size: { cols: 1, rows: 2 }, render: () => <BusiestCommitteesCard /> },
  { slug: "bulk-datasets", title: "Bulk Datasets", group: "dashboard", size: { cols: 1, rows: 2 }, render: () => <BulkDatasetsCard /> },
]

export const PAGE_BLOCKS: BlockEntry[] = BLOCK_TABS.map((tab) => ({ slug: `page-${tab.value}`, title: tab.label, group: "page", size: { cols: 4, rows: 2 }, block: tab.block }))

export const BLOCKS: BlockEntry[] = [...HOME_BLOCKS, ...ANALYTICS_BLOCKS, ...DASHBOARD_BLOCKS, ...PAGE_BLOCKS]

export const GROUP_LABEL: Record<BlockGroup, string> = { home: "Home", analytics: "Analytics", dashboard: "Dashboards", page: "Pages" }

export const findBlock = (slug: string | undefined) => BLOCKS.find((b) => b.slug === slug)
