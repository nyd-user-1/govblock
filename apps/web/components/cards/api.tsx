"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CopyButton } from "@/components/copy-button"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { CardFoot } from "@/components/card-foot"

// API — the same numbers this page renders, as JSON, for the scope in the
// header. The card is the documentation: the URL it shows is meant to be live.
export function ApiCard() {
  const { state } = useJurisdiction()
  const path = `/api/policy/bills?state=${state}&limit=5`
  const command = `curl https://govblock.app${path}`
  return (
    <CardFrame id="api">
      <CardHeader>
        <CardAnchor>API</CardAnchor>
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
      <CardFoot href="/docs/api" label="The API">
        <Button size="sm" nativeButton={false} render={<Link href={path} target="_blank" />}>
          Try it
        </Button>
      </CardFoot>
    </CardFrame>
  )
}
