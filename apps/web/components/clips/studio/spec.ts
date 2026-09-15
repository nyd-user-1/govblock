import type { BillHistoryProps } from "../templates/bill-history"
import type { RollCallTallyProps } from "../templates/roll-call-tally"
import { DEFAULT_LOOK, PACES, type Look } from "./palette"

// A template built in Studio (Brendan, 2026-09-14: "a UI that surfaces the
// programming levers and knobs so that a user can construct their own
// programmatic video template"). Plain data, shared by the Studio page, the
// player that draws it, and the routes that save and post it.
//
// A template is a shape, a look (the customizer's base colour, theme, chart
// colour, faces, radius, motion and pace) and a list of scenes. A scene's
// words can hold {field} slots, filled from the data a pasted link reads; a
// timeline or bar scene reads one of the data's lists. The two first
// templates, the roll call tally and the bill history, are scenes of their own.

export type Aspect = "9:16" | "1:1" | "16:9"
export type Transition = "look" | "fade" | "slide" | "zoom" | "none"
export type Align = "left" | "center"

export type SceneBase = { id: string; seconds: number; transition: Transition }

export type Scene =
  | (SceneBase & { kind: "title"; eyebrow: string; headline: string; subhead: string; align: Align })
  | (SceneBase & { kind: "portrait"; image: string; name: string; detail: string })
  | (SceneBase & { kind: "number"; value: string; label: string; color: "yes" | "no" | "accent" | "ink" })
  | (SceneBase & { kind: "stats"; items: { value: string; label: string }[] })
  | (SceneBase & { kind: "tally"; yes: string; no: string; other: string; stamp: string; grid: boolean })
  | (SceneBase & { kind: "timeline"; max: number; dates: boolean })
  | (SceneBase & { kind: "bars"; title: string })
  | (SceneBase & { kind: "text"; body: string; size: number; align: Align })
  | (SceneBase & { kind: "end"; tagline: string })
  | (SceneBase & { kind: "roll-call-tally" })
  | (SceneBase & { kind: "bill-history" })

export type SceneKind = Scene["kind"]

export type StudioSpec = { version: 2; name: string; aspect: Aspect; fps: 30; look: Look; scenes: Scene[] }

export type DataKind = "bill" | "roll-call" | "member" | "committee" | "party" | "chamber" | "state"

/** What a pasted link reads: named values for {field} slots, the lists a timeline or bar scene reads, and the whole props of the two first templates. */
export type StudioData = {
  kind: DataKind
  link: string
  label: string
  fields: Record<string, string>
  lists: { timeline?: { date: string; chamber: string | null; action: string }[]; bars?: { label: string; yes: number; no?: number }[] }
  raw?: { tally?: RollCallTallyProps; history?: BillHistoryProps }
}

export const SIZES: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
}

export const SCENE_LABELS: Record<SceneKind, string> = {
  title: "Title card",
  portrait: "Portrait",
  number: "Big number",
  stats: "Three numbers",
  tally: "Tally",
  timeline: "Timeline",
  bars: "Bars",
  text: "Text",
  end: "End card",
  "roll-call-tally": "Roll call tally",
  "bill-history": "Bill history",
}

/** The two first templates run on their own clocks; pace does not stretch them. */
export const FIXED_SECONDS: Partial<Record<SceneKind, number>> = { "roll-call-tally": 15, "bill-history": 20 }

const uid = () => Math.random().toString(36).slice(2, 10)

