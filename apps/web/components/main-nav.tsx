"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRightIcon } from "lucide-react"

import { Icons } from "@/components/icons"
import { NAV_ICONS as ICONS } from "@/components/page-icon"
import { hasItems, type NavItem } from "@/lib/config"
import { AnimateIcon } from "@govblock/ui/components/animate-ui/icons/icon"
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

// Two columns is the panel this nav has always drawn. Records runs four
// across and four down (Brendan, 2026-09-06) — so the width follows the
// column count rather than a fixed `w-[26rem]`.
// Two columns is the panel this nav has always drawn; the width follows the
// column count. Each column after the first carries a hairline on its left and
// the room to sit off it, so the panel reads as columns rather than a wrapped
// list (Brendan, 2026-09-08).
const GRID: Record<number, string> = {
  2: "w-[30rem] md:grid-cols-2 [&>li:not(:nth-child(2n+1))]:ml-4 [&>li:not(:nth-child(2n+1))]:border-l [&>li:not(:nth-child(2n+1))]:border-border/60 [&>li:not(:nth-child(2n+1))]:pl-4",
  3: "w-[48rem] md:grid-cols-3 [&>li:not(:nth-child(3n+1))]:ml-4 [&>li:not(:nth-child(3n+1))]:border-l [&>li:not(:nth-child(3n+1))]:border-border/60 [&>li:not(:nth-child(3n+1))]:pl-4",
  4: "w-[60rem] md:grid-cols-4 [&>li:not(:nth-child(4n+1))]:ml-4 [&>li:not(:nth-child(4n+1))]:border-l [&>li:not(:nth-child(4n+1))]:border-border/60 [&>li:not(:nth-child(4n+1))]:pl-4",
  5: "w-[70rem] md:grid-cols-5",
  6: "w-[82rem] md:grid-cols-6",
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
                  data-active={
                    item.items.some((entry) => pathname === entry.href) ||
                    undefined
                  }
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="p-0!">
                  <ul
                    className={cn(
                      "grid gap-y-1 p-2",
                      GRID[item.columns ?? 2] ?? GRID[2]
                    )}
                  >
                    {item.items.map((entry) => {
                      const Icon = entry.icon ? ICONS[entry.icon] : undefined
                      return (
                        <li key={entry.href}>
                          {/* AnimateIcon sits outside the menu link, not
                              between it and the anchor: its slot merges
                              classNames child-first, which put the link's
                              flex-col after the row's flex-row and stacked the
                              icon over the words (2026-09-09). Out here it only
                              adds pointer handlers, which the link passes down. */}
                          <AnimateIcon asChild animateOnHover>
                            <NavigationMenuLink
                              asChild
                              data-active={pathname === entry.href || undefined}
                            >
                              {/* A row sits in the page's own ink and only
                                answers on hover: the name turns blue, the icon
                                turns red, and the tint and edge arrive under
                                both (Brendan, 2026-09-08). The border is always
                                there and transparent, so nothing moves by a
                                pixel when it lights up. The whole row is the
                                hover target for the icon's animation too: an
                                animate-ui icon inside plays, a plain lucide
                                icon ignores it. */}
                              <Link
                                href={entry.href}
                                className={cn(
                                  "group/row rounded-md border border-transparent transition-colors hover:border-primary/20 hover:bg-primary/8 hover:text-primary focus-visible:border-primary/20 focus-visible:bg-primary/8 focus-visible:text-primary data-[active]:border-primary/20 data-[active]:bg-primary/8 data-[active]:text-primary",
                                  Icon && "flex-row items-start gap-2.5"
                                )}
                              >
                                {Icon && (
                                  <Icon
                                    aria-hidden
                                    className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover/row:text-red-600 group-focus-visible/row:text-red-600"
                                  />
                                )}
                                {/* The description aligns under the title, not
                                    under the icon — shadcn's feature grids. */}
                                <span className="flex min-w-0 flex-col gap-1">
                                  <span className="font-medium">
                                    {entry.label}
                                  </span>
                                  {entry.description && (
                                    <span className="text-xs leading-snug text-muted-foreground">
                                      {entry.description}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </NavigationMenuLink>
                          </AnimateIcon>
                        </li>
                      )
                    })}
                  </ul>
                  {/* One line out of the panel, the width of it: where the
                      whole section is explained rather than one page of it. */}
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className="group/foot flex h-9 flex-row items-center justify-between rounded-none rounded-b-md border-t bg-muted/40 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                    >
                      {item.footer ??
                        `Learn more about the GovBlocks ${item.label}`}
                      <ArrowRightIcon
                        aria-hidden
                        className="size-4 transition-transform group-hover/foot:translate-x-0.5"
                      />
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ) : (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink
                  asChild
                  data-active={pathname === item.href || undefined}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "flex-row gap-1.5"
                  )}
                >
                  <Link href={item.href}>
                    {/* The product's own item wears the block before its name (Brendan, 2026-09-11). */}
                    {item.href === "/" && <Icons.logo className="size-4 shrink-0" aria-hidden />}
                    {item.label}
                    {/* A flat entry can carry an icon as well. None does since
                        Creators moved into the Workspace menu (2026-09-09); the
                        seat stays for the next page that is video before it is
                        a word. */}
                    {(() => {
                      const Flat =
                        "icon" in item && item.icon
                          ? ICONS[item.icon]
                          : undefined
                      return Flat ? (
                        <Flat aria-hidden className="size-4" />
                      ) : null
                    })()}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          )}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}
