"use client"

import * as React from "react"
import Link from "next/link"
import { Player, Thumbnail } from "@remotion/player"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, LayoutGridIcon, MenuIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { useAccount } from "@/lib/auth/use-account"
import { Picker, PickerContent, PickerGroup, PickerItem, PickerLabel, PickerRadioGroup, PickerRadioItem, PickerSeparator, PickerShortcut, PickerTrigger } from "@/components/create/picker"
import { useIsMobile } from "@govblock/ui/hooks/use-mobile"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { FieldGroup, FieldSeparator } from "@govblock/ui/components/nova/field"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

import { clipUrl } from "../menu"
import { postGenerated, type Clip } from "../store"
import { GALLERY, type Prepared } from "./gallery"
import SNAPSHOT from "./gallery-data.json"
import { BASES, CHARTS, DEFAULT_LOOK, FACES, MOTIONS, PACES, RADII, THEMES, type Look } from "./palette"
import { durationInFrames, FIXED_SECONDS, newScene, resolveLink, SCENE_LABELS, sceneFrames, SIZES, type Aspect, type Scene, type SceneKind, type StudioData, type StudioSpec, type Transition } from "./spec"
import { StudioVideo } from "./studio-video"

// Studio (Brendan, 2026-09-14): the create customizer, turned to video. The
// dark card is the look — the template, the link that feeds it, the shape,
// light or dark, base colour, theme, chart colour, faces, motion, pace and
// corners — with Save, Post and New where preset, Open Preset and Shuffle
// were, and Get Code giving the share link, the embed and the link to open
// the template in Studio. The stage opens on the gallery; a template opens
// into its preview, its scenes along the foot and the chosen scene's knobs.
//
// Nothing reads the database when the page opens (Brendan, 2026-09-14): the
// gallery plays on a snapshot of its seven links (gallery-data.json, read
// from /api/clips/studio/data on 2026-09-14), a reader's saved templates load
// when the Template menu opens, a shared template when its button is pressed,
// and a new link when it is entered.

type Saved = { id: string; name: string; updatedAt: string; spec: StudioSpec }
type Option = { value: string; label: string; swatch?: React.ReactNode }

const VideoComponent = StudioVideo as unknown as React.ComponentType<Record<string, unknown>>
const KINDS = Object.keys(SCENE_LABELS) as SceneKind[]
const uid = () => Math.random().toString(36).slice(2, 10)
const withIds = (spec: StudioSpec): StudioSpec => ({ ...spec, scenes: spec.scenes.map((s) => ({ ...s, id: uid() })) })
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

// The customizer's own swatches for base colours (components/create/fields.tsx).
const BASE_SWATCH: Record<string, string> = { neutral: "bg-neutral-500", zinc: "bg-zinc-500", stone: "bg-stone-500", mauve: "bg-purple-300", olive: "bg-lime-700", mist: "bg-sky-300", taupe: "bg-stone-400" }
const Dot = ({ className, color }: { className?: string; color?: string }) => <span className={cn("inline-block size-3.5 shrink-0 rounded-full", className)} style={color ? { background: color } : undefined} />
const Pair = ({ yes, no }: { yes: string; no: string }) => <span className="inline-block size-3.5 shrink-0 rounded-full" style={{ background: `linear-gradient(90deg, ${yes} 50%, ${no} 50%)` }} />
const Aa = ({ face }: { face?: string }) => (
  <span className="text-xs font-medium text-foreground" style={face ? { fontFamily: FACES[face]?.css } : undefined}>
    Aa
  </span>
)

