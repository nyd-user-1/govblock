"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import type { StateCount } from "@/lib/policy/states"
import { DesignFields, LegislativeFields, presetCode, type Design, type Filters } from "@/components/create/fields"
import { MainMenu } from "@/components/create/main-menu"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"

// The panel. Ported from livingston-v3's Customizer: a dark card, the header
// menu, the field set for the mode you are in, then preset · Open Preset ·
// Shuffle, and Get Code on its own.
export function Customizer(props: {
  mode: "state" | "design"
  setMode: (m: "state" | "design") => void
  filters: Filters
  setFilters: (patch: Partial<Filters>) => void
  design: Design
  setDesign: (patch: Partial<Design>) => void
  onShuffle: () => void
  onReset: () => void
  states: StateCount[]
  chambers: string[]
  committees: string[]
  members: string[]
  statuses: string[]
  entity: "bill" | "member" | "committee"
}) {
  const code = presetCode(props.design)
  const [copied, setCopied] = React.useState(false)
  const [openPreset, setOpenPreset] = React.useState(false)
  const [getCode, setGetCode] = React.useState(false)
  const [pasted, setPasted] = React.useState("")
  const command = `pnpm dlx shadcn@latest add @govblock/${props.entity}-card --preset ${code}`
  const copy = (value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="dark top-24 right-12 isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <MainMenu mode={props.mode} setMode={props.setMode} onShuffle={props.onShuffle} onReset={props.onReset} onOpenPreset={() => setOpenPreset(true)} />
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto md:flex-col md:gap-3.25">
          {props.mode === "design" ? (
            <DesignFields design={props.design} set={props.setDesign} />
          ) : (
            <LegislativeFields filters={props.filters} set={props.setFilters} states={props.states} chambers={props.chambers} committees={props.committees} members={props.members} statuses={props.statuses} />
          )}
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex min-w-0 gap-2 md:flex-col md:rounded-b-none md:**:[button,a]:w-full">
        <Button variant="outline" className="min-w-0 flex-1 font-mono md:flex-none" onClick={() => copy(`--preset ${code}`)}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          --preset {code}
        </Button>
        <Button variant="outline" className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none" onClick={() => setOpenPreset(true)}>
          Open Preset
        </Button>
        <Button variant="outline" className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none" onClick={props.onShuffle}>
          Shuffle
        </Button>
      </CardFooter>
      <CardFooter className="-mt-3 hidden min-w-0 gap-2 md:flex md:flex-col md:**:[button,a]:w-full">
        <Button onClick={() => setGetCode(true)}>Get Code</Button>
      </CardFooter>

      <Dialog open={openPreset} onOpenChange={setOpenPreset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Preset</DialogTitle>
            <DialogDescription>Paste a preset code or a create URL.</DialogDescription>
          </DialogHeader>
          <Input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="b4hsHFyoS" autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenPreset(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpenPreset(false)}>Open</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={getCode} onOpenChange={setGetCode}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Get Code</DialogTitle>
            <DialogDescription>Add this card to your project from the govblock registry, with your preset.</DialogDescription>
          </DialogHeader>
          <div className="relative rounded-lg bg-muted p-3 pr-12 font-mono text-xs break-all">
            {command}
            <Button variant="ghost" size="icon-sm" className="absolute top-1.5 right-1.5" aria-label="Copy" onClick={() => copy(command)}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
