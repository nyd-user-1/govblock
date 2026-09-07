"use client"

import * as React from "react"

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
import { BillActionsCard, BillSponsorsCard, BillSubjectsCard, BillTextCard, BillTrackerCard, BillVotesCard } from "@/components/workspace/demo-bill"

// /workspace/blocks (Brendan, 2026-09-07): the site's own parts on the
// canvas, exactly as they appear where they live — the home page's cards,
// the account home's metric tiles, the Sales dashboard's cards, the /docs
// bill page's blocks — each at the size it needs on the four-column grid.
// The cards are the cards: nothing of the grid's is drawn around them.

export type BlockGroup = "home" | "analytics" | "dashboard" | "bill"

export type BlockEntry = {
  slug: string
  title: string
  group: BlockGroup
  /** What it needs on the four-column grid, at the standard row. */
  size: Size
  render: () => React.ReactNode
  /** The block carries its own ⋮ (card-frame's ComponentActions), which the grid takes over. */
  ownMenu: boolean
}

const home = (slug: string, title: string, render: () => React.ReactNode, rows: 1 | 2 = 1, ownMenu = true): BlockEntry => ({ slug, title, group: "home", size: { cols: 1, rows }, render, ownMenu })

// In the order the home page stacks them (components/cards/index.tsx).
export const HOME_BLOCKS: BlockEntry[] = [
  home("bills", "Total Bills", () => <BillsCard />, 2),
  home("votes", "Votes", () => <VotesCard />, 2),
  home("topics", "Topics", () => <TopicsCard />),
  home("lobbying", "Lobbying", () => <LobbyingCard />),
  home("connect", "Connect", () => <ConnectCard />, 1, false),
  home("party", "Party", () => <PartyCard />),
  home("sessions", "Sessions", () => <SessionsCard />, 2),
  home("model-bills", "Model bills", () => <ModelBillsCard />),
  home("committees", "Committees", () => <CommitteesCard />, 2),
  home("traffic", "Bills by party", () => <BarChartCard />, 2, false),
  home("notifications", "Subscribe", () => <NotificationSettings />, 2, false),
  home("navigation", "Navigation", () => <NavigationCard />, 2),
  home("adopted", "Adopted Bills", () => <AdoptedBillsCard />, 2),
  home("calendar", "Calendar", () => <CalendarCard />, 2, false),
  home("members", "Members", () => <MembersCard />),
  home("api", "API", () => <ApiCard />),
  home("team", "Team", () => <NoTeamMembers />, 1, false),
  home("chambers", "Chambers", () => <ChambersCard />),
]

export const ANALYTICS_BLOCKS: BlockEntry[] = METRIC_CARDS.map((m) => ({ slug: `metric-${m.key}`, title: m.label, group: "analytics", size: { cols: 1, rows: 1 }, render: () => <MetricCard metric={m.key} />, ownMenu: false }))

const dash = (slug: string, title: string, render: () => React.ReactNode, size: Size): BlockEntry => ({ slug, title, group: "dashboard", size, render, ownMenu: false })

export const DASHBOARD_BLOCKS: BlockEntry[] = [
  dash("stat-bills", "Bills", () => <SalesStatCard index={0} />, { cols: 1, rows: 1 }),
  dash("stat-adopted", "Adopted", () => <SalesStatCard index={1} />, { cols: 1, rows: 1 }),
  dash("stat-roll-calls", "Roll Calls", () => <SalesStatCard index={2} />, { cols: 1, rows: 1 }),
  dash("stat-seats", "Seats", () => <SalesStatCard index={3} />, { cols: 1, rows: 1 }),
  dash("legislative-activity", "Legislative Activity", () => <LegislativeActivityCard />, { cols: 2, rows: 2 }),
  dash("top-sponsors", "Top Sponsors", () => <TopSponsorsCard />, { cols: 2, rows: 2 }),
  dash("seats-by-party", "Seats by Party", () => <SeatsByPartyCard />, { cols: 1, rows: 2 }),
  dash("busiest-committees", "Busiest Committees", () => <BusiestCommitteesCard />, { cols: 1, rows: 2 }),
  dash("bulk-datasets", "Bulk Datasets", () => <BulkDatasetsCard />, { cols: 1, rows: 2 }),
]

const bill = (slug: string, title: string, render: () => React.ReactNode, size: Size): BlockEntry => ({ slug, title, group: "bill", size, render, ownMenu: false })

export const BILL_BLOCKS: BlockEntry[] = [
  bill("bill-text", "Bill text", () => <BillTextCard />, { cols: 2, rows: 2 }),
  bill("bill-sponsors", "Sponsors", () => <BillSponsorsCard />, { cols: 2, rows: 2 }),
  bill("bill-tracker", "Tracker", () => <BillTrackerCard />, { cols: 2, rows: 1 }),
  bill("bill-actions", "Actions", () => <BillActionsCard />, { cols: 2, rows: 2 }),
  bill("bill-votes", "Votes", () => <BillVotesCard />, { cols: 2, rows: 2 }),
  bill("bill-subjects", "Subjects", () => <BillSubjectsCard />, { cols: 2, rows: 1 }),
]

export const BLOCKS: BlockEntry[] = [...HOME_BLOCKS, ...ANALYTICS_BLOCKS, ...DASHBOARD_BLOCKS, ...BILL_BLOCKS]

export const GROUP_LABEL: Record<BlockGroup, string> = { home: "Home", analytics: "Analytics", dashboard: "Dashboards", bill: "Bill" }

export const findBlock = (slug: string | undefined) => BLOCKS.find((b) => b.slug === slug)
