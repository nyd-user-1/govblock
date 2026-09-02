"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
                  <ul className="grid w-[26rem] gap-1 p-2 md:grid-cols-2">
                    {item.items.map((entry) => (
                      <li key={entry.href}>
                        <NavigationMenuLink asChild data-active={pathname === entry.href || undefined}>
                          <Link href={entry.href}>
                            <span className="font-medium">{entry.label}</span>
                            {entry.description && (
                              <span className="text-xs leading-snug text-muted-foreground">
                                {entry.description}
                              </span>
                            )}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
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

