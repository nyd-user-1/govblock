"use client"

import * as React from "react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"

// Ported from livingston-v3 components/policy/member-tabs.tsx: three tabs over
// content the server already rendered, passed in as children.
export function MemberTabs({
  counts,
  sponsored,
  aye,
  nay,
}: {
  counts: { sponsored: number; aye: number; nay: number }
  sponsored: React.ReactNode
  aye: React.ReactNode
  nay: React.ReactNode
}) {
  // The pills sat tight under the Record heading; twelve pixels is what the
  // heading needed to stop touching them.
  return (
    <Tabs defaultValue="sponsored" className="not-typeset">
      <TabsList className="mt-3">
        <TabsTrigger value="sponsored">
          Sponsored <Badge variant="outline">{counts.sponsored}</Badge>
        </TabsTrigger>
        <TabsTrigger value="aye">
          AYE <Badge variant="outline">{counts.aye}</Badge>
        </TabsTrigger>
        <TabsTrigger value="nay">
          NAY <Badge variant="outline">{counts.nay}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sponsored">{sponsored}</TabsContent>
      <TabsContent value="aye">{aye}</TabsContent>
      <TabsContent value="nay">{nay}</TabsContent>
    </Tabs>
  )
}
