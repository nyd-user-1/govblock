"use client"

import * as React from "react"
import { IconCheck, IconChevronDown, IconCopy } from "@tabler/icons-react"
import { GitBranchIcon, GitCompareArrowsIcon, TypeIcon, VideoIcon } from "lucide-react"

import { BookmarkButton } from "@/components/bookmark-button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Button } from "@govblock/ui/components/ny4/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@govblock/ui/components/ny4/popover"
import { Separator } from "@govblock/ui/components/ny4/separator"

/** Where the page opens in Typeset, when it is a bill: the editor, its printings compared, and Git. */
export type TypesetLinks = { typeset?: string; diff?: string; git?: string }

const menuItems: Record<
  string,
  (url: string, page: string, links?: TypesetLinks) => React.ReactNode
> = {
  // Our own editor in place of Google Docs (Brendan, 2026-09-09): the page's
  // record, opened in the Typeset workspace. Only a page that names where it
  // lives there offers it.
  // The page's printings compared, as Typeset's Diff page (2026-09-11). Only
  // a record with more than one printing names where that lives.
  typeset: (_url: string, _page: string, links?: TypesetLinks) =>
    links?.typeset ? (
      <a href={links.typeset} className="flex w-full items-center gap-2">
        <TypeIcon className="size-4" aria-hidden />
        Open in Typeset
      </a>
    ) : null,
  diff: (_url: string, _page: string, links?: TypesetLinks) =>
    links?.diff ? (
      <a href={links.diff} className="flex w-full items-center gap-2">
        <GitCompareArrowsIcon className="size-4" aria-hidden />
        Diff in Typeset
      </a>
    ) : null,
  git: (_url: string, _page: string, links?: TypesetLinks) =>
    links?.git ? (
      <a href={links.git} className="flex w-full items-center gap-2">
        <GitBranchIcon className="size-4" aria-hidden />
        Open in Git
      </a>
    ) : null,
  // The page as a video (Brendan, 2026-09-20): the clips Studio, opened on this
  // page's link. Only where the menu stands for other reasons.
  clip: (url: string) => (
    <a href={`/clips/studio?link=${encodeURIComponent(url)}`} className="flex w-full items-center gap-2">
      <VideoIcon className="size-4" aria-hidden />
      Make Clip
    </a>
  ),
}

// The page's controls (Brendan, 2026-09-12): Copy page with its word back
// (Brendan, 2026-09-17) and the menu, as one group. The docs shell's button
// group since 2026-09-20 (Brendan): a page's plus stands before the group, a
// button of its own; Typeset, Diff and Git are menu entries where the page has
// somewhere for them to go, their three icons gone from the group, and Make
// Clip the fourth; View as Markdown, v0, ChatGPT and Claude came off. A page
// can add its own entries above them. A page with none of those has no menu
// (Brendan, the same day: Make Clip alone "doesn't make sense here"): Copy page
// stands by itself, and a bookmark stands before it, keeping the page in
// /bookmarks.
export function DocsCopyPage({
  page,
  url,
  typeset,
  diff,
  git,
  extra,
  menu,
  label,
}: {
  page: string
  url: string
  /** The group as a picker instead (a jurisdiction's charts, 2026-09-20): this word and the chevron as one button in Copy page's place, opening the page's own entries and nothing else. */ label?: string
  /** A page's own entries at the top of the menu: a tour, a map (2026-09-17). Each is a link or a button, one line. */ menu?: React.ReactNode[]
  /** Where this page opens in the Typeset workspace, when it does. */ typeset?: string
  /** Where its printings open compared in Typeset, when it has more than one. */ diff?: string
  /** Where it opens as a file in Git, when it is a bill. */ git?: string
  /** A button before the group, on its own: a bill's plus, its journey as a video (2026-09-15). */ extra?: React.ReactNode
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard()
  const links: TypesetLinks = { typeset, diff, git }
  const hasMenu = !label && ((menu?.length ?? 0) > 0 || Boolean(typeset || diff || git))
  // "# Title", a blank line, the description: what the page hands Copy page.
  const [heading, , ...rest] = page.split("\n")
  const bookmark = { title: heading.replace(/^#\s*/, ""), detail: rest.join(" ").trim().slice(0, 240) || null }

  const trigger = (
    <Button
      variant="secondary"
      size="sm"
      className="peer -ml-0.5 size-8 shadow-none md:size-7 md:text-[0.8rem]"
    >
      <IconChevronDown className="rotate-180 sm:rotate-0" />
    </Button>
  )

  return (
    <Popover>
      <div className="flex items-center gap-2">
        {extra}
        {!hasMenu && <BookmarkButton {...bookmark} />}
        {label && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8 shadow-none md:h-7 md:text-[0.8rem]">
                {label}
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            {/* Every entry on one row, and a long list scrolls inside the menu. */}
            <DropdownMenuContent align="end" className="animate-none! max-h-80 w-max min-w-44 overflow-y-auto rounded-lg shadow-none">
              {(menu ?? []).map((node, i) => (
                <DropdownMenuItem key={i} asChild className="whitespace-nowrap">
                  {node}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className={label ? "hidden" : "group/buttons relative flex rounded-lg bg-secondary *:[[data-slot=button]]:focus-visible:relative *:[[data-slot=button]]:focus-visible:z-10"}>
          <PopoverAnchor />
          <Button variant="secondary" size="sm" className="h-8 shadow-none md:h-7 md:text-[0.8rem]" onClick={() => copyToClipboard(page)}>
            {isCopied ? <IconCheck /> : <IconCopy />}
            {isCopied ? "Copied" : "Copy page"}
          </Button>
          {hasMenu && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="hidden sm:flex">
                  {trigger}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="animate-none! rounded-lg shadow-none"
                >
                  {(menu ?? []).map((node, i) => (
                    <DropdownMenuItem key={`own-${i}`} asChild>
                      {node}
                    </DropdownMenuItem>
                  ))}
                  {Object.entries(menuItems).map(([key, value]) => {
                    const node = value(url, page, links)
                    return node ? (
                      <DropdownMenuItem key={key} asChild>
                        {node}
                      </DropdownMenuItem>
                    ) : null
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Separator
                orientation="vertical"
                className="absolute top-1 right-8 z-0 h-6! bg-foreground/5! peer-focus-visible:opacity-0 sm:right-7 sm:h-5!"
              />
              <PopoverTrigger asChild className="flex sm:hidden">
                {trigger}
              </PopoverTrigger>
              <PopoverContent
                className="w-52 origin-center! rounded-lg bg-background/70 p-1 shadow-none backdrop-blur-sm dark:bg-background/60"
                align="start"
              >
                {(menu ?? []).map((node, i) => (
                  <Button variant="ghost" size="lg" asChild key={`own-${i}`} className="w-full justify-start text-base font-normal">
                    {node}
                  </Button>
                ))}
                {Object.entries(menuItems).map(([key, value]) => (
                  <Button
                    variant="ghost"
                    size="lg"
                    asChild
                    key={key}
                    className="w-full justify-start text-base font-normal"
                  >
                    {value(url, page, links)}
                  </Button>
                ))}
              </PopoverContent>
            </>
          )}
        </div>
      </div>
    </Popover>
  )
}
