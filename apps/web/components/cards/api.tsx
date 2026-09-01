"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CopyButton } from "@/components/copy-button"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// API — the same numbers this page renders, as JSON, for the scope in the
// header. The card is the documentation: the URL it shows is meant to be live.
export function ApiCard() {
  const path = `/api/policy/bills?state=${F.STATE}&limit=5`
  const command = `curl https://govblock.app${path}`
  return (
    <CardFrame id="api">
      <CardHeader>
        <CardTitle>API</CardTitle>
        <CardDescription>Every number on this page, as JSON</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-lg bg-muted p-3 pr-10 font-mono text-xs break-all">
          {command}
          <CopyButton value={command} className="absolute top-2 right-2" variant="ghost" />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" nativeButton={false} render={<Link href={path} target="_blank" />}>
          Try it
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/docs" />}>
          Docs
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
