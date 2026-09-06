"use client"

import { SquareStackIcon } from "lucide-react"

import { PageTitle } from "@/components/admin/page-title"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"

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
          <CardTitle className="flex items-center gap-2">
            <SquareStackIcon className="size-4" />
            {label}
          </CardTitle>
          <CardDescription>The rail nests collapsibles as deep as an item needs. This page was reached from {parts.length === 1 ? "the first" : "the second"} level.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">at=admin/{page}</code>
        </CardContent>
      </Card>
    </div>
  )
}
