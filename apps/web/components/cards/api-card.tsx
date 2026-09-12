"use client"

import * as React from "react"
import Link from "next/link"

import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { CopyButton } from "@/components/copy-button"
import { Button } from "@govblock/ui/components/button"
import { CardContent } from "@govblock/ui/components/card"

// API — the request that returns the numbers on the page, ready to copy and
// try. The URL it shows is meant to be live.
export function ApiCardBody({ path, origin = SITE, title = "API", action, href }: CardBodyProps & { path: string; origin?: string }) {
  const command = `curl ${origin}${path}`
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <div className="relative rounded-lg bg-muted p-3 pr-10 font-mono text-xs break-all">
          {command}
          <CopyButton value={command} className="absolute top-2 right-2" variant="ghost" />
        </div>
      </CardContent>
      <CardFoot href={href ?? `${SITE}/docs/api`} label="The API">
        <Button size="sm" nativeButton={false} render={<Link href={`${origin}${path}`} target="_blank" />}>
          Try it
        </Button>
      </CardFoot>
    </>
  )
}

export function ApiCard(props: React.ComponentProps<typeof ApiCardBody>) {
  return (
    <CardShell>
      <ApiCardBody {...props} />
    </CardShell>
  )
}
