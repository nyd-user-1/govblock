"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"
import { SlideLink } from "@/components/unite-slide-link"

// /unite's second section: canvasui's Particle Scroll docs page, reproduced
// whole as a starting shape (Brendan, 2026-09-10) — everything but canvasui's
// rail and header. The <ParticleScroll> that dissolves it lives a level up,
// in components/unite.tsx, around the whole page.
//
// Previous and Next lead to /unite and /unite-2 instead of canvasui's
// neighbouring components.
//
// Differences from the original: no demo controls panel (canvasui-internal),
// the renderer and framework pickers show only the build that is vendored
// (WebGL, React), "Copy for AI" does not open, and the code is canvasui's grey
// without its per-token shades.

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?q=80&w=2032&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1782094002386-7d9ae1f49f50?q=80&w=1817&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1781499455083-6ccc3beb20cd?q=80&w=1809&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1779684474703-5c0519bcf7e8?q=80&w=2703&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
]

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"

const MANAGERS = [
  { id: "npm", run: "npx" },
  { id: "pnpm", run: "pnpm dlx" },
  { id: "yarn", run: "yarn dlx" },
  { id: "bun", run: "bunx --bun" },
] as const

type Manager = (typeof MANAGERS)[number]["id"]

const PROPS: { name: string; description: string; type: string; value: string }[] = [
  { name: "point", type: "number", value: "0.68", description: "Viewport fraction of the formation line. Content assembles as it scrolls up past this line and dissolves back below it." },
  { name: "band", type: "number", value: "420", description: "Height in CSS pixels of the transition band where particles progressively reassemble." },
  { name: "density", type: "number", value: "2", description: "Grain spacing in CSS pixels. Smaller values mean finer, denser sand." },
  { name: "size", type: "number", value: "1.25", description: "Size of fully scattered dust grains in CSS pixels. Grains grow to cover their cell as they land." },
  { name: "spread", type: "number", value: "220", description: "Maximum distance in CSS pixels particles scatter from their home position." },
  { name: "gravity", type: "number", value: "0.35", description: "Downward bias of the scattered cloud (-1 to 1), like sand settling. Negative values lift it." },
  { name: "drift", type: "number", value: "0.7", description: "Idle float speed of scattered particles (0 to 1). 0 freezes the cloud." },
  { name: "swirl", type: "number", value: "60", description: "Sideways arc in CSS pixels particles take while flying home." },
  { name: "stagger", type: "number", value: "0.7", description: "Per-particle randomness of reassembly timing (0 to 1)." },
  { name: "fade", type: "number", value: "0.85", description: "Opacity of fully scattered particles (0 to 1)." },
  { name: "settle", type: "number", value: "1.2", description: "Seconds a row of dust takes to condense into the page once the reveal reaches it." },
  { name: "smoothing", type: "number", value: "0.6", description: "Seconds the damped scroll takes to catch up with the real scroll. Higher feels more fluid." },
  { name: "className", type: "string", value: "—", description: "Classes applied to the wrapper element." },
]

const H2 = "scroll-mt-24 text-lg font-semibold tracking-[-0.01em]"
const NOTE = "mt-2 text-[13px] text-muted-foreground"
const PANEL = "overflow-hidden rounded-xl border border-border/60"
const PANEL_BAR = "flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40"
const PILL = "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-95 motion-reduce:transition-none"
const PICKER = "my-1.5 inline-flex h-8 min-w-0 items-center justify-between gap-1.5 rounded-lg border border-transparent px-2.5 text-[13px] whitespace-nowrap text-muted-foreground"

export function UniteParticleScroll({ code }: { code: string }) {
  return (
    <section className="px-5 pt-24 pb-10 sm:px-8 lg:pt-16">
      <Article code={code} />
    </section>
  )
}

