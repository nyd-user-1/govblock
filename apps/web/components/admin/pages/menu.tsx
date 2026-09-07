"use client"

import { SquareStackIcon } from "lucide-react"

import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@govblock/ui/components/nova/card"

// paceui's Menu Levels: three levels of rail to demonstrate the nesting, and
// a page that says which level you reached.

export function MenuPage({ page }: { page: string }) {
  const parts = page.replace("menu/", "").split("/")
  const label = parts.map((p) => `Level ${p}`).join(" › ")
  return (
    <div>
      <PageTitle title="Menu Levels" />
      <Card className="mt-4 sm:mt-5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SquareStackIcon className="size-4" />
            <CardAnchor>{label}</CardAnchor>
          </div>
          <CardDescription>The rail nests collapsibles as deep as an item needs. This page was reached from {parts.length === 1 ? "the first" : "the second"} level.</CardDescription>
          <CardAction>
            <CardTools />
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">at=admin/{page}</code>
        </CardContent>
      </Card>
    </div>
  )
}
