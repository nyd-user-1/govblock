"use client"

import * as React from "react"
import { Player } from "@remotion/player"
import { XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"

import { ROLL_CALL_TALLY, RollCallTally, type RollCallTallyProps } from "./templates/roll-call-tally"

// Generate: a clip made from rows the site already serves. A template is
// picked, fed an id the way a block is, and previewed in Remotion's <Player>
// as it will render. One template so far, the roll call as a tally, fed by
// the roll call's address as its page spells it (house-119-2/295); with
// nothing named it opens on the newest House roll call.

const TEMPLATES = [{ id: ROLL_CALL_TALLY.id, name: "Roll call tally" }] as const

type Address = { chamber: "house" | "senate"; congress: number; session: number; roll: number }

const spell = (a: Address) => `${a.chamber}-${a.congress}-${a.session}/${a.roll}`

/** "house-119-2/295", or a roll call page's whole address. */
function parse(text: string): Address | null {
  const m = /(house|senate)-(\d+)-(\d+)\/(\d+)/i.exec(text.trim())
  return m ? { chamber: m[1].toLowerCase() as Address["chamber"], congress: Number(m[2]), session: Number(m[3]), roll: Number(m[4]) } : null
}

export function Generate({ onClose }: { onClose: () => void }) {
  const [template, setTemplate] = React.useState<string>(ROLL_CALL_TALLY.id)
  const [text, setText] = React.useState("")
  const [props, setProps] = React.useState<RollCallTallyProps | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async (a: Address | null) => {
    setLoading(true)
    setError(null)
    const query = a ? `?chamber=${a.chamber}&congress=${a.congress}&session=${a.session}&roll=${a.roll}` : ""
    try {
      const res = await fetch(`/api/clips/templates/roll-call${query}`)
      const body = (await res.json()) as { address?: Address; props?: RollCallTallyProps; error?: string }
      if (!res.ok || !body.props || !body.address) throw new Error(body.error ?? "That roll call did not load.")
      setProps(body.props)
      setText(spell(body.address))
    } catch (e) {
      setError(e instanceof Error ? e.message : "That roll call did not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load(null)
  }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const a = parse(text)
    if (!a) return setError("Write the roll call as its page does: house-119-2/295.")
    void load(a)
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 p-3">
        <Select value={template} onValueChange={(v) => v && setTemplate(String(v))}>
          <SelectTrigger size="sm" className="h-8 w-max min-w-44 border-white/20 bg-black/40 text-white" aria-label="Template">
            <SelectValue>{() => TEMPLATES.find((t) => t.id === template)?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            {TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id} className="whitespace-nowrap">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon-sm" className="ml-auto rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {props ? (
          <Player
            component={RollCallTally}
            inputProps={props}
            durationInFrames={ROLL_CALL_TALLY.durationInFrames}
            fps={ROLL_CALL_TALLY.fps}
            compositionWidth={ROLL_CALL_TALLY.width}
            compositionHeight={ROLL_CALL_TALLY.height}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
            autoPlay
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">{loading ? "Loading the roll call…" : error}</div>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 bg-background p-4 text-foreground">
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="house-119-2/295" aria-label="Roll call" className="font-mono" />
          <Button type="submit" variant="outline" disabled={loading}>
            {loading ? "Loading…" : "Preview"}
          </Button>
        </div>
        {error && props && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  )
}
