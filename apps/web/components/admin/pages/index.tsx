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
import { LogsPage } from "./logs"
import { MenuPage } from "./menu"
import { OrdersPage } from "./orders"
import { SalesPage } from "./sales"
import { SettingsPage } from "./settings"
import { SkeletonPage } from "./skeleton"
import { StreamPage } from "./stream"
import { UsersCreatePage } from "./users-create"
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
  customers: "Member Analytics",
  orders: "Bill Performance",
  traffic: "Traffic Observability",
  ai: "Cost & Usage Observability",
  education: "Education Management",
  // The Labor committee, from Brendan's capture of 2026-09-07; the crumb reads Admin › Committee › Labor.
  committee: "Labor",
  crypto: "Crypto Wallet",
  database: "Data Pipeline",
  skeleton: "Dashboard Skeleton",
  "apps/email": "Email",
  "apps/chat": "Chat",
  "apps/calendar": "Calendar",
  "apps/stream": "Stream",
  "apps/users": "Members",
  "apps/users/create": "Create User",
  "components/charts": "Charts",
  "components/stats": "Stats",
  "components/widgets": "Widgets",
  "components/tables": "Data Table",
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
    case "customers":
      return <CustomersPage />
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
    case "apps/users":
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
