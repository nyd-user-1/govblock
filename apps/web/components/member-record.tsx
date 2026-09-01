"use client"

import * as React from "react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@govblock/ui/components/nova/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"

// Ported from livingston-v3 components/policy/member-record.tsx: the member's
// record — sponsored, aye, nay. The record itself is not wired yet.
export function MemberRecordButton({ name, subtitle, session }: { name: string; subtitle?: string; session: string }) {
  const [open, setOpen] = React.useState(false)
  const counts = { sponsored: 0, aye: 0, nay: 0 }
  const empty = <p className="py-8 text-center text-sm text-muted-foreground">Nothing on file for this session.</p>
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Record</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {subtitle ? `${subtitle} · ` : ""}
            {counts.sponsored} sponsored · {counts.aye} aye · {counts.nay} nay
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="sponsored">
          <TabsList>
            <TabsTrigger value="sponsored">
              Sponsor
              <Badge variant="outline">{counts.sponsored}</Badge>
            </TabsTrigger>
            <TabsTrigger value="aye">
              AYE
              <Badge variant="outline">{counts.aye}</Badge>
            </TabsTrigger>
            <TabsTrigger value="nay">
              NAY
              <Badge variant="outline">{counts.nay}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sponsored">{empty}</TabsContent>
          <TabsContent value="aye">{empty}</TabsContent>
          <TabsContent value="nay">{empty}</TabsContent>
        </Tabs>
        <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Distinct bills, current session</span>
          <span>{session}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
