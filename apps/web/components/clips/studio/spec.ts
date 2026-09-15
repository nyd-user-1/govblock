// A template built in Studio (Brendan, 2026-09-14: "a UI that surfaces the
// programming levers and knobs so that a user can construct their own
// programmatic video template"). Plain data, shared by the Studio page, the
// player that draws it, and the routes that save and post it.
//
// A template is a format, a theme and a list of scenes. A scene's words can
// hold {field} slots, filled from the data a pasted link reads (a bill's
// citation, a roll call's yea count); a timeline or a bar scene reads one of
// the data's lists.

export type Aspect = "9:16" | "1:1" | "16:9"
export type Transition = "fade" | "slide" | "zoom" | "none"
export type Align = "left" | "center"

export type SceneBase = { id: string; seconds: number; transition: Transition }

export type Scene =
  | (SceneBase & { kind: "title"; eyebrow: string; headline: string; subhead: string; align: Align })
  | (SceneBase & { kind: "number"; value: string; label: string; color: string })
  | (SceneBase & { kind: "tally"; yes: string; no: string; other: string; stamp: string; grid: boolean })
  | (SceneBase & { kind: "timeline"; list: "milestones"; max: number; dates: boolean })
  | (SceneBase & { kind: "bars"; list: "parties"; title: string })
  | (SceneBase & { kind: "text"; body: string; size: number; align: Align })
  | (SceneBase & { kind: "end"; brand: string; source: string })

export type SceneKind = Scene["kind"]

export type Theme = { background: string; ink: string; accent: string; yes: string; no: string; font: "sans" | "serif" | "mono" }

export type StudioSpec = { version: 1; name: string; aspect: Aspect; fps: 30; theme: Theme; scenes: Scene[] }

/** What a pasted link reads: named values for {field} slots, and lists for the timeline and bar scenes. */
export type StudioData = {
  kind: "bill" | "roll-call"
  link: string
  fields: Record<string, string>
  lists: { milestones?: { date: string; chamber: string | null; action: string }[]; parties?: { label: string; yes: number; no: number }[] }
}

export const SIZES: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
}

export const SCENE_LABELS: Record<SceneKind, string> = {
  title: "Title card",
  number: "Big number",
  tally: "Tally",
  timeline: "Timeline",
  bars: "Bars",
  text: "Text",
  end: "End card",
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function newScene(kind: SceneKind): Scene {
  const base = { id: uid(), seconds: 4, transition: "fade" as Transition }
  switch (kind) {
    case "title":
      return { ...base, kind, eyebrow: "{chamber}", headline: "{citation}", subhead: "{title}", align: "left" }
    case "number":
      return { ...base, kind, value: "{yea}", label: "voted yes", color: "yes" }
    case "tally":
      return { ...base, kind, seconds: 6, yes: "{yea}", no: "{nay}", other: "{notVoting}", stamp: "{result}", grid: true }
    case "timeline":
      return { ...base, kind, seconds: 10, list: "milestones", max: 8, dates: true }
    case "bars":
      return { ...base, kind, seconds: 5, list: "parties", title: "By party" }
    case "text":
      return { ...base, kind, body: "{latestAction}", size: 56, align: "left" }
    case "end":
      return { ...base, kind, seconds: 3, brand: "GovBlock", source: "Source: {source}" }
  }
}

export function starterSpec(kind: StudioData["kind"] = "roll-call"): StudioSpec {
  const theme: Theme = { background: "#0b0b0c", ink: "#fafafa", accent: "#60a5fa", yes: "#22c55e", no: "#ef4444", font: "sans" }
  const scenes: Scene[] =
    kind === "bill"
      ? [newScene("title"), { ...newScene("timeline") }, { ...newScene("text"), body: "{latestAction}" } as Scene, newScene("end")]
      : [{ ...newScene("title"), eyebrow: "{chamber} roll call {roll} · {date}", subhead: "{question}" } as Scene, newScene("tally"), newScene("bars"), newScene("end")]
  return { version: 1, name: kind === "bill" ? "Bill story" : "Vote story", aspect: "9:16", fps: 30, theme, scenes }
}

/** Every {field} filled from the data; a slot with no value is left empty. */
export const fill = (text: string, data: StudioData | null) => text.replace(/\{(\w+)\}/g, (_, key: string) => data?.fields[key] ?? "")

export const durationInFrames = (spec: StudioSpec) => Math.max(30, spec.scenes.reduce((sum, s) => sum + Math.round(Math.max(0.5, s.seconds) * spec.fps), 0))

/** A saved spec, checked: anything that is not one comes back null. */
export function parseSpec(value: unknown): StudioSpec | null {
  const v = value as StudioSpec | null
  if (!v || v.version !== 1 || !Array.isArray(v.scenes) || !SIZES[v.aspect] || !v.theme) return null
  if (v.scenes.length > 40 || JSON.stringify(v).length > 100_000) return null
  return v
}

/** A roll call's or a bill's link, or its short form, as what it points at. */
export function resolveLink(text: string): { kind: "roll-call"; chamber: "house" | "senate"; congress: number; session: number; roll: number } | { kind: "bill"; billId: number } | null {
  const t = text.trim()
  const roll = /(house|senate)-(\d+)-(\d+)\/(\d+)/i.exec(t)
  if (roll) return { kind: "roll-call", chamber: roll[1].toLowerCase() as "house" | "senate", congress: Number(roll[2]), session: Number(roll[3]), roll: Number(roll[4]) }
  const bill = /\/bills?\/(\d+)/.exec(t) ?? /^(\d{4,})$/.exec(t)
  if (bill) return { kind: "bill", billId: Number(bill[1]) }
  return null
}
