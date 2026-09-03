"use client"

import * as React from "react"
import { MenuIcon } from "lucide-react"

import { CREATE_SLOTS } from "@/lib/blocks-tabs"
import { decodePreset, DEFAULT_DESIGN, DESIGN_KEYS, DESIGN_OPTIONS, presetToParams, readDesign, type Design, type Preset } from "@/lib/create/preset"
import { SCOPE_KEYS, useScope, type ScopeKey } from "@/lib/policy/scope"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { useLocal } from "@/lib/policy/use-local"
import { cn } from "@govblock/ui/lib/utils"
import { Customizer } from "@/components/create/customizer"
import { DrillView } from "@/components/create/drill"
import type { Drill } from "@/components/create/entity-card"
import { Fab, FabButton } from "@/components/create/fab"
import { LocksProvider, useLocks } from "@/components/create/locks"
import { type Mode } from "@/components/create/main-menu"
import { RevealFx } from "@/components/create/reveal-fx"
import { CardsStage, type Entity } from "@/components/create/stage"
import { blockComponents } from "@/registry/blocks"

// /create — livingston-v3's designer, with the whole site on its stage.
//
// Everything the reader can set is in the URL: the rail's filters (the keys
// every legislative surface speaks, so the header's switcher and the blocks
// follow), the design (the keys /typeset's preview reads), the block on the
// stage (`block=`), and the thing opened in place (`open=bill:123`,
// `view=typeset`). Refresh keeps the view; the browser's back button is Undo;
// a link is a preset; `?preset=<code>` unpacks into all of it.
//
// The stage is one of seven. 01 is the cards; 02 to 07 are the blocks, each
// in the dashboard's shell, each reading the rail's scope. A card's button
// opens its record in place, with a back arrow.

const URL_KEYS = [...SCOPE_KEYS, ...DESIGN_KEYS, "block", "open", "view", "preset", "mode"] as const

function parseDrill(open: string, view: string): Drill | null {
  const [kind, ...rest] = open.split(":")
  const id = rest.join(":")
  if (!id || (kind !== "bill" && kind !== "member" && kind !== "committee")) return null
  // Reloaded from the URL, the card's own label is gone; the kind and the id name it.
  return { kind, id, view: view || "record", label: kind === "committee" ? id : `${kind === "bill" ? "Bill" : "Member"} ${id}` }
}

