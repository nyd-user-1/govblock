"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// Lobbying — registrations, clients and reported spend, and who spends most.
export function LobbyingCard() {
  return (
    <CardFrame id="lobbying">
      <CardHeader>
        <CardTitle>Lobbying</CardTitle>
        <CardDescription>Registered lobbyists, and who pays them</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {F.lobbying.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/50 p-3">
              <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {F.lobbying.top.map((name, i) => (
            <div key={name} className="flex gap-3">
              <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
              {name}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/docs/lobbying?state=${F.STATE}`} />}>
          All registrations
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
