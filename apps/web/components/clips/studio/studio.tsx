"use client"

import * as React from "react"
import Link from "next/link"
import { Player } from "@remotion/player"
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, CheckIcon, CopyIcon, LinkIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { useAccount } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Label } from "@govblock/ui/components/nova/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

import { clipUrl } from "../menu"
import { postGenerated, type Clip } from "../store"
import { durationInFrames, newScene, resolveLink, SCENE_LABELS, SIZES, starterSpec, type Aspect, type Scene, type SceneKind, type StudioData, type StudioSpec, type Theme, type Transition } from "./spec"
import { StudioVideo } from "./studio-video"

// Studio (Brendan, 2026-09-14): build a video template from scenes and knobs,
// feed it a bill or a roll call by its link, watch it play, save it, post it.
// Left, the controls: the link and the fields it gives, the format and theme,
// the scenes in order, and the selected scene's settings. Right, the preview.

type Saved = { id: string; name: string; updatedAt: string; spec: StudioSpec }

const KINDS = Object.keys(SCENE_LABELS) as SceneKind[]
const TRANSITIONS: Transition[] = ["fade", "slide", "zoom", "none"]
const ASPECTS: Aspect[] = ["9:16", "1:1", "16:9"]

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b px-4 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
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

function Pick<T extends string>({ value, options, onChange, label, names }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; names?: Partial<Record<T, string>> }) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger size="sm" className="h-8 w-full" aria-label={label}>
        <SelectValue>{() => names?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-max min-w-44">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="whitespace-nowrap">
            {names?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded border bg-transparent p-0.5" aria-label={label} />
      <span className="text-muted-foreground">{label}</span>
    </label>
  )
}

