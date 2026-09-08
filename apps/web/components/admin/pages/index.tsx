"use client"

import * as React from "react"

import { AiPage } from "./ai"
import { TrafficPage } from "./traffic"
import { AuthPage } from "./auth"
import { CalendarPage } from "./calendar"
import { ChatPage } from "./chat"
import { CommitteePage } from "./committee"
import { ComponentsPage } from "./components"
import { CryptoPage } from "./crypto"
import { CustomersPage } from "./customers"
import { DatabasePage } from "./database"
import { EducationPage } from "./education"
import { EmailPage } from "./email"
import { FinancePage } from "./finance"
import { LogsPage } from "./logs"
import { MEMBER, MemberPage } from "./member"
import { MenuPage } from "./menu"
import { OrdersPage } from "./orders"
import { RollCallPage } from "./roll-call"
import { SalesPage } from "./sales"
import { SettingsPage } from "./settings"
import { SkeletonPage } from "./skeleton"
import { StreamPage } from "./stream"
import { UsersCreatePage } from "./users-create"
import { VideosPage } from "./videos"
import { UsersPage } from "./users"

// Which of paceui's pages the URL names. Every entry in the rail resolves
// here; an unknown page lands on Sales, the way the template's root does.

// The page's title, for the shell header's breadcrumb (Brendan, 2026-09-06:
// the title moved out of the content and into the header, on every Admin
// page). A page renders no title of its own.
const TITLES: Record<string, string> = {
  "": "Session Performance",
  sales: "Session Performance",
  logs: "Activity Log",
  "roll-call": "Roll Call",
  customers: "Member Analytics",
  member: MEMBER,
  orders: "Bill Performance",
  traffic: "Traffic Observability",
  ai: "Cost & Usage Observability",
  education: "Education Management",
  // The Labor committee, from Brendan's capture of 2026-09-07; the crumb reads Admin › Committee › Labor.
  committee: "Labor",
  crypto: "Crypto Wallet",
  database: "Data Pipeline",
  finance: "Finance",
  skeleton: "Dashboard Skeleton",
  "apps/email": "Email",
  "apps/chat": "Chat",
  "apps/calendar": "Calendar",
  "apps/stream": "Stream",
  videos: "Videos",
  roster: "Roster",
  "apps/users/create": "Create User",
  "components/charts": "Charts",
  "components/stats": "Stats",
  "components/widgets": "Widgets",
  "components/tables": "Data Table",
}

/** The pages about one thing, and what each is about until it reads a real one; the crumb's last word is a switcher for these (Brendan, 2026-09-07). */
export const SUBJECTS: Record<string, { kind: "committee" | "member"; fallback: string }> = {
  committee: { kind: "committee", fallback: "Labor" },
  member: { kind: "member", fallback: MEMBER },
}

export function adminTitle(page: string): string {
  if (TITLES[page]) return TITLES[page]
  if (page === "settings" || page.startsWith("settings/")) return "Settings"
  if (/^auth-[123]\//.test(page)) return "Authentication"
  if (page.startsWith("menu/")) return "Menu Levels"
  return "Admin"
}

export function AdminPage({ page }: { page: string }) {
  switch (page) {
    case "":
    case "sales":
      return <SalesPage />
    case "logs":
      return <LogsPage />
    case "roll-call":
      return <RollCallPage />
    case "customers":
      return <CustomersPage />
    case "member":
      return <MemberPage />
    case "orders":
      return <OrdersPage />
    case "traffic":
      return <TrafficPage />
    // The template's AI Tokens page keeps its sample figures, reachable by its old address.
    case "ai":
      return <AiPage />
    case "education":
      return <EducationPage />
    case "committee":
      return <CommitteePage />
    case "crypto":
      return <CryptoPage />
    case "database":
      return <DatabasePage />
    case "finance":
      return <FinancePage />
    case "skeleton":
      return <SkeletonPage />
    case "apps/email":
      return <EmailPage />
    case "apps/chat":
      return <ChatPage />
    case "apps/calendar":
      return <CalendarPage />
    case "apps/stream":
      return <StreamPage />
    case "videos":
      return <VideosPage />
    case "roster":
      return <UsersPage />
    case "apps/users/create":
      return <UsersCreatePage />
    default:
      if (page === "settings" || page.startsWith("settings/")) return <SettingsPage page={page} />
      if (/^auth-[123]\//.test(page)) return <AuthPage page={page} />
      if (page.startsWith("components/")) return <ComponentsPage page={page} />
      if (page.startsWith("menu/")) return <MenuPage page={page} />
      return <SalesPage />
  }
}
