"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, Trash2Icon } from "lucide-react"

import { decodePreset, describePreset, encodePreset, presetName, PRESETS_KEY, type Design, type Preset, type SavedPreset } from "@/lib/create/preset"
import { stateName } from "@/lib/filters"
import type { ScopeFilters, ScopeKey } from "@/lib/policy/scope"
import { useLocal } from "@/lib/policy/use-local"
import { DesignFields, LegislativeFields } from "@/components/create/fields"
import { MainMenu, type Mode } from "@/components/create/main-menu"
import type { Stage } from "@/components/create/stage-switcher"
import { useIsMobile } from "@govblock/ui/hooks/use-mobile"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"

// The panel. Ported from livingston-v3's Customizer: a dark card, the header
// menu, the field set for the variant you are in, then preset · Open Preset ·
// Shuffle, Save and Get Code.
//
// One customizer, two variants. Brendan, 2026-09-03. State is the rail —
// jurisdiction, session, chamber, committee, member, party, status, topics,
// votes, department, FEC cycle, forms, bill. Design is the shadcn set and the
// typeset set together. Every field has a lock; every field writes the URL; the
// preset code is the URL's contents, encoded, so it can be saved here and
// opened anywhere.

export function Customizer({
  mode,
  at,
  filters,
  setFilters,
  design,
  setDesign,
  onShuffle,
  onReset,
  onOpenPreset,
  stage,
  onStage,
}: {
  mode: Mode
  setMode: (mode: Mode) => void
  /** The path in the jurisdiction tree; it rides the preset. */
  at: string
  filters: ScopeFilters
  setFilters: (patch: Partial<Record<ScopeKey, string>>) => void
  design: Design
  setDesign: (patch: Partial<Design>) => void
  onShuffle: () => void
  onReset: () => void
  onOpenPreset: (preset: Preset) => void
  /** What the stage shows, and the switch — shared with the FAB. */
  stage: Stage
  onStage: (stage: Stage) => void
}) {
  const isMobile = useIsMobile() ?? false
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const code = React.useMemo(() => encodePreset({ at, filters, design }), [at, filters, design])
  const name = presetName(code)
  const [saved, setSaved] = useLocal<Record<string, SavedPreset>>(PRESETS_KEY, {})
  const [copied, setCopied] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<null | "open" | "save" | "code">(null)
  const [pasted, setPasted] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const command = `pnpm dlx shadcn@latest add @govblock/${at.split("/")[0] || "tree"} --preset ${code}`

  const copy = (what: string, value: string) => {
    void navigator.clipboard?.writeText(value)
    setCopied(what)
    window.setTimeout(() => setCopied(null), 1500)
  }
  const openPreset = React.useCallback(
    (input: string) => {
      const preset = decodePreset(input, saved)
      if (!preset) {
        setError("That is not a preset code, a saved preset, or a create URL.")
        return
      }
      onOpenPreset(preset)
      setOpen(null)
      setPasted("")
      setError(null)
    },
    [saved, onOpenPreset]
  )
  const savePreset = () => {
    setSaved((all) => ({ ...all, [name]: { code, label: label.trim() || name, at: Date.now() } }))
    setOpen(null)
    setLabel("")
  }
  const showOpen = React.useCallback(() => setOpen("open"), [])
  const showSave = React.useCallback(() => setOpen("save"), [])
  const savedList = React.useMemo(() => Object.entries(saved).sort((a, b) => b[1].at - a[1].at), [saved])
  const isSaved = name in saved

  return (
    <Card ref={anchorRef} className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <MainMenu stage={stage} onStage={onStage} onShuffle={onShuffle} onReset={onReset} onOpenPreset={showOpen} onSavePreset={showSave} />
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto max-md:px-3 md:flex-col md:gap-3.25">
          {mode === "design" ? <DesignFields design={design} set={setDesign} isMobile={isMobile} anchorRef={anchorRef} /> : <LegislativeFields filters={filters} setFilters={setFilters} isMobile={isMobile} anchorRef={anchorRef} />}
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex min-w-0 gap-2 md:flex-col md:rounded-b-none md:**:[button,a]:w-full">
        <Button variant="outline" className="min-w-0 flex-1 font-mono md:flex-none" title="Copy the preset code" onClick={() => copy("preset", `--preset ${code}`)}>
          {copied === "preset" ? <CheckIcon /> : <CopyIcon />}
          --preset {name}
        </Button>
        <Button variant="outline" className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none" onClick={showOpen}>
          Open Preset
        </Button>
        <Button variant="outline" className="max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none" onClick={onShuffle}>
          Shuffle
        </Button>
      </CardFooter>
      <CardFooter className="-mt-3 hidden min-w-0 gap-2 md:flex md:flex-col md:**:[button,a]:w-full">
        <Button variant="outline" onClick={showSave}>
          {isSaved ? "Saved" : "Save"}
        </Button>
        <Button onClick={() => setOpen("code")}>Get Code</Button>
      </CardFooter>

      <Dialog open={open === "open"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Preset</DialogTitle>
            <DialogDescription>Paste a preset code or a create URL, or pick one you saved.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              openPreset(pasted)
            }}
          >
            <Input
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value)
                setError(null)
              }}
              placeholder={name}
              autoFocus
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {savedList.length > 0 && (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {savedList.map(([key, entry]) => {
                  const preset = decodePreset(entry.code)
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <button type="button" className="flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => openPreset(entry.code)}>
                        <span className="truncate text-sm font-medium">
                          {entry.label} <span className="font-mono text-xs text-muted-foreground">{key}</span>
                        </span>
                        {preset && <span className="truncate text-xs text-muted-foreground">{describePreset(preset, stateName)}</span>}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Forget ${entry.label}`}
                        onClick={() =>
                          setSaved((all) => {
                            const next = { ...all }
                            delete next[key]
                            return next
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button type="submit">Open</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "save"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription>This view — its scope, its design and its block — kept in this browser as {name}.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              savePreset()
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A name for it" autoFocus />
            <p className="text-xs text-muted-foreground">{describePreset({ v: 1, at, filters, design }, stateName)}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "code"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Get Code</DialogTitle>
            <DialogDescription>Add this block to your project from the govblock registry, with your preset.</DialogDescription>
          </DialogHeader>
          <div className="relative rounded-lg bg-muted p-3 pr-12 font-mono text-xs break-all">
            {command}
            <Button variant="ghost" size="icon-sm" className="absolute top-1.5 right-1.5" aria-label="Copy" onClick={() => copy("command", command)}>
              {copied === "command" ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <div className="relative rounded-lg bg-muted p-3 pr-12 font-mono text-xs break-all">
            {typeof window === "undefined" ? "" : `${window.location.origin}/create?preset=${code}`}
            <Button variant="ghost" size="icon-sm" className="absolute top-1.5 right-1.5" aria-label="Copy the link" onClick={() => copy("link", `${window.location.origin}/create?preset=${code}`)}>
              {copied === "link" ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