function Article({ code }: { code: string }) {
  const [manager, setManager] = useState<Manager>("npm")
  const run = MANAGERS.find((m) => m.id === manager)!.run
  const install = `${run} shadcn@latest add @canvas-ui/particle-scroll-react`
  const dependencies = "# No dependencies for the WebGL build."

  return (
    <article className="mx-auto w-full max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="min-w-0 text-3xl font-semibold tracking-[-0.02em]">Particle Scroll</h1>
        <button
          type="button"
          aria-haspopup="menu"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-3 text-[13px] text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-95 motion-reduce:transition-none"
        >
          Copy for AI
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
        Everything below a chosen line dissolves into drifting sand. Scroll down and the page reassembles, grain by grain.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["html-in-canvas", "webgl", "webgpu"].map((tag) => (
          <span key={tag} className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11.5px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <section className="mt-8" aria-label="Demo image">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Demo image</h2>
        <p className={NOTE}>
          Rich imagery makes the effect shine, watch every pixel of the photo scatter into dust and settle back as it crosses the line.
        </p>
        <div className={cn("mt-3", PANEL)}>
          <ImageCycler images={DEMO_IMAGES} alt="Demo photo for the Particle Scroll effect" />
        </div>
      </section>

      <section className="mt-8" aria-label="Installation">
        <h2 id="install" className={H2}>
          Install
        </h2>
        <div className={cn("mt-3", PANEL)}>
          <div className={cn(PANEL_BAR, "px-2")}>
            <ManagerTabs value={manager} onChange={setManager} />
            <div className="flex min-w-0 items-center gap-1">
              <span className={PICKER}>
                WebGL <ChevronDown className="size-3.5" />
              </span>
              <span className={PICKER}>
                React <ChevronDown className="size-3.5" />
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-4">
            <code className="overflow-x-auto text-[13px] whitespace-nowrap text-foreground/90">{install}</code>
            <CopyPill text={install} />
          </div>
        </div>
        <p className={NOTE}>Or copy the source below into your project. Prefer WGSL? Switch the renderer above to the WebGPU build.</p>
      </section>

      <section className="mt-8" aria-label="Dependencies">
        <h2 id="dependencies" className={H2}>
          Dependencies
        </h2>
        <p className={NOTE}>The install command above adds these automatically. If you copy the source by hand, install them yourself.</p>
        <div className={cn("mt-3", PANEL)}>
          <div className={cn(PANEL_BAR, "px-2")}>
            <ManagerTabs value={manager} onChange={setManager} />
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-4">
            <code className="overflow-x-auto text-[13px] whitespace-pre text-foreground/90">{dependencies}</code>
            <CopyPill text={dependencies} />
          </div>
        </div>
      </section>

      <section className="mt-8" aria-label="Code">
        <h2 id="code" className={H2}>
          Code
        </h2>
        <div className={cn("mt-3", PANEL)}>
          <div className={cn(PANEL_BAR, "pr-1.5 pl-2")}>
            <div className="flex min-w-0 items-center gap-1">
              <span className={PICKER}>
                WebGL <ChevronDown className="size-3.5" />
              </span>
              <span className={PICKER}>
                React <ChevronDown className="size-3.5" />
              </span>
            </div>
            <CopyPill text={code} />
          </div>
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
            <span className="text-[12px] text-muted-foreground">ParticleScroll.tsx</span>
            <span className="text-[12px] text-muted-foreground">WebGL · GLSL</span>
          </div>
          <div className="max-h-[480px] overflow-y-auto text-[13px] leading-6">
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[#404040] dark:text-[#b3b3b3]">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-label="API reference">
        <h2 id="api-reference" className={H2}>
          API reference
        </h2>
        <div className={cn("mt-3", PANEL)}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  {["Property", "Type", "Default"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROPS.map((p, i) => (
                  <tr key={p.name} className={cn(i < PROPS.length - 1 && "border-b border-border/40")}>
                    <td className="min-w-56 px-4 py-3.5 align-top">
                      <code className="font-mono text-[13px] font-medium text-foreground">{p.name}</code>
                      <p className="mt-1 max-w-md text-[13px] leading-5 text-muted-foreground">{p.description}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <code className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] whitespace-nowrap text-foreground/80">{p.type}</code>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {p.value === "—" ? (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      ) : (
                        <code className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] whitespace-nowrap text-foreground/80">{p.value}</code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <nav aria-label="Component pagination" className="mt-12 grid grid-cols-1 gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
        <SlideLink
          href="/unite"
          direction="back"
          className="min-w-0"
          linkClassName="group flex h-full min-w-0 items-center gap-3 rounded-xl border border-border/60 px-4 py-3.5 transition-colors duration-150 hover:border-border hover:bg-muted/30"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors duration-150 group-hover:border-foreground/20 group-hover:text-foreground">
            <ArrowLeft className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Previous</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-foreground">unite</span>
          </span>
        </SlideLink>
        <SlideLink
          href="/unite-2"
          direction="forward"
          className="min-w-0 sm:col-start-2"
          linkClassName="group flex h-full min-w-0 items-center gap-3 rounded-xl border border-border/60 px-4 py-3.5 text-right transition-colors duration-150 hover:border-border hover:bg-muted/30"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next</span>
            <span className="mt-0.5 block truncate text-sm font-medium text-foreground">unite-2</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors duration-150 group-hover:border-foreground/20 group-hover:text-foreground">
            <ArrowRight className="size-4" />
          </span>
        </SlideLink>
      </nav>
    </article>
  )
}

function ManagerTabs({ value, onChange }: { value: Manager; onChange: (m: Manager) => void }) {
  return (
    <>
      <div role="tablist" aria-label="Package manager" className="hidden items-center sm:flex">
        {MANAGERS.map((m) => {
          const active = m.id === value
          return (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(m.id)}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-[13px] transition-colors duration-150",
                active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.id}
              <span className={cn("absolute inset-x-3 -bottom-px h-px bg-foreground transition-opacity duration-150", active ? "opacity-100" : "opacity-0")} />
            </button>
          )
        })}
      </div>
      <select
        aria-label="Package manager"
        value={value}
        onChange={(e) => onChange(e.target.value as Manager)}
        className="my-1.5 h-8 rounded-lg bg-transparent px-2 text-[13px] text-muted-foreground sm:hidden"
      >
        {MANAGERS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </select>
    </>
  )
}

function CopyPill({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      className={PILL}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
    >
      {copied ? <Check className="size-[15px]" /> : <Copy className="size-[15px]" />}
    </button>
  )
}

function ImageCycler({ images, alt, interval = 10_000 }: { images: string[]; alt: string; interval?: number }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let timer: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }
    const start = () => {
      if (timer === null && !document.hidden) timer = setInterval(() => setIndex((i) => (i + 1) % images.length), interval)
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [images.length, interval])

  return (
    <div className="relative aspect-video w-full overflow-hidden">
      {images.map((src, i) => {
        const on = i === index
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            crossOrigin="anonymous"
            alt={on ? alt : ""}
            aria-hidden={!on}
            loading={i === 0 ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: on ? 1 : 0,
              transform: on ? "scale(1)" : "scale(1.06)",
              filter: on ? "blur(0px)" : "blur(14px)",
              transition: `opacity 1.6s ${EASE}, transform 1.6s ${EASE}, filter 1.6s ${EASE}`,
            }}
          />
        )
      })}
    </div>
  )
}
