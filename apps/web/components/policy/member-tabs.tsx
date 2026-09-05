"use client"

import * as React from "react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"

// Two tabs over content the server already rendered, passed in as children.
// Brendan, 2026-09-05: the member's record is two blocks, not one — Bills
// (Prime Sponsor · Co-Sponsor) and Votes (Aye · Nay) — so the block takes its
// pair of tabs and is mounted once under each heading.
export function MemberTabs({
  tabs,
  menu,
}: {
  /** What sits at the row's right end, inline with the tabs: the Sessions menu. */
  menu?: React.ReactNode
  tabs: [
    { value: string; label: string; emoji: string; count: number; content: React.ReactNode },
    { value: string; label: string; emoji: string; count: number; content: React.ReactNode },
  ]
}) {
  // The emoji are Brendan's, and they are emoji rather than icons on purpose
  // — they read at pill size and carry the states apart at a glance. The
  // Sessions menu rides the same row, at its right end (Brendan, 2026-09-05).
  return (
    <Tabs defaultValue={tabs[0].value} className="not-typeset">
      <div className="flex items-center">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <span aria-hidden>{t.emoji}</span> {t.label} <Badge variant="outline">{t.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {menu}
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
