"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, PlusIcon } from "lucide-react"

import { setFollow, useFollows } from "@/lib/tags/use-follows"
import { Button } from "@govblock/ui/components/ny4/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// Following a tag (Brendan, 2026-09-18), as daily.dev does it: a row lights
// on hover and offers a plus, named by its tooltip; a tag already followed
// wears a green check instead, and the check unfollows it.

function Action({ slug, followed }: { slug: string; followed: boolean }) {
  const button = (
    <button
      type="button"
      aria-label={followed ? `Unfollow #${slug}` : `Follow #${slug}`}
      onClick={() => setFollow(slug, !followed)}
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md transition-colors", followed ? "text-emerald-600 hover:bg-background dark:text-emerald-400" : "bg-background text-foreground shadow-xs hover:bg-muted")}
    >
      {followed ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
    </button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top" sideOffset={6}>
        {followed ? `Unfollow #${slug}` : `Follow #${slug}`}
      </TooltipContent>
    </Tooltip>
  )
}

/** One tag in a list: the name, an optional count, and the follow control. */
export function TagItem({ slug, count }: { slug: string; count?: string }) {
  const follows = useFollows()
  const followed = follows.has(slug)
  const [hover, setHover] = React.useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} className="group flex h-8 items-center gap-2 rounded-md pr-1 hover:bg-muted">
      <Link href={`/tags/${slug}`} className="min-w-0 flex-1 truncate py-1 pl-2 text-sm text-foreground/90 no-underline group-hover:text-foreground">
        {slug}
      </Link>
      {count && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>}
      {/* Only the hovered row mounts its tooltip, so a thousand rows stay light. */}
      {followed || hover ? <Action slug={slug} followed={followed} /> : <span className="size-6 shrink-0" />}
    </div>
  )
}

/** The tag page's control: a small button of its own before the Copy page group, blue to be found and green once followed. */
export function FollowTagButton({ slug }: { slug: string }) {
  const followed = useFollows().has(slug)
  const label = followed ? `Unfollow #${slug}` : `Follow #${slug}`
  const button = (
    <Button size="icon" className={cn("extend-touch-target size-8 text-white shadow-none transition-colors md:size-7", followed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700")} onClick={() => setFollow(slug, !followed)} aria-pressed={followed} aria-label={label}>
      {followed ? <CheckIcon /> : <PlusIcon />}
    </Button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
