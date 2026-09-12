import { cn } from "@govblock/ui/lib/utils"
import { BotIcon, ComponentIcon, DownloadIcon, GitCompareIcon, GitForkIcon, MessageSquareIcon, TerminalIcon } from "lucide-react"
import { Activity } from "@govblock/ui/components/animate-ui/icons/activity"
import { CupSoda } from "@govblock/ui/components/animate-ui/icons/cup-soda"
import { Eye } from "@govblock/ui/components/animate-ui/icons/eye"
import { Flame } from "@govblock/ui/components/animate-ui/icons/flame"
import { Layers } from "@govblock/ui/components/animate-ui/icons/layers"
import { MapPin } from "@govblock/ui/components/animate-ui/icons/map-pin"
import { MessagesSquare } from "@govblock/ui/components/animate-ui/icons/messages-square"
import { Rss } from "@govblock/ui/components/animate-ui/icons/rss"
import { Tag } from "@govblock/ui/components/animate-ui/icons/tag"
import { Trophy } from "@govblock/ui/components/animate-ui/icons/trophy"
import { Blocks } from "@govblock/ui/components/animate-ui/icons/blocks"
import { BookMarked } from "@govblock/ui/components/animate-ui/icons/book-marked"
import { BookOpen } from "@govblock/ui/components/animate-ui/icons/book-open"
import { BookUser } from "@govblock/ui/components/animate-ui/icons/book-user"
import { Braces } from "@govblock/ui/components/animate-ui/icons/braces"
import { CalendarDays } from "@govblock/ui/components/animate-ui/icons/calendar-days"
import { ClipboardList } from "@govblock/ui/components/animate-ui/icons/clipboard-list"
import { Coffee } from "@govblock/ui/components/animate-ui/icons/coffee"
import { Coins } from "@govblock/ui/components/animate-ui/icons/coins"
import { Database } from "@govblock/ui/components/animate-ui/icons/database"
import { FileDown } from "@govblock/ui/components/animate-ui/icons/file-down"
import { FileSignature } from "@govblock/ui/components/animate-ui/icons/file-signature"
import { FileText } from "@govblock/ui/components/animate-ui/icons/file-text"
import { Gavel } from "@govblock/ui/components/animate-ui/icons/gavel"
import { Handshake } from "@govblock/ui/components/animate-ui/icons/handshake"
import { History } from "@govblock/ui/components/animate-ui/icons/history"
import { Inbox } from "@govblock/ui/components/animate-ui/icons/inbox"
import { Landmark } from "@govblock/ui/components/animate-ui/icons/landmark"
import { LayoutDashboard } from "@govblock/ui/components/animate-ui/icons/layout-dashboard"
import { Library } from "@govblock/ui/components/animate-ui/icons/library"
import { ListChecks } from "@govblock/ui/components/animate-ui/icons/list-checks"
import { Mic } from "@govblock/ui/components/animate-ui/icons/mic"
import { Newspaper } from "@govblock/ui/components/animate-ui/icons/newspaper"
import { NotebookPen } from "@govblock/ui/components/animate-ui/icons/notebook-pen"
import { Radar } from "@govblock/ui/components/animate-ui/icons/radar"
import { Receipt } from "@govblock/ui/components/animate-ui/icons/receipt"
import { Scale } from "@govblock/ui/components/animate-ui/icons/scale"
import { ScrollText } from "@govblock/ui/components/animate-ui/icons/scroll-text"
import { SquarePlay } from "@govblock/ui/components/animate-ui/icons/square-play"
import { Stamp } from "@govblock/ui/components/animate-ui/icons/stamp"
import { Tags } from "@govblock/ui/components/animate-ui/icons/tags"
import { Type } from "@govblock/ui/components/animate-ui/icons/type"
import { UserCheck } from "@govblock/ui/components/animate-ui/icons/user-check"
import { Users } from "@govblock/ui/components/animate-ui/icons/users"

// The one place a lucide name from `lib/config.ts` becomes a component. That
// file stays data and never imports a component; the nav panel and the search
// results both read this map, so a page's icon is the same in both.
//
// Every entry is animate-ui's redrawing of the lucide glyph: identical at
// rest, and it moves when an `AnimateIcon` ancestor says so (the nav rows do,
// on hover). Anywhere else it is just the icon. Five came from the registry on
// 2026-09-09; the other 27 were drawn in the same pattern from lucide's paths.
type NavIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

export const NAV_ICONS: Record<string, NavIcon> = {
  // Two lucide icons where animate-ui has no drawing yet (Brendan, 2026-09-11: "chat and diff are both missing an icon").
  GitCompare: GitCompareIcon,
  Bot: BotIcon,
  Component: ComponentIcon,
  Download: DownloadIcon,
  Terminal: TerminalIcon,
  GitFork: GitForkIcon,
  MessageSquare: MessageSquareIcon,
  Activity,
  CupSoda,
  Eye,
  Flame,
  Layers,
  MapPin,
  MessagesSquare,
  Rss,
  Tag,
  Trophy,
  Blocks,
  BookMarked,
  BookOpen,
  BookUser,
  Braces,
  CalendarDays,
  ClipboardList,
  Coffee,
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
  NotebookPen,
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
export function PageIcon({
  name,
  className,
}: {
  name?: string
  className?: string
}) {
  const Icon = name ? NAV_ICONS[name] : undefined
  return Icon ? (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  ) : null
}
