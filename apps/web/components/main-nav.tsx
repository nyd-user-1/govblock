"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & { items: { href: string; label: string }[] }) {
  const pathname = usePathname()

  return (
    <nav className={cn("items-center gap-0", className)} {...props}>
      {items.map((item) => (
        <Button key={item.href} variant="ghost" asChild size="sm" className="px-2.5">
          <Link href={item.href} data-active={pathname === item.href} className="relative items-center">
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  )
}
