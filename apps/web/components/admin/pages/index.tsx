"use client"

import * as React from "react"

import { AiPage } from "./ai"
import { TrafficPage } from "./traffic"
import { AuthPage } from "./auth"
import { CalendarPage } from "./calendar"
import { ChatPage } from "./chat"
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
