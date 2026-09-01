"use client"

import Link from "next/link"
import { EllipsisVertical, Pin } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"

// Ported from livingston-v3 components/policy/project-card.tsx: the
// Claude-projects card — seal, name, one line of meta, and a ⋮ menu that shows
// on hover. Pin, Edit details and Alert are inert here.

export function ProjectGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="project-grid" className={cn("grid grid-cols-1 gap-6 md:grid-cols-2", className)} {...props} />
}

export function ProjectCard({
  href,
  media,
  title,
  meta,
  feedHref,
  className,
}: {
  href: string
  media?: React.ReactNode
  title: string
  meta: React.ReactNode
  feedHref?: string
  className?: string
}) {
  return (
    <div
      data-slot="project-card"
      className={cn(
        "group/project relative flex h-[132px] flex-col justify-between rounded-xl border bg-card p-6 transition-colors hover:bg-accent/40",
        className
      )}
    >
      <Link href={href} className="absolute inset-0 z-0 rounded-xl no-underline">
        <span className="sr-only">{title}</span>
      </Link>
      <div className="pointer-events-none relative z-1 flex min-w-0 items-start gap-3">
        {media}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
        </div>
      </div>
      <div className="pointer-events-none relative z-1 truncate text-xs text-muted-foreground tabular-nums">{meta}</div>
      <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover/project:opacity-100 focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${title} actions`} />}>
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>
              <Pin />
              Pin
            </DropdownMenuItem>
            <DropdownMenuItem>Edit details</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<a href={feedHref ?? "#"} target="_blank" rel="noreferrer" />}>Subscribe</DropdownMenuItem>
            <DropdownMenuItem>Alert</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