export function newScene(kind: SceneKind): Scene {
  const base = { id: uid(), seconds: 4, transition: "look" as Transition }
  switch (kind) {
    case "title":
      return { ...base, kind, eyebrow: "", headline: "{citation}", subhead: "{title}", align: "left" }
    case "portrait":
      return { ...base, kind, image: "{photo}", name: "{name}", detail: "{party} · {district}" }
    case "number":
      return { ...base, kind, value: "{yea}", label: "voted yes", color: "yes" }
    case "stats":
      return { ...base, kind, items: [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }] }
    case "tally":
      return { ...base, kind, seconds: 6, yes: "{yea}", no: "{nay}", other: "{notVoting}", stamp: "{result}", grid: true }
    case "timeline":
      return { ...base, kind, seconds: 8, max: 6, dates: true }
    case "bars":
      return { ...base, kind, seconds: 5, title: "" }
    case "text":
      return { ...base, kind, body: "", size: 56, align: "left" }
    case "end":
      return { ...base, kind, seconds: 3, tagline: "" }
    case "roll-call-tally":
      return { ...base, kind, seconds: 15, transition: "none" }
    case "bill-history":
      return { ...base, kind, seconds: 20, transition: "none" }
  }
}

/** Every {field} filled from the data; a slot with no value is left empty. */
export const fill = (text: string, data: StudioData | null) => text.replace(/\{(\w+)\}/g, (_, key: string) => data?.fields[key] ?? "")

export const sceneFrames = (scene: Scene, spec: StudioSpec) => {
  const fixed = FIXED_SECONDS[scene.kind]
  const factor = fixed ? 1 : (PACES[spec.look.pace] ?? PACES.default).factor
  return Math.round(Math.max(0.5, fixed ?? scene.seconds) * factor * spec.fps)
}

export const durationInFrames = (spec: StudioSpec) => Math.max(30, spec.scenes.reduce((sum, s) => sum + sceneFrames(s, spec), 0))

/** A saved spec, checked: anything that is not one comes back null. */
export function parseSpec(value: unknown): StudioSpec | null {
  const v = value as StudioSpec | null
  if (!v || v.version !== 2 || !Array.isArray(v.scenes) || !SIZES[v.aspect] || !v.look) return null
  if (v.scenes.length > 40 || JSON.stringify(v).length > 100_000) return null
  return { ...v, look: { ...DEFAULT_LOOK, ...v.look } }
}

export type LinkTarget =
  | { kind: "roll-call"; chamber: "house" | "senate"; congress: number; session: number; roll: number }
  | { kind: "chamber"; chamber: "house" | "senate"; congress: number; session: number }
  | { kind: "bill"; billId: number }
  | { kind: "member"; peopleId: number }
  | { kind: "committee"; code: string }
  | { kind: "state"; state: string }
  | { kind: "party"; party: "R" | "D"; chamber: "house" | "senate" }

/** A page's link, or its short form, as what it points at: a roll call, a session's roll calls, a bill, a member, a committee, a state, or a party. */
export function resolveLink(text: string): LinkTarget | null {
  const t = text.trim()
  const roll = /(house|senate)-(\d+)-(\d+)\/(\d+)/i.exec(t)
  if (roll) return { kind: "roll-call", chamber: roll[1].toLowerCase() as "house" | "senate", congress: Number(roll[2]), session: Number(roll[3]), roll: Number(roll[4]) }
  const session = /(house|senate)-(\d+)-(\d+)(?:\/?$|\?)/i.exec(t)
  if (session) return { kind: "chamber", chamber: session[1].toLowerCase() as "house" | "senate", congress: Number(session[2]), session: Number(session[3]) }
  const member = /\/members\/(\d+)/.exec(t)
  if (member) return { kind: "member", peopleId: Number(member[1]) }
  const committee = /\/committees\/([a-z]{4}\d{2})/i.exec(t)
  if (committee) return { kind: "committee", code: committee[1].toLowerCase() }
  const state = /\/state\/([a-z]{2})(?:\/|$|\?)/i.exec(t)
  if (state) return { kind: "state", state: state[1].toUpperCase() }
  const party = /(?:^|\/party\/)(republicans?|democrats?|r|d)(?:[-/ ](house|senate))?$/i.exec(t)
  if (party) return { kind: "party", party: party[1][0].toUpperCase() as "R" | "D", chamber: (party[2]?.toLowerCase() as "house" | "senate") ?? "house" }
  const bill = /\/bills?\/(\d+)/.exec(t) ?? /^(\d{4,})$/.exec(t)
  if (bill) return { kind: "bill", billId: Number(bill[1]) }
  return null
}
