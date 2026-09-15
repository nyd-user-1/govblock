"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { Player } from "@remotion/player"
import { CheckIcon, LinkIcon, XIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"

import { BILL_HISTORY, BillHistory, type BillHistoryProps } from "./templates/bill-history"
import { ROLL_CALL_TALLY, RollCallTally, type RollCallTallyProps } from "./templates/roll-call-tally"
import { clipUrl } from "./menu"
import { postGenerated, type Clip } from "./store"

// Generate: a video made from data the site already has. Paste a link — a
// roll call's page or a bill's page — and the template that fits it is
// chosen and previewed in Remotion's <Player> as it will render. The select
// picks a template by hand and opens it on an example. Post keeps it in the
// feed as its template and data, with a link to share; nothing is rendered.

type Address = { template: "roll-call-tally"; chamber: "house" | "senate"; congress: number; session: number; roll: number } | { template: "bill-history"; billId: number }

const TEMPLATES = [
  { id: ROLL_CALL_TALLY.id, name: "Roll call tally", example: "house-119-2/295", hint: "Paste a roll call's link" },
  { id: BILL_HISTORY.id, name: "Bill history", example: "/bills/2058568", hint: "Paste a bill's link" },
] as const

/** A roll call's or a bill's link, or its short form, as the template and address it names. */
function resolve(text: string): Address | null {
  const t = text.trim()
  const roll = /(house|senate)-(\d+)-(\d+)\/(\d+)/i.exec(t)
  if (roll) return { template: "roll-call-tally", chamber: roll[1].toLowerCase() as "house" | "senate", congress: Number(roll[2]), session: Number(roll[3]), roll: Number(roll[4]) }
  const bill = /\/bills?\/(\d+)/.exec(t) ?? /^(\d{4,})$/.exec(t)
  if (bill) return { template: "bill-history", billId: Number(bill[1]) }
  return null
}

const spell = (a: Address) => (a.template === "roll-call-tally" ? `${a.chamber}-${a.congress}-${a.session}/${a.roll}` : `/bills/${a.billId}`)

type Loaded = ({ template: "roll-call-tally"; props: RollCallTallyProps } | { template: "bill-history"; props: BillHistoryProps }) & { n: number; address: Record<string, unknown> }

export function Generate({ onClose, onPosted, signedIn }: { onClose: () => void; onPosted: (clip: Clip) => void; signedIn: boolean }) {
  const [text, setText] = React.useState("")
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [template, setTemplate] = React.useState<string>(ROLL_CALL_TALLY.id)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [posting, setPosting] = React.useState(false)
  const [posted, setPosted] = React.useState<Clip | null>(null)
  const [copied, setCopied] = React.useState(false)

  const load = React.useCallback(async (a: Address | null, fallback: "roll-call-tally" | "bill-history" = "roll-call-tally") => {
    setLoading(true)
    setError(null)
    setPosted(null)
    const kind = a?.template ?? fallback
    setTemplate(kind)
    const url =
      kind === "bill-history"
        ? `/api/clips/templates/bill?id=${a && a.template === "bill-history" ? a.billId : 2058568}`
        : `/api/clips/templates/roll-call${a && a.template === "roll-call-tally" ? `?chamber=${a.chamber}&congress=${a.congress}&session=${a.session}&roll=${a.roll}` : ""}`
    try {
      const res = await fetch(url)
      const body = (await res.json()) as { address?: Record<string, unknown>; props?: unknown; error?: string }
      if (!res.ok || !body.props || !body.address) throw new Error(body.error ?? "That link did not load.")
      if (kind === "bill-history") {
        setLoaded({ template: kind, props: body.props as BillHistoryProps, n: Date.now(), address: body.address })
        setText(spell({ template: kind, billId: Number(body.address.billId) }))
      } else {
        const r = body.address as { chamber: "house" | "senate"; congress: number; session: number; roll: number }
        setLoaded({ template: kind, props: body.props as RollCallTallyProps, n: Date.now(), address: body.address })
        setText(spell({ template: kind, ...r }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That link did not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load(null)
  }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const a = resolve(text)
    if (!a) return setError("Paste a roll call's link or a bill's link.")
    void load(a)
  }

  const post = async () => {
    if (!loaded || posting) return
    setPosting(true)
    setError(null)
    try {
      const clip = await postGenerated({ template: loaded.template, address: loaded.address })
      setPosted(clip)
      onPosted(clip)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The clip was not posted.")
    } finally {
      setPosting(false)
    }
  }

  const spec = loaded?.template === "bill-history" ? BILL_HISTORY : ROLL_CALL_TALLY
  const hint = TEMPLATES.find((t) => t.id === template)?.hint ?? "Paste a link"

  return (
    <div className="absolute inset-0 flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 p-3">
        <Select value={template} onValueChange={(v) => v && void load(null, String(v) as "roll-call-tally" | "bill-history")}>
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
        <Link href="/clips/studio" className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-white/20">
          Build your own
        </Link>
        <Button variant="ghost" size="icon-sm" className="rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {loaded ? (
          <Player
            key={loaded.n}
            component={(loaded.template === "bill-history" ? BillHistory : RollCallTally) as React.ComponentType<Record<string, unknown>>}
            inputProps={loaded.props as unknown as Record<string, unknown>}
            durationInFrames={spec.durationInFrames}
            fps={spec.fps}
            compositionWidth={spec.width}
            compositionHeight={spec.height}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
            autoPlay
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">{loading ? <LoadingFlag /> : error}</div>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 bg-background p-4 text-foreground">
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={hint} aria-label="Link" className="font-mono" />
          <Button type="submit" variant="outline" disabled={loading}>
            {loading ? "Loading…" : "Preview"}
          </Button>
          {signedIn && (
            <Button type="button" disabled={!loaded || loading || posting || !!posted} onClick={() => void post()}>
              {posted ? "Posted" : posting ? "Posting…" : "Post"}
            </Button>
          )}
        </div>
        {posted && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(clipUrl(posted))
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <CheckIcon /> : <LinkIcon />} {copied ? "Link copied" : "Copy the link"}
          </Button>
        )}
        {error && loaded && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  )
}