function DesignerInner() {
  const params = useUrlParams(URL_KEYS)
  const scope = useScope()
  const { locks } = useLocks()
  // Which variant the panel opens on. A link can say (`?mode=design`); once
  // the reader picks, the pick wins and the URL is not rewritten for it. Read
  // on every render rather than once: the first client render still carries
  // the server's empty URL, and the real one arrives a render later.
  const [picked, setMode] = React.useState<Mode | null>(null)
  const mode: Mode = picked ?? (params.mode === "design" ? "design" : "state")
  // The customizer pushes on and off the stage the way the sidebar does in
  // every one of Brendan's projects: its column animates to nothing and the
  // stage widens into the room. Open by default; the choice is remembered.
  const [panelOpen, setPanelOpen] = useLocal("govblock:create:customizer", true)
  // Which card the stage shows, from the rail's Cards picker.
  const entity: Entity = scope.filters.kind === "member" || scope.filters.kind === "committee" ? scope.filters.kind : "bill"
  const [label, setLabel] = React.useState<string | null>(null)

  const design = React.useMemo(() => readDesign(params), [params])
  const slot = CREATE_SLOTS.find((s) => s.value === params.block) ?? CREATE_SLOTS[0]
  const drill = React.useMemo(() => {
    const parsed = parseDrill(params.open, params.view)
    return parsed && label ? { ...parsed, label } : parsed
  }, [params.open, params.view, label])

  // `?preset=` unpacks once, into the keys it stands for, and leaves.
  React.useEffect(() => {
    if (!params.preset) return
    const preset = decodePreset(params.preset)
    writeUrlParams({ ...(preset ? presetToParams(preset) : {}), preset: null })
  }, [params.preset])

  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
  const setDesign = React.useCallback((patch: Partial<Design>) => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(patch)) out[key] = value === DEFAULT_DESIGN[key as keyof Design] ? "" : (value ?? "")
    writeUrlParams(out, { history: "push" })
  }, [])
  const setBlock = React.useCallback((value: string) => writeUrlParams({ block: value === "cards" ? null : value, open: null, view: null }, { history: "push" }), [])
  const openDrill = React.useCallback((next: Drill) => {
    setLabel(next.label)
    writeUrlParams({ open: `${next.kind}:${next.id}`, view: next.view }, { history: "push" })
  }, [])
  const closeDrill = React.useCallback(() => writeUrlParams({ open: null, view: null }, { history: "push" }), [])

  const shuffle = React.useCallback(() => {
    const next: Partial<Design> = {}
    for (const key of DESIGN_KEYS) {
      if (locks.has(key)) continue
      const options = DESIGN_OPTIONS[key]
      next[key] = options[Math.floor(Math.random() * options.length)].value
    }
    setDesign(next)
  }, [locks, setDesign])

  // Reset clears what is not locked: the design back to its defaults, the rail
  // back to the jurisdiction alone.
  const reset = React.useCallback(() => {
    const out: Record<string, string | null> = {}
    for (const key of [...DESIGN_KEYS, ...SCOPE_KEYS]) if (!locks.has(key)) out[key] = null
    out.open = null
    out.view = null
    writeUrlParams(out, { history: "push" })
  }, [locks])

  const openPreset = React.useCallback((preset: Preset) => {
    const out = presetToParams(preset)
    for (const key of locks) delete out[key]
    writeUrlParams({ ...out, open: null, view: null }, { history: "push" })
  }, [locks])

  const Block = slot.block ? blockComponents[slot.block] : null
  // What is on the stage, named, so the reveal replays when it changes: a new
  // block, a record opened, the way back to the cards.
  const stageKey = drill ? `${slot.value}:${drill.kind}:${drill.id}:${drill.view}` : slot.value

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col">
            <RevealFx key={stageKey} translateY={8} className="flex h-full min-h-0 flex-1 flex-col">
              {drill ? (
                <DrillView drill={drill} scope={scope} design={design} onBack={closeDrill} onSwitch={(view) => writeUrlParams({ view }, { history: "push" })} />
              ) : Block ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                  <Block />
                </div>
              ) : (
                <CardsStage scope={scope} entity={entity} onOpen={openDrill} />
              )}
            </RevealFx>
          </div>

          {/* Bottom left: the customizer's hamburger, then which card the
              stage shows. State and Design live in the customizer's own menu.
              Brendan, 2026-09-03. */}
          <Fab className="absolute bottom-3 left-3">
            <FabButton aria-label={panelOpen ? "Hide the customizer" : "Show the customizer"} aria-pressed={panelOpen} onClick={() => setPanelOpen((open) => !open)}>
              <MenuIcon className="size-4" />
            </FabButton>
            {(["bill", "member", "committee"] as Entity[]).map((kind) => (
              <FabButton key={kind} active={entity === kind && !drill && !Block} disabled={!!Block} onClick={() => writeUrlParams({ kind: kind === "bill" ? null : kind, open: null, view: null, block: null }, { history: "push" })}>
                {kind === "bill" ? "Bills" : kind === "member" ? "Members" : "Committees"}
              </FabButton>
            ))}
          </Fab>
          <Fab className="absolute right-3 bottom-3">
            {CREATE_SLOTS.map((s, index) => (
              <FabButton key={s.value} active={s.value === slot.value && !drill} tip={s.label} onClick={() => setBlock(s.value)}>
                {String(index + 1).padStart(2, "0")}
              </FabButton>
            ))}
          </Fab>
        </div>
        {/* The push: the column's width goes to nothing and the gap with it, over
            300ms, and the stage (flex-1) takes the room. The card inside keeps
            its own width so it is clipped, not squeezed, on the way out. */}
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen && "max-md:hidden md:pointer-events-none md:w-0! md:-mr-(--gap) md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <Customizer mode={mode} setMode={setMode} block={slot.value} filters={scope.filters} setFilters={setFilters} design={design} setDesign={setDesign} onShuffle={shuffle} onReset={reset} onOpenPreset={openPreset} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Designer() {
  return (
    <LocksProvider>
      <DesignerInner />
    </LocksProvider>
  )
}
