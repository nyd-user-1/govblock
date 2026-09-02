"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  BookOpen,
  BookUser,
  ClipboardList,
  FileText,
  Newspaper,
  Scale,
  ScrollText,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { NavItem } from "@/lib/config"
import { cn } from "@govblock/ui/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@govblock/ui/components/ny4/navigation-menu"

// Five top-level entries, three of them panels. Ported from livingston-v3's
// flat nav and regrouped: Committees and Directory used to sit beside the Docs
// they belong inside, and Laws, Nominations and The Record had no way in at
// all. Each panel line carries the sentence that says what the page is for,
// because the nav is the only place most people will read it.

function hasItems(item: NavItem): item is Extract<NavItem, { items: unknown[] }> {
  return "items" in item && Array.isArray(item.items)
}

// The only place a lucide name becomes a component. `lib/config.ts` stays data,
// and an icon that is not in this map simply does not draw — a panel line
// without one is the layout every panel had until today.
const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  BookUser,
  ClipboardList,
  FileText,
  Newspaper,
  Scale,
  ScrollText,
  UserCheck,
  Users,
}

// Two columns is the panel this nav has always drawn. Records asked for four
// across and two down, which is eight entries — so the width follows the count
// rather than a fixed `w-[26rem]`.
const GRID: Record<number, string> = {
  2: "w-[26rem] md:grid-cols-2",
  3: "w-[42rem] md:grid-cols-3",
  4: "w-[54rem] md:grid-cols-4",
}

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & { items: readonly NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className={cn("items-center gap-0", className)} {...props}>
      <NavigationMenu viewport={false} className="max-w-none">
        <NavigationMenuList className="gap-0">
          {items.map((item) =>
            hasItems(item) ? (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuTrigger
                  data-active={item.items.some((entry) => pathname === entry.href) || undefined}
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className={cn("grid gap-1 p-2", GRID[item.columns ?? 2] ?? GRID[2])}>
                    {item.items.map((entry) => {
                      const Icon = entry.icon ? ICONS[entry.icon] : undefined
                      return (
                        <li key={entry.href}>
                          <NavigationMenuLink asChild data-active={pathname === entry.href || undefined}>
                            <Link href={entry.href} className={cn(Icon && "flex-row items-start gap-2.5")}>
                              {Icon && <Icon aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />}
                              {/* The description aligns under the title, not
                                  under the icon — shadcn's feature grids. */}
                              <span className="flex min-w-0 flex-col gap-1">
                                <span className="font-medium">{entry.label}</span>
                                {entry.description && (
                                  <span className="text-xs leading-snug text-muted-foreground">
                                    {entry.description}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      )
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ) : (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink
                  asChild
                  data-active={pathname === item.href || undefined}
                  className={cn(navigationMenuTriggerStyle(), "flex-row")}
                >
                  <Link href={item.href}>{item.label}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          )}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}