const ASPECTS: Option[] = [
  { value: "9:16", label: "Vertical · 9:16" },
  { value: "1:1", label: "Square · 1:1" },
  { value: "16:9", label: "Wide · 16:9" },
]
const MODES: Option[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
]
const TRANSITIONS: { value: Transition; label: string }[] = [
  { value: "look", label: "The look's motion" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide up" },
  { value: "zoom", label: "Zoom" },
  { value: "none", label: "Cut" },
]

/** One row of the card: the customizer's trigger, label over value, a glyph at the right; hovering an item previews it. */
function Row({ label, value, display, options, onChange, trailing, onPreview, isMobile, anchorRef }: { label: string; value: string; display?: string; options: Option[]; onChange: (value: string) => void; trailing?: React.ReactNode; onPreview?: (value: string | null) => void; isMobile: boolean; anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const current = options.find((o) => o.value === value)
  return (
    <div className="group/picker relative">
      <Picker onOpenChange={(open) => !open && onPreview?.(null)}>
        <PickerTrigger className="w-full">
          <div className={cn("flex min-w-0 flex-1 flex-col justify-start text-left", trailing && "pr-8")}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium text-foreground">{display ?? current?.label ?? value}</div>
          </div>
          {trailing && <span className="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground select-none md:right-2.5">{trailing}</span>}
        </PickerTrigger>
        <PickerContent anchor={isMobile ? anchorRef : undefined} side={isMobile ? "top" : "right"} align={isMobile ? "center" : "start"} onMouseLeave={() => onPreview?.(null)}>
          <PickerRadioGroup value={value} onValueChange={(next) => onChange(String(next))} onItemPreview={onPreview && !isMobile ? (next) => onPreview(next) : undefined}>
            <PickerGroup>
              <PickerLabel>{label}</PickerLabel>
              {options.map((o) => (
                <PickerRadioItem key={o.value} value={o.value} closeOnClick>
                  {o.swatch}
                  <span className="truncate">{o.label}</span>
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
    </div>
  )
}

/** The link row: the same box as a picker, typed into. */
function LinkRow({ value, onChange, onSubmit, loading, error }: { value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; error: string | null }) {
  return (
    <form
      className={cn("relative w-36 shrink-0 rounded-xl p-3 ring-1 ring-foreground/10 focus-within:ring-foreground/50 md:w-full md:rounded-lg md:px-2.5 md:py-2", error && "ring-destructive/60")}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <label className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{loading ? "Loading…" : error ? error : "Link"}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onSubmit} placeholder="Paste a GovBlock link" className="min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" aria-label="Link" spellCheck={false} />
      </label>
    </form>
  )
}

export function Studio() {
  const { signedIn } = useAccount()
  const isMobile = useIsMobile() ?? false
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<"gallery" | "edit">("gallery")
  const [spec, setSpec] = React.useState<StudioSpec>(() => withIds(GALLERY[0].spec))
  const [link, setLink] = React.useState(GALLERY[0].link)
  const [data, setData] = React.useState<StudioData | null>(null)
  const [cache, setCache] = React.useState<Record<string, StudioData | null>>(() => SNAPSHOT as unknown as Record<string, StudioData>)
  const [shared, setShared] = React.useState<{ id: string; link: string | null } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<number | null>(null)
  const [preview, setPreview] = React.useState<Partial<Look> | null>(null)
  const [saved, setSaved] = React.useState<Saved[]>([])
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [posted, setPosted] = React.useState<Clip | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [dialog, setDialog] = React.useState<null | "save" | "code">(null)
  const [name, setName] = React.useState("")
  const [copied, setCopied] = React.useState<string | null>(null)
  const loaded = React.useRef(link)

  const fetchData = React.useCallback(async (text: string) => {
    const res = await fetch(`/api/clips/studio/data?link=${encodeURIComponent(text)}`)
    const body = (await res.json().catch(() => ({}))) as { data?: StudioData; error?: string }
    if (!res.ok || !body.data) throw new Error(body.error ?? "That link did not load.")
    return body.data
  }, [])

  const load = React.useCallback(
    async (text: string) => {
      const t = text.trim()
      if (!t) return
      if (!resolveLink(t)) return setError("Not a link Studio reads")
      loaded.current = t
      if (cache[t]) {
        setData(cache[t])
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const next = await fetchData(t)
        setCache((c) => ({ ...c, [t]: next, [next.link]: next }))
        if (loaded.current === t) {
          setData(next)
          setLink(next.link)
          loaded.current = next.link
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "That link did not load.")
      } finally {
        setLoading(false)
      }
    },
    [cache, fetchData]
  )

  const loadSaved = React.useCallback(async () => {
    const res = await fetch("/api/clips/studio/templates", { cache: "no-store" }).catch(() => null)
    if (res?.ok) setSaved(((await res.json()) as { templates: Saved[] }).templates)
  }, [])
  // A collaborate link, /clips/studio?template=tpl_…&link=…, is noted when the page opens and read when its button is pressed.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get("template")
    const bare = params.get("link")
    if (id) setShared({ id, link: bare })
    // A link on its own, /clips/studio?link=…, is a page's Make Clip (2026-09-20): the gallery opens fed by that page.
    else if (bare) {
      setLink(bare)
      void load(bare)
    }
    // Read once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const openShared = async () => {
    if (!shared) return
    const res = await fetch(`/api/clips/studio/templates?id=${encodeURIComponent(shared.id)}`).catch(() => null)
    const body = res?.ok ? ((await res.json()) as { template?: Saved }) : null
    if (!body?.template) return setStatus("That shared template is gone.")
    setShared(null)
    setSpec(withIds(body.template.spec))
    setSavedId(null)
    setView("edit")
    if (shared.link) {
      setLink(shared.link)
      void load(shared.link)
    }
  }

  const change = (next: StudioSpec) => {
    setSpec(next)
    setPosted(null)
  }
  const setLook = (patch: Partial<Look>) => change({ ...spec, look: { ...spec.look, ...patch } })
  const scene = selected === null ? null : (spec.scenes[selected] ?? null)
  const setScene = (patch: Partial<Scene>) => change({ ...spec, scenes: spec.scenes.map((s, i) => (i === selected ? ({ ...s, ...patch } as Scene) : s)) })

  const open = (t: Prepared | Saved, withLink?: string) => {
    setSpec(withIds(t.spec))
    setSavedId("link" in t ? null : t.id)
    setPosted(null)
    setSelected(null)
    setView("edit")
    const l = withLink ?? ("link" in t ? t.link : link)
    setLink(l)
    if (cache[l]) {
      setData(cache[l])
      loaded.current = l
      setError(null)
    } else void load(l)
  }

  const shuffle = React.useCallback(() => {
    setSpec((s) => ({
      ...s,
      look: {
        ...s.look,
        mode: pick(["dark", "light"] as const),
        base: pick(Object.keys(BASES)),
        theme: pick(Object.keys(THEMES)),
        chart: pick(Object.keys(CHARTS)),
        heading: pick(Object.keys(FACES)),
        font: pick(Object.keys(FACES).filter((f) => !f.endsWith("mono"))),
        radius: pick(Object.keys(RADII)),
        motion: pick(Object.keys(MOTIONS)),
      },
    }))
    setPosted(null)
  }, [])

  const startNew = React.useCallback(() => {
    setView("gallery")
    setSavedId(null)
    setPosted(null)
    setSelected(null)
  }, [])

  const save = async () => {
    setStatus("Saving…")
    const res = await fetch("/api/clips/studio/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: savedId, spec: { ...spec, name: name.trim() || spec.name } }) })
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!res.ok || !body.id) return setStatus(body.error ?? "The template was not saved.")
    setSavedId(body.id)
    setSpec((s) => ({ ...s, name: name.trim() || s.name }))
    setStatus(null)
    setDialog(null)
    void loadSaved()
  }

  const post = async () => {
    if (!data) return setStatus("Paste a link first.")
    setStatus("Posting…")
    try {
      setPosted(await postGenerated({ template: "studio", link: data.link, spec }))
      setStatus(null)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "The clip was not posted.")
    }
  }

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  // The customizer's keys: S saves, N starts anew, R shuffles the look, D flips it light or dark.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if ((target instanceof HTMLElement && target.isContentEditable) || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      const key = e.key.toLowerCase()
      if (key === "s" && signedIn) {
        e.preventDefault()
        setName(spec.name)
        setDialog("save")
      } else if (key === "n") {
        e.preventDefault()
        startNew()
      } else if (key === "r") {
        e.preventDefault()
        shuffle()
      } else if (key === "d") {
        e.preventDefault()
        setSpec((s) => ({ ...s, look: { ...s.look, mode: s.look.mode === "light" ? "dark" : "light" } }))
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [signedIn, spec.name, startNew, shuffle])

  const shown = preview ? { ...spec, look: { ...spec.look, ...preview } } : spec
  const size = SIZES[spec.aspect]
  const frames = durationInFrames(spec)
  const origin = typeof window === "undefined" ? "" : window.location.origin
  const shareUrl = posted ? clipUrl(posted) : null
  const embedWidth = spec.aspect === "16:9" ? 640 : 360
  const embed = posted ? `<iframe src="${origin}/clips/embed/${posted.id}" width="${embedWidth}" height="${Math.round((embedWidth * size.height) / size.width)}" style="border:0" allow="autoplay; fullscreen" allowfullscreen></iframe>` : null
  const collaborate = savedId ? `${origin}/clips/studio?template=${savedId}&link=${encodeURIComponent(data?.link ?? link)}` : null
  const lookRow = (key: keyof Look) => (value: string | null) => setPreview(value === null ? null : { [key]: value })

  const fields = { isMobile, anchorRef }

  return (
    <div data-slot="designer" className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(56)] [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
      <div className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row">
        <Card ref={anchorRef} className="dark isolate z-10 max-h-full min-h-0 w-full shrink-0 self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
          <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
            <Picker>
              <PickerTrigger className="flex items-center justify-between gap-2 rounded-lg px-1.75 ring-1 ring-foreground/10 focus-visible:ring-1">
                <span className="font-medium">Studio</span>
                <MenuIcon className="size-5" />
              </PickerTrigger>
              <PickerContent side="right" align="start" alignOffset={-8}>
                <PickerGroup>
                  <PickerItem onClick={startNew}>
                    <LayoutGridIcon className="size-4 text-muted-foreground" /> Gallery <PickerShortcut>N</PickerShortcut>
                  </PickerItem>
                  <PickerItem render={<Link href="/clips" />}>
                    <ArrowLeftIcon className="size-4 text-muted-foreground" /> Clips
                  </PickerItem>
                </PickerGroup>
                <PickerSeparator />
                <PickerGroup>
                  <PickerItem disabled={!signedIn} onClick={() => (setName(spec.name), setDialog("save"))}>
                    Save... <PickerShortcut>S</PickerShortcut>
                  </PickerItem>
                  <PickerItem onClick={shuffle}>
                    Shuffle the look <PickerShortcut>R</PickerShortcut>
                  </PickerItem>
                  <PickerItem onClick={() => setLook({ mode: spec.look.mode === "light" ? "dark" : "light" })}>
                    Light/Dark <PickerShortcut>D</PickerShortcut>
                  </PickerItem>
                  <PickerItem onClick={() => setLook({ ...DEFAULT_LOOK })}>Reset the look</PickerItem>
                </PickerGroup>
              </PickerContent>
            </Picker>
          </CardHeader>
          <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
            <FieldGroup className="flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto max-md:px-3 md:flex-col md:gap-3.25">
              <div className="group/picker relative">
                <Picker onOpenChange={(next) => next && signedIn && void loadSaved()}>
                  <PickerTrigger className="w-full">
                    <div className="flex min-w-0 flex-1 flex-col justify-start pr-8 text-left">
                      <div className="text-xs text-muted-foreground">Template</div>
                      <div className="truncate text-sm font-medium text-foreground">{view === "gallery" ? "Gallery" : spec.name}</div>
                    </div>
                    <span className="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-foreground select-none md:right-2.5">
                      <LayoutGridIcon className="size-4" />
                    </span>
                  </PickerTrigger>
                  <PickerContent anchor={isMobile ? anchorRef : undefined} side={isMobile ? "top" : "right"} align={isMobile ? "center" : "start"}>
                    <PickerGroup>
                      <PickerLabel>Gallery</PickerLabel>
                      {GALLERY.map((t) => (
                        <PickerItem key={t.id} onClick={() => open(t)}>
                          {t.name}
                        </PickerItem>
                      ))}
                    </PickerGroup>
                    {saved.length > 0 && (
                      <>
                        <PickerSeparator />
                        <PickerGroup>
                          <PickerLabel>Yours</PickerLabel>
                          {saved.map((t) => (
                            <PickerItem key={t.id} onClick={() => open(t)}>
                              <span className="truncate">{t.name}</span>
                              {savedId === t.id && <CheckIcon className="ml-auto size-4" />}
                            </PickerItem>
                          ))}
                        </PickerGroup>
                      </>
                    )}
                  </PickerContent>
                </Picker>
              </div>
              <LinkRow value={link} onChange={setLink} onSubmit={() => link.trim() !== loaded.current && void load(link)} loading={loading} error={error} />
              <FieldSeparator className="hidden md:block" />
              <Row {...fields} label="Shape" value={spec.aspect} options={ASPECTS} onChange={(aspect) => change({ ...spec, aspect: aspect as Aspect })} trailing={<span className={cn("inline-block rounded-[3px] border-2 border-current text-foreground", spec.aspect === "9:16" ? "h-4 w-2.5" : spec.aspect === "1:1" ? "size-3.5" : "h-2.5 w-4")} />} />
              <Row {...fields} label="Mode" value={spec.look.mode} options={MODES} onChange={(mode) => setLook({ mode: mode as Look["mode"] })} onPreview={lookRow("mode")} trailing={<Dot color={spec.look.mode === "light" ? "#fafafa" : "#0a0a0a"} className="ring-1 ring-foreground/30" />} />
              <FieldSeparator className="hidden md:block" />
              <Row {...fields} label="Base Color" value={spec.look.base} options={Object.entries(BASES).map(([value, b]) => ({ value, label: b.label, swatch: <Dot className={BASE_SWATCH[value]} /> }))} onChange={(base) => setLook({ base })} onPreview={lookRow("base")} trailing={<Dot className={BASE_SWATCH[spec.look.base]} />} />
              <Row {...fields} label="Theme" value={spec.look.theme} options={Object.entries(THEMES).map(([value, t]) => ({ value, label: t.label, swatch: <Dot color={t.light} /> }))} onChange={(theme) => setLook({ theme })} onPreview={lookRow("theme")} trailing={<Dot color={THEMES[spec.look.theme]?.light} />} />
              <Row {...fields} label="Chart Color" value={spec.look.chart} options={Object.entries(CHARTS).map(([value, c]) => ({ value, label: c.label, swatch: <Pair yes={c.yes} no={c.no} /> }))} onChange={(chart) => setLook({ chart })} onPreview={lookRow("chart")} trailing={<Pair yes={CHARTS[spec.look.chart]?.yes ?? "#22c55e"} no={CHARTS[spec.look.chart]?.no ?? "#ef4444"} />} />
              <FieldSeparator className="hidden md:block" />
              <Row {...fields} label="Heading" value={spec.look.heading} options={Object.entries(FACES).map(([value, f]) => ({ value, label: f.label, swatch: <Aa face={value} /> }))} onChange={(heading) => setLook({ heading })} onPreview={lookRow("heading")} trailing={<Aa face={spec.look.heading} />} />
              <Row {...fields} label="Font" value={spec.look.font} options={Object.entries(FACES).map(([value, f]) => ({ value, label: f.label, swatch: <Aa face={value} /> }))} onChange={(font) => setLook({ font })} onPreview={lookRow("font")} trailing={<Aa face={spec.look.font} />} />
              <FieldSeparator className="hidden md:block" />
              <Row {...fields} label="Motion" value={spec.look.motion} options={Object.entries(MOTIONS).map(([value, label]) => ({ value, label }))} onChange={(motion) => setLook({ motion })} onPreview={lookRow("motion")} />
              <Row {...fields} label="Pace" value={spec.look.pace} options={Object.entries(PACES).map(([value, p]) => ({ value, label: p.label }))} onChange={(pace) => setLook({ pace })} />
              <Row {...fields} label="Radius" value={spec.look.radius} options={Object.entries(RADII).map(([value, r]) => ({ value, label: r.label }))} onChange={(radius) => setLook({ radius })} onPreview={lookRow("radius")} trailing={<span className="inline-block size-3 rounded-tr-lg border-t-2 border-r-2 border-current text-foreground" />} />
              <div aria-hidden className="w-0.5 shrink-0 md:hidden" />
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex min-w-0 gap-2 md:flex-col md:rounded-b-none md:**:[button,a]:w-full">
            {signedIn ? (
              <Button variant="outline" className="min-w-0 flex-1 md:flex-none" onClick={() => (setName(spec.name), setDialog("save"))}>
                {savedId ? <CheckIcon /> : null}
                {savedId ? "Saved" : "Save"}
              </Button>
            ) : (
              <Button variant="outline" className="min-w-0 flex-1 md:flex-none" render={<Link href="/auth" />} nativeButton={false}>
                Sign in to save
              </Button>
            )}
            <Button variant="outline" className="min-w-0 flex-1 md:flex-none" disabled={!signedIn || !data || view === "gallery"} onClick={() => (posted ? setDialog("code") : void post())}>
              {posted ? "Posted" : status === "Posting…" ? "Posting…" : "Post"}
            </Button>
            <Button variant="outline" className="min-w-0 flex-1 md:flex-none" onClick={startNew}>
              New
            </Button>
          </CardFooter>
          <CardFooter className="-mt-3 hidden min-w-0 gap-2 md:flex md:flex-col md:**:[button,a]:w-full">
            {status && status !== "Posting…" && <p className="text-center text-xs text-muted-foreground">{status}</p>}
            <Button onClick={() => setDialog("code")} disabled={view === "gallery"}>
              Get Code
            </Button>
          </CardFooter>
        </Card>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col">
            {view === "gallery" ? (
              <>
              {shared && (
                <div className="flex items-center justify-center px-4 pt-4 md:px-6">
                  <Button size="sm" onClick={() => void openShared()}>
                    Open the shared template
                  </Button>
                </div>
              )}
              <div className="grid min-h-0 flex-1 auto-rows-[533px] grid-cols-[repeat(auto-fill,300px)] content-start items-start justify-center gap-6 overflow-y-auto p-4 md:p-6">
                {GALLERY.map((t) => (
                  <GalleryTile key={t.id} template={t} data={cache[t.link]} onOpen={() => open(t)} />
                ))}
              </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="relative min-h-0 flex-1">
                    <div className="absolute inset-4 md:inset-6">
                      <Player key={spec.aspect} component={VideoComponent} inputProps={{ spec: shown, data }} durationInFrames={frames} fps={spec.fps} compositionWidth={size.width} compositionHeight={size.height} style={{ width: "100%", height: "100%" }} controls loop autoPlay clickToPlay />
                    </div>
                  </div>
                  {shareUrl && (
                    <div className="flex justify-center pb-2">
                      <Button variant="ghost" size="sm" onClick={() => copy("share", shareUrl)}>
                        {copied === "share" ? <CheckIcon /> : <CopyIcon />} {copied === "share" ? "Link copied" : "Posted · copy the link"}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 overflow-x-auto border-t bg-background/60 px-4 py-3">
                    {spec.scenes.map((s, i) => (
                      <button key={s.id} type="button" onClick={() => setSelected(selected === i ? null : i)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ring-1 ring-foreground/10 hover:bg-muted", selected === i && "bg-muted ring-foreground/40")}>
                        <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="whitespace-nowrap">{SCENE_LABELS[s.kind]}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{(sceneFrames(s, spec) / spec.fps).toFixed(1)}s</span>
                      </button>
                    ))}
                    <Picker>
                      <PickerTrigger className="flex w-auto shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm md:w-auto md:px-2.5 md:py-1.5">
                        <PlusIcon className="size-4" /> Scene
                      </PickerTrigger>
                      <PickerContent side="top" align="start" className="w-max min-w-44 md:w-max">
                        {KINDS.map((k) => (
                          <PickerItem
                            key={k}
                            className="whitespace-nowrap"
                            onClick={() => {
                              change({ ...spec, scenes: [...spec.scenes, newScene(k)] })
                              setSelected(spec.scenes.length)
                            }}
                          >
                            {SCENE_LABELS[k]}
                          </PickerItem>
                        ))}
                      </PickerContent>
                    </Picker>
                    <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground tabular-nums">{(frames / spec.fps).toFixed(1)}s</span>
                  </div>
                </div>
                {scene && selected !== null && (
                  <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-background/80">
                    <div className="flex items-center gap-1 border-b px-4 py-2.5">
                      <span className="flex-1 text-sm font-medium">
                        {selected + 1}. {SCENE_LABELS[scene.kind]}
                      </span>
                      <Button variant="ghost" size="icon-xs" aria-label="Move earlier" disabled={selected === 0} onClick={() => move(selected, selected - 1)}>
                        <ArrowLeftIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Move later" disabled={selected === spec.scenes.length - 1} onClick={() => move(selected, selected + 1)}>
                        <ArrowRightIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Duplicate" onClick={() => (change({ ...spec, scenes: [...spec.scenes.slice(0, selected + 1), { ...scene, id: uid() }, ...spec.scenes.slice(selected + 1)] }), setSelected(selected + 1))}>
                        <CopyIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete"
                        onClick={() => {
                          change({ ...spec, scenes: spec.scenes.filter((_, j) => j !== selected) })
                          setSelected(null)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={() => setSelected(null)}>
                        <XIcon />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-4 p-4">
                      {!FIXED_SECONDS[scene.kind] && (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label={`Length · ${scene.seconds}s`}>
                            <input type="range" min={1} max={20} step={0.5} value={scene.seconds} onChange={(e) => setScene({ seconds: Number(e.target.value) })} className="h-8 accent-primary" />
                          </Field>
                          <Field label="Enters by">
                            <Choose label="Enters by" value={scene.transition} options={TRANSITIONS} onChange={(transition) => setScene({ transition: transition as Transition })} />
                          </Field>
                        </div>
                      )}
                      <SceneKnobs scene={scene} onChange={setScene} />
                      {data && Object.keys(data.fields).length > 0 && (
                        <div className="flex flex-col gap-2 border-t pt-4">
                          <span className="text-xs text-muted-foreground">{data.label}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(data.fields).map(([k, v]) => (
                              <button key={k} type="button" title={v} onClick={() => copy(k, `{${k}}`)} className="flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">
                                {copied === k && <CheckIcon className="size-3" />}
                                {`{${k}}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialog === "save"} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save</DialogTitle>
            <DialogDescription>Kept with your account, to feed any link later.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A name for it" autoFocus />
            {status && <p className="text-xs text-muted-foreground">{status}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit">{savedId ? "Update" : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "code"} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Get Code</DialogTitle>
            <DialogDescription>Share the clip, put it on a page, or hand the template to someone to work on.</DialogDescription>
          </DialogHeader>
          <CodeBlock label="Share link" value={shareUrl} copied={copied === "c-share"} onCopy={(v) => copy("c-share", v)} empty={<EmptyAction text="Post the clip to get its link." action={signedIn && data ? "Post" : null} onAction={() => void post()} />} />
          <CodeBlock label="Embed" value={embed} copied={copied === "c-embed"} onCopy={(v) => copy("c-embed", v)} empty={<EmptyAction text="Post the clip to embed it." action={null} />} />
          <CodeBlock label="Collaborate" value={collaborate} copied={copied === "c-collab"} onCopy={(v) => copy("c-collab", v)} empty={<EmptyAction text="Save the template to get a link that opens it in Studio." action={signedIn ? "Save" : null} onAction={() => (setName(spec.name), setDialog("save"))} />} />
        </DialogContent>
      </Dialog>
    </div>
  )

  function move(from: number, to: number) {
    if (to < 0 || to >= spec.scenes.length) return
    const scenes = [...spec.scenes]
    const [one] = scenes.splice(from, 1)
    scenes.splice(to, 0, one)
    change({ ...spec, scenes })
    setSelected(to)
  }
}

function CodeBlock({ label, value, copied, onCopy, empty }: { label: string; value: string | null; copied: boolean; onCopy: (value: string) => void; empty: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {value ? (
        <div className="relative rounded-lg bg-muted p-3 pr-12 font-mono text-xs break-all">
          {value}
          <Button variant="ghost" size="icon-sm" className="absolute top-1.5 right-1.5" aria-label={`Copy the ${label.toLowerCase()}`} onClick={() => onCopy(value)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      ) : (
        empty
      )}
    </div>
  )
}

function EmptyAction({ text, action, onAction }: { text: string; action: string | null; onAction?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      <span className="flex-1">{text}</span>
      {action && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  )
}

/** A gallery card: the template on its own link in the shape of a Short (Brendan, 2026-09-14: the feed's 450 × 800 player at two thirds), a still until the pointer is over it. No label. */
function GalleryTile({ template, data, onOpen }: { template: Prepared; data: StudioData | null | undefined; onOpen: () => void }) {
  const [hover, setHover] = React.useState(false)
  const spec = template.spec
  const size = SIZES[spec.aspect]
  const frames = durationInFrames(spec)
  const first = spec.scenes[0]
  const still = first && FIXED_SECONDS[first.kind] ? (first.kind === "roll-call-tally" ? 360 : 560) : Math.min(frames - 1, (first ? sceneFrames(first, spec) : 0) + 45)
  const common = { component: VideoComponent, inputProps: { spec, data: data ?? null }, durationInFrames: frames, fps: spec.fps, compositionWidth: size.width, compositionHeight: size.height, style: { width: "100%", height: "100%" } }
  return (
    <button type="button" onClick={onOpen} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} aria-label={template.name} className="relative block h-[533px] w-[300px] shrink-0 overflow-hidden rounded-2xl bg-black shadow-sm transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {data === undefined ? <div className="absolute inset-0 animate-pulse bg-foreground/10" /> : hover ? <Player {...common} autoPlay loop /> : <Thumbnail {...common} frameToDisplay={still} />}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Choose({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger size="sm" className="h-8 w-full" aria-label={label}>
        <SelectValue>{() => options.find((o) => o.value === value)?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-max min-w-44">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="whitespace-nowrap">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SceneKnobs({ scene, onChange }: { scene: Scene; onChange: (patch: Partial<Scene>) => void }) {
  const text = (label: string, key: string, area = false) => (
    <Field label={label}>
      {area ? (
        <Textarea value={String((scene as Record<string, unknown>)[key] ?? "")} onChange={(e) => onChange({ [key]: e.target.value } as Partial<Scene>)} className="min-h-16 font-mono text-xs" />
      ) : (
        <Input value={String((scene as Record<string, unknown>)[key] ?? "")} onChange={(e) => onChange({ [key]: e.target.value } as Partial<Scene>)} className="h-8 font-mono text-xs" />
      )}
    </Field>
  )
  const align = (value: "left" | "center") => (
    <Field label="Align">
      <Choose
        label="Align"
        value={value}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ]}
        onChange={(v) => onChange({ align: v } as Partial<Scene>)}
      />
    </Field>
  )
  switch (scene.kind) {
    case "title":
      return (
        <div className="flex flex-col gap-3">
          {text("Eyebrow", "eyebrow")}
          {text("Headline", "headline")}
          {text("Subhead", "subhead", true)}
          {align(scene.align)}
        </div>
      )
    case "portrait":
      return (
        <div className="flex flex-col gap-3">
          {text("Image", "image")}
          {text("Name", "name")}
          {text("Detail", "detail")}
        </div>
      )
    case "number":
      return (
        <div className="flex flex-col gap-3">
          {text("Number", "value")}
          {text("Label", "label")}
          <Field label="Color">
            <Choose
              label="Color"
              value={scene.color}
              options={[
                { value: "yes", label: "Chart, first" },
                { value: "no", label: "Chart, second" },
                { value: "accent", label: "Theme" },
                { value: "ink", label: "Text" },
              ]}
              onChange={(color) => onChange({ color } as Partial<Scene>)}
            />
          </Field>
        </div>
      )
    case "stats":
      return (
        <div className="flex flex-col gap-3">
          {scene.items.map((item, i) => (
            <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <Input value={item.value} onChange={(e) => onChange({ items: scene.items.map((it, j) => (j === i ? { ...it, value: e.target.value } : it)) } as Partial<Scene>)} className="h-8 font-mono text-xs" aria-label={`Number ${i + 1}`} />
              <Input value={item.label} onChange={(e) => onChange({ items: scene.items.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)) } as Partial<Scene>)} className="h-8 text-xs" aria-label={`Label ${i + 1}`} />
            </div>
          ))}
        </div>
      )
    case "tally":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {text("Yes", "yes")}
            {text("No", "no")}
            {text("Other", "other")}
          </div>
          {text("Stamp", "stamp")}
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Checkbox checked={scene.grid} onCheckedChange={(v) => onChange({ grid: v === true } as Partial<Scene>)} /> Seat grid
          </Label>
        </div>
      )
    case "timeline":
      return (
        <div className="flex flex-col gap-3">
          <Field label={`Items shown · ${scene.max}`}>
            <input type="range" min={1} max={12} value={scene.max} onChange={(e) => onChange({ max: Number(e.target.value) } as Partial<Scene>)} className="h-8 accent-primary" />
          </Field>
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Checkbox checked={scene.dates} onCheckedChange={(v) => onChange({ dates: v === true } as Partial<Scene>)} /> Dates
          </Label>
        </div>
      )
    case "bars":
      return <div className="flex flex-col gap-3">{text("Title", "title")}</div>
    case "text":
      return (
        <div className="flex flex-col gap-3">
          {text("Words", "body", true)}
          <Field label={`Size · ${scene.size}`}>
            <input type="range" min={28} max={140} value={scene.size} onChange={(e) => onChange({ size: Number(e.target.value) } as Partial<Scene>)} className="h-8 accent-primary" />
          </Field>
          {align(scene.align)}
        </div>
      )
    case "end":
      return <div className="flex flex-col gap-3">{text("Tagline", "tagline")}</div>
    case "roll-call-tally":
    case "bill-history":
      return null
  }
}
