"use client"

import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@govblock/ui/components/animate-ui/components/animate/tabs"

// A reader's activity under /glossary's animated tabs (Brendan, 2026-09-18):
// the tabs above the block at its left, the views inside the one block.

export function ActivityTabs({ tabs }: { tabs: { value: string; label: string; content: React.ReactNode }[] }) {
  return (
    <Tabs defaultValue={tabs[0]!.value} className="not-typeset mt-4 gap-0">
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="mt-2 rounded-2xl border p-4">
        <TabsContents>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              {t.content}
            </TabsContent>
          ))}
        </TabsContents>
      </div>
    </Tabs>
  )
}