export function Studio() {
  const { signedIn } = useAccount()
  const [spec, setSpec] = React.useState<StudioSpec>(() => starterSpec("roll-call"))
  const [selected, setSelected] = React.useState(0)
  const [link, setLink] = React.useState("house-119-2/295")
  const [data, setData] = React.useState<StudioData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState<Saved[]>([])
  const [savedId, setSavedId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [posted, setPosted] = React.useState<Clip | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)

  const load = React.useCallback(async (text: string) => {
    if (!resolveLink(text)) return setError("Paste a bill's link or a roll call's link.")
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clips/studio/data?link=${encodeURIComponent(text)}`)
      const body = (await res.json()) as { data?: StudioData; error?: string }
      if (!res.ok || !body.data) throw new Error(body.error ?? "That link did not load.")
      setData(body.data)
      setLink(body.data.link)
    } catch (e) {
      setError(e instanceof Error ? e.message : "That link did not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSaved = React.useCallback(async () => {
    const res = await fetch("/api/clips/studio/templates", { cache: "no-store" }).catch(() => null)
    if (res?.ok) setSaved(((await res.json()) as { templates: Saved[] }).templates)
  }, [])

  React.useEffect(() => {
    void load("house-119-2/295")
  }, [load])
  React.useEffect(() => {
    if (signedIn) void loadSaved()
  }, [signedIn, loadSaved])

  const set = (patch: Partial<StudioSpec>) => {
    setSpec((s) => ({ ...s, ...patch }))
    setPosted(null)
  }
  const setTheme = (patch: Partial<Theme>) => set({ theme: { ...spec.theme, ...patch } })
  const scene = spec.scenes[selected] ?? null
  const setScene = (patch: Partial<Scene>) => set({ scenes: spec.scenes.map((s, i) => (i === selected ? ({ ...s, ...patch } as Scene) : s)) })
  const move = (from: number, to: number) => {
    if (to < 0 || to >= spec.scenes.length) return
    const scenes = [...spec.scenes]
    const [one] = scenes.splice(from, 1)
    scenes.splice(to, 0, one)
    set({ scenes })
    setSelected(to)
  }

  const save = async () => {
    setStatus("Saving…")
    const res = await fetch("/api/clips/studio/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: savedId, spec }) })
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!res.ok || !body.id) return setStatus(body.error ?? "The template was not saved.")
    setSavedId(body.id)
    setStatus("Saved")
    void loadSaved()
    window.setTimeout(() => setStatus(null), 1500)
  }

  const post = async () => {
    if (!data) return
    setStatus("Posting…")
    try {
      const clip = await postGenerated({ template: "studio", link: data.link, spec })
      setPosted(clip)
      setStatus(null)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "The clip was not posted.")
    }
  }

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(text)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const size = SIZES[spec.aspect]
  const frames = durationInFrames(spec)

  return (
    <div className="container-wrapper flex min-h-0 flex-1 flex-col px-2 lg:px-4">
      <div className="flex h-14 items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/clips" />} nativeButton={false}>
          <ArrowLeftIcon /> Clips
        </Button>
        <Input value={spec.name} onChange={(e) => set({ name: e.target.value })} className="h-8 w-56" aria-label="Template name" />
        {saved.length > 0 && (
          <Select
            value={savedId ?? ""}
            onValueChange={(v) => {
              const t = saved.find((s) => s.id === v)
              if (!t) return
              setSpec(t.spec)
              setSavedId(t.id)
              setSelected(0)
            }}
          >
            <SelectTrigger size="sm" className="h-8 w-max min-w-44" aria-label="Saved templates">
              <SelectValue>{() => saved.find((s) => s.id === savedId)?.name ?? "Your templates"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="w-max min-w-44">
              {saved.map((s) => (
                <SelectItem key={s.id} value={s.id} className="whitespace-nowrap">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSpec(starterSpec(data?.kind ?? "roll-call"))
            setSavedId(null)
            setSelected(0)
          }}
        >
          New
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{status}</span>
        {signedIn ? (
          <>
            <Button variant="outline" size="sm" onClick={() => void save()}>
              Save
            </Button>
            <Button size="sm" disabled={!data || !!posted} onClick={() => void post()}>
              {posted ? "Posted" : "Post"}
            </Button>
          </>
        ) : (
          <Button size="sm" render={<Link href="/auth" />} nativeButton={false}>
            Sign in to save
          </Button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pb-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto rounded-xl border bg-card lg:h-[calc(100svh-var(--header-height)-5rem)]">
          <Section title="Data">
            <form
              className="flex h-9 items-center gap-2 rounded-full border bg-background pr-1 pl-3"
              onSubmit={(e) => {
                e.preventDefault()
                void load(link)
              }}
            >
              <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a bill or roll call link" className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" aria-label="Link" />
              <Button type="submit" size="sm" className="h-7 rounded-full" disabled={loading}>
                {loading ? "Loading…" : "Load"}
              </Button>
            </form>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {data && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.fields).map(([k, v]) => (
                  <button key={k} type="button" title={v} onClick={() => copy(`{${k}}`)} className="flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">
                    {copied === `{${k}}` ? <CheckIcon className="size-3" /> : null}
                    {`{${k}}`}
                  </button>
                ))}
                {data.lists.milestones && <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">milestones · {data.lists.milestones.length}</span>}
                {data.lists.parties && <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">parties · {data.lists.parties.length}</span>}
              </div>
            )}
          </Section>

          <Section title="Format and theme">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shape">
                <Pick label="Shape" value={spec.aspect} options={ASPECTS} onChange={(aspect) => set({ aspect })} />
              </Field>
              <Field label="Font">
                <Pick label="Font" value={spec.theme.font} options={["sans", "serif", "mono"] as const} onChange={(font) => setTheme({ font })} names={{ sans: "Sans", serif: "Serif", mono: "Mono" }} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Color label="Background" value={spec.theme.background} onChange={(background) => setTheme({ background })} />
              <Color label="Text" value={spec.theme.ink} onChange={(ink) => setTheme({ ink })} />
              <Color label="Accent" value={spec.theme.accent} onChange={(accent) => setTheme({ accent })} />
              <Color label="Yes" value={spec.theme.yes} onChange={(yes) => setTheme({ yes })} />
              <Color label="No" value={spec.theme.no} onChange={(no) => setTheme({ no })} />
            </div>
          </Section>

          <Section
            title={`Scenes · ${(frames / spec.fps).toFixed(1)} s`}
            action={
              <Select value="" onValueChange={(v) => v && (set({ scenes: [...spec.scenes, newScene(v as SceneKind)] }), setSelected(spec.scenes.length))}>
                <SelectTrigger size="sm" className="h-7 w-max gap-1" aria-label="Add a scene">
                  <SelectValue>
                    {() => (
                      <>
                        <PlusIcon className="size-3.5" /> Add
                      </>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-max min-w-44" align="end">
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="whitespace-nowrap">
                      {SCENE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <ol className="flex flex-col gap-1">
              {spec.scenes.map((s, i) => (
                <li key={s.id}>
                  <div role="button" tabIndex={0} onClick={() => setSelected(i)} onKeyDown={(e) => e.key === "Enter" && setSelected(i)} className={cn("group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", i === selected && "bg-accent")}>
                    <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{SCENE_LABELS[s.kind]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.seconds}s</span>
                    <span className="flex opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon-xs" aria-label="Move up" onClick={(e) => (e.stopPropagation(), move(i, i - 1))}>
                        <ArrowUpIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Move down" onClick={(e) => (e.stopPropagation(), move(i, i + 1))}>
                        <ArrowDownIcon />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Duplicate" onClick={(e) => (e.stopPropagation(), set({ scenes: [...spec.scenes.slice(0, i + 1), { ...s, id: Math.random().toString(36).slice(2, 10) }, ...spec.scenes.slice(i + 1)] }))}>
                        <CopyIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          set({ scenes: spec.scenes.filter((_, j) => j !== i) })
                          setSelected((sel) => Math.max(0, Math.min(sel, spec.scenes.length - 2)))
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {scene && (
            <Section title={`${selected + 1}. ${SCENE_LABELS[scene.kind]}`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Length · ${scene.seconds}s`}>
                  <input type="range" min={1} max={20} step={0.5} value={scene.seconds} onChange={(e) => setScene({ seconds: Number(e.target.value) })} className="h-8 accent-primary" />
                </Field>
                <Field label="Enters by">
                  <Pick label="Transition" value={scene.transition} options={TRANSITIONS} onChange={(transition) => setScene({ transition })} names={{ fade: "Fade", slide: "Slide up", zoom: "Zoom", none: "Cut" }} />
                </Field>
              </div>
              <SceneKnobs scene={scene} onChange={setScene} />
              <p className="text-[11px] text-muted-foreground">Words can hold the fields above, like {"{citation}"}; click a field to copy it.</p>
            </Section>
          )}
        </aside>

        <main className="flex min-h-[70svh] flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 p-4 lg:h-[calc(100svh-var(--header-height)-5rem)]">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <div className="overflow-hidden rounded-lg shadow-lg" style={{ aspectRatio: `${size.width} / ${size.height}`, height: size.height >= size.width ? "100%" : undefined, width: size.width > size.height ? "100%" : undefined, maxHeight: "100%", maxWidth: "100%" }}>
              <Player
                key={`${spec.aspect}:${frames}`}
                component={StudioVideo as unknown as React.ComponentType<Record<string, unknown>>}
                inputProps={{ spec, data }}
                durationInFrames={frames}
                fps={spec.fps}
                compositionWidth={size.width}
                compositionHeight={size.height}
                style={{ width: "100%", height: "100%" }}
                controls
                loop
                autoPlay
              />
            </div>
          </div>
          {posted && (
            <Button variant="ghost" size="sm" onClick={() => copy(clipUrl(posted))}>
              {copied === clipUrl(posted) ? <CheckIcon /> : <LinkIcon />} {copied === clipUrl(posted) ? "Link copied" : "Posted · copy the link"}
            </Button>
          )}
        </main>
      </div>
    </div>
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
      <Pick label="Align" value={value} options={["left", "center"] as const} onChange={(v) => onChange({ align: v } as Partial<Scene>)} names={{ left: "Left", center: "Center" }} />
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
    case "number":
      return (
        <div className="flex flex-col gap-3">
          {text("Number", "value")}
          {text("Label", "label")}
          <Field label="Color">
            <Pick label="Color" value={scene.color as "yes" | "no" | "accent" | "ink"} options={["yes", "no", "accent", "ink"] as const} onChange={(color) => onChange({ color } as Partial<Scene>)} names={{ yes: "Yes color", no: "No color", accent: "Accent", ink: "Text" }} />
          </Field>
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
          <Field label={`Milestones shown · ${scene.max}`}>
            <input type="range" min={1} max={12} value={scene.max} onChange={(e) => onChange({ max: Number(e.target.value) } as Partial<Scene>)} className="h-8 accent-primary" />
          </Field>
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Checkbox checked={scene.dates} onCheckedChange={(v) => onChange({ dates: v === true } as Partial<Scene>)} /> Dates and chambers
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
      return (
        <div className="flex flex-col gap-3">
          {text("Brand", "brand")}
          {text("Source line", "source")}
        </div>
      )
  }
}
