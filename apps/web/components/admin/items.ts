import {
  ActivityIcon,
  CalendarIcon,
  ChartAreaIcon,
  CoinsIcon,
  FileTextIcon,
  GraduationCapIcon,
  LayoutGridIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  Settings2Icon,
  ShieldUserIcon,
  ShoppingCartIcon,
  SquareStackIcon,
  TableIcon,
  TrendingUpIcon,
  UserCheckIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"

// The Admin rail, entry for entry as paceui's Ultimate Dashboard lists it
// (Brendan, 2026-09-05: "I went through virtually the entire left rail by
// hand … make sure you build all of them out"). A `page` is the part of
// `at=admin/<page>` after the slash; the Session page is `at=admin` itself.
// The dots are paceui's tags: red for trending, grey for coming soon, the
// primary colour for new.

export type MenuItem = {
  label: string
  isTitle?: boolean
  icon?: LucideIcon
  page?: string
  items?: MenuItem[]
  tag?: "coming-soon" | "new" | "trend"
}

export const ADMIN_MENU: MenuItem[] = [
  { label: "Dashboards", isTitle: true },
  // Two buckets by eye (Brendan, 2026-09-07): the dashboards he has reviewed
  // first, A to Z and without icons; then the ones still to review, as they
  // were. Nothing else changes until he has been through them.
  { label: "Committee", page: "committee", tag: "trend" },
  { label: "Database", page: "database", tag: "trend" },
  { label: "Finance", page: "finance", tag: "trend" },
  { label: "Member", page: "member" },
  { label: "Roll Call", page: "roll-call" },
  // paceui's Sales, as the session (Brendan, 2026-09-07: "sales is now session"); the empty id.
  { label: "Session", page: "" },
  { label: "Log", icon: FileTextIcon, page: "logs" },
  { label: "Customer", icon: UserCheckIcon, page: "customers" },
  { label: "Order", icon: ShoppingCartIcon, page: "orders" },
  // paceui's AI Tokens, as the site's traffic: Cloudflare and Amplify, live.
  { label: "Traffic", icon: ActivityIcon, page: "traffic", tag: "trend" },
  { label: "Education", icon: GraduationCapIcon, page: "education", tag: "trend" },
  { label: "Crypto", icon: CoinsIcon, page: "crypto", tag: "trend" },
  // Skeleton left the rail on 2026-09-07: it is the loading state between dashboards now (app/workspace/dashboard/[...page]/loading.tsx), still at admin/skeleton by address.
  { label: "Apps", isTitle: true },
  { label: "Email", icon: MailIcon, page: "apps/email", tag: "coming-soon" },
  { label: "Chat", icon: MessageSquareIcon, page: "apps/chat", tag: "coming-soon" },
  { label: "Calendar", icon: CalendarIcon, page: "apps/calendar", tag: "coming-soon" },
  // Cloudflare Stream: the library, a player, imports, live inputs (2026-09-06).
  { label: "Stream", icon: VideoIcon, page: "apps/stream", tag: "new" },
  {
    label: "Users",
    icon: UsersIcon,
    items: [
      // The list is the roster, at /workspace/dashboard/roster (Brendan, 2026-09-07).
      { label: "Roster", page: "roster" },
      { label: "Create", page: "apps/users/create" },
    ],
  },
  { label: "Page", isTitle: true },
  {
    label: "Settings",
    icon: Settings2Icon,
    tag: "new",
    items: [
      { label: "My profile", page: "settings/profile" },
      { label: "Plan", page: "settings/plan" },
      { label: "Billing", page: "settings/billing" },
      { label: "Notifications", page: "settings/notifications" },
      { label: "Password", page: "settings/password" },
      { label: "Account security", page: "settings/account-security" },
      { label: "API", page: "settings/api" },
    ],
  },
  {
    label: "Authentication",
    icon: ShieldUserIcon,
    tag: "coming-soon",
    items: [1, 2, 3].map((v) => ({
      label: `Variant ${v}`,
      items: [
        { label: "Login", page: `auth-${v}/login` },
        { label: "Register", page: `auth-${v}/register` },
        { label: "Forgot Password", page: `auth-${v}/forgot-password` },
        { label: "Reset Password", page: `auth-${v}/reset-password` },
        { label: "Verify Email", page: `auth-${v}/verify-email` },
        { label: "2 FA", page: `auth-${v}/2-factor-authentication` },
      ],
    })),
  },
  { label: "Components", isTitle: true },
  { label: "Charts", icon: ChartAreaIcon, page: "components/charts" },
  { label: "Stats", icon: TrendingUpIcon, page: "components/stats" },
  { label: "Widgets", icon: LayoutGridIcon, page: "components/widgets" },
  { label: "Data Table", icon: TableIcon, page: "components/tables" },
  { label: "Other", isTitle: true },
  {
    label: "Menu Levels",
    icon: SquareStackIcon,
    items: [
      {
        label: "Level 1a",
        items: [
          { label: "Level 2a", page: "menu/1a/2a" },
          { label: "Level 2b", page: "menu/1a/2b" },
        ],
      },
      { label: "Level 1b", page: "menu/1b" },
    ],
  },
]

/** The rail's labels down to a page — ["Users", "Create"] for apps/users/create, ["Users", "Roster"] for roster, ["Session"] for "" — each with its own page where it has one; [] when the rail has no such page. The crumb follows the route with these (Brendan, 2026-09-07). */
export function menuPath(page: string): { label: string; page?: string }[] {
  const walk = (items: MenuItem[], trail: { label: string; page?: string }[]): { label: string; page?: string }[] | null => {
    for (const item of items) {
      if (item.isTitle) continue
      const here = [...trail, { label: item.label, page: item.page }]
      if (item.page === page) return here
      if (item.items) {
        const hit = walk(item.items, here)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(ADMIN_MENU, []) ?? []
}

/** The title a page reads under, walking the rail: "Logs Analytics" is the page's own; this is the rail's word for it. */
export function menuLabel(page: string): string {
  const walk = (items: MenuItem[]): string | null => {
    for (const item of items) {
      if (item.page === page) return item.label
      if (item.items) {
        const hit = walk(item.items)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(ADMIN_MENU) ?? "Admin"
}
