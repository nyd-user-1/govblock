"use client"

import * as React from "react"
import { DatabaseIcon } from "lucide-react"

import { installLines } from "@/lib/workspace/registry-items"
import { CommandBlock } from "@/components/command-block"
import { Switch } from "@govblock/ui/components/ny4/switch"
import { Label } from "@govblock/ui/components/nova/label"

// The install command for one registry item, and — where the item ships rows
// — the switch that adds its data set to the command (Brendan, 2026-09-12:
// "our pro plan is to ship the data with the component"). Copy is the
// command block's own.
export function InstallCommand({ name, data }: { name: string; data?: { item: string; what: string; rows: string } }) {
  // On by default (a reviewer, 2026-09-12): the usage imports the data file, so an install with it off and a paste of the usage was module-not-found.
  const [withData, setWithData] = React.useState(true)
  const tabs = (["pnpm", "npm", "yarn", "bun"] as const).map((pm) => ({ value: pm, label: pm, lines: installLines(name, pm, withData && data ? data.item : null) }))
  return (
    <div>
      {data && (
        <div className="not-typeset mt-6 flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <DatabaseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <Label htmlFor={`data-${name}`} className="text-sm font-medium">
              Add the data set
            </Label>
            <p className="text-xs text-muted-foreground">
              {data.rows}, as <code>{data.item}</code>. Off, only the component installs.
            </p>
          </div>
          <Switch id={`data-${name}`} checked={withData} onCheckedChange={setWithData} />
        </div>
      )}
      <CommandBlock tabs={tabs} />
    </div>
  )
}
