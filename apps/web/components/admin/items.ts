import {
  ActivityIcon,
  CalendarIcon,
  ChartAreaIcon,
  CoinsIcon,
  DatabaseIcon,
  FileTextIcon,
  GavelIcon,
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
  UserIcon,
  UsersIcon,
  VideoIcon,
  VoteIcon,
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
  // paceui's Sales, as the session (Brendan, 2026-09-07: "sales is now session").
  { label: "Session", icon: TrendingUpIcon, page: "" },
  { label: "Log", icon: FileTextIcon, page: "logs" },
  { label: "Roll Call", icon: VoteIcon, page: "roll-call" },
  { label: "Customer", icon: UserCheckIcon, page: "customers" },
  { label: "Member", icon: UserIcon, page: "member" },
  { label: "Order", icon: ShoppingCartIcon, page: "orders" },
  // paceui's AI Tokens, as the site's traffic: Cloudflare and Amplify, live.
  { label: "Traffic", icon: ActivityIcon, page: "traffic", tag: "trend" },
  { label: "Education", icon: GraduationCapIcon, page: "education", tag: "trend" },
  // The Education page reshaped as a committee's dashboard (Brendan, 2026-09-07).
  { label: "Committee", icon: GavelIcon, page: "committee", tag: "trend" },
  { label: "Crypto", icon: CoinsIcon, page: "crypto", tag: "trend" },
  { label: "Database", icon: DatabaseIcon, page: "database", tag: "trend" },
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
      { label: "List", page: "apps/users" },
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
