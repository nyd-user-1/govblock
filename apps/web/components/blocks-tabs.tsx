"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { type BlocksTab } from "@/lib/blocks-tabs"
import { ScrollArea, ScrollBar } from "@govblock/ui/components/ny4/scroll-area"

// Ported from livingston-v3 components/blocks-tabs.tsx. The tab strip over
// /blocks. Tabs are paths (/blocks/vote), not a search param: each is its own
// statically generated page carrying one block, which keeps the response small.

export function BlocksTabsNav({ tabs }: { tabs: BlocksTab[] }) {
  const pathname = usePathname()
  const slug = pathname.replace(/^\/blocks\/?/, "")
  const active = slug || tabs[0]?.value

  return (
    <div className="relative overflow-hidden">
      <ScrollArea className="max-w-none">
        <div className="flex items-center">
          {tabs.map((tab, index) => (
            <Link
              key={tab.value}
              href={index === 0 ? "/blocks" : `/blocks/${tab.value}`}
              data-active={tab.value === active}
              className="flex h-7 items-center justify-center px-4 text-center text-base font-medium text-muted-foreground transition-colors hover:text-primary data-[active=true]:text-primary"
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  )
}
