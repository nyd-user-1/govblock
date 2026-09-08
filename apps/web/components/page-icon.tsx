import { Blocks, BookMarked, BookOpen, BookUser, Braces, CalendarDays, ClipboardList, Coins, Database, FileDown, FileSignature, FileText, Gavel, Handshake, History, Inbox, Landmark, LayoutDashboard, Library, ListChecks, type LucideIcon, Mic, Newspaper, Radar, Receipt, Scale, ScrollText, SquarePlay, Stamp, Tags, Type, UserCheck, Users } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// The one place a lucide name from `lib/config.ts` becomes a component. That
// file stays data and never imports a component; the nav panel and the search
// results both read this map, so a page's icon is the same in both.
export const NAV_ICONS: Record<string, LucideIcon> = {
  Blocks,
  BookMarked,
  BookOpen,
  BookUser,
  Braces,
  CalendarDays,
  ClipboardList,
  Coins,
  Database,
  FileDown,
  FileSignature,
  FileText,
  Gavel,
  Handshake,
  History,
  Inbox,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  Mic,
  Newspaper,
  Radar,
  Receipt,
  Scale,
  ScrollText,
  SquarePlay,
  Stamp,
  Tags,
  Type,
  UserCheck,
  Users,
}

/** Nothing draws where a page has no icon, which is the row this list had before. */
export function PageIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? NAV_ICONS[name] : undefined
  return Icon ? <Icon aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", className)} /> : null
}
