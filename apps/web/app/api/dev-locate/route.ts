import { NextResponse } from "next/server"
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"

/**
 * dev-locate — turn "which component, which classes" into `file:line`, plus
 * how systematized that line is and whether it looks worth extracting.
 *
 * Ported from 44b (Brendan, 2026-09-12), where it was written because the
 * off-the-shelf inspectors cannot answer this on a Next 16 + Turbopack stack.
 *
 * WHY THIS EXISTS RATHER THAN A SOURCE MAP. The inspector can read React 19's
 * `fiber._debugStack`, and the frame it wants really is in there:
 *
 *   at LawsBrowser (/_next/static/chunks/_0s39cb6._.js:2379:12)
 *
 * — but that is a position in a COMPILED chunk, and on this stack there is no
 * way to map it back. Measured in 44b, all three routes closed: Turbopack
 * serves no `.map` in development (404) and emits no `//# sourceMappingURL`,
 * so the browser cannot resolve it either; `/__nextjs_original-stack-frames`
 * REJECTS an absolute http URL ("Unknown url scheme 'http'") and, handed the
 * same frame as a path, returns it verbatim and unmapped; `/__nextjs_source-map`
 * fails identically. @react-trace/kit hits exactly this wall — every row it
 * prints on this app names a chunk rather than a file.
 *
 * So this searches FORWARD instead: find the file that declares the component,
 * then the line carrying the element's own class string. A Tailwind class list
 * is long and near-unique, which makes it a better key than a compiled offset
 * is recoverable.
 *
 * DEVELOPMENT ONLY — 404s in production, and next.config's alias keeps the
 * inspector that calls it out of the bundle entirely. It reads only the three
 * roots below.
 */

/** The dev server runs with cwd at apps/web; the paths it reports are anchored
 *  at the repo root, so a monorepo answer is never ambiguous between the two. */
const REPO = process.cwd().endsWith(path.join("apps", "web"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd()

/** Where components live. Deliberately NOT all of apps/web — .next holds
 *  thousands of compiled chunks and walking it dwarfs the real work. */
const ROOTS = [
  path.join(REPO, "apps/web/app"),
  path.join(REPO, "apps/web/components"),
  path.join(REPO, "packages/ui/src"),
]

const EXT = new Set([".tsx", ".ts"])

// ── the class index ─────────────────────────────────────────────────────────
// Every className literal in the roots, by file and line. Built once and held
// for a few seconds: a click should not re-read 900 files, and the source
// changes far slower than the TTL.

type ClassLine = { file: string; line: number; tokens: Set<string>; key: string }
type Cache = { lines: ClassLine[]; decls: Map<string, string>; stamp: string; checkedAt: number }

/**
 * ⚠ ON globalThis, DELIBERATELY. Turbopack re-evaluates this route's module
 * between requests, which reset a module-level cache every single time — so
 * every scan paid the full index build and a page took the better part of a
 * minute.
 */
const g = globalThis as typeof globalThis & {
  __devLocate?: Cache
  __devLocateBuilding?: Promise<Cache>
}

/** Don't re-stat more than this often; the check is cheap but not free. */
const RECHECK_MS = 2_000

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) await walk(p, out)
    else if (EXT.has(path.extname(e.name))) out.push(p)
  }
  return out
}

const rel = (p: string) => path.relative(REPO, p)
const norm = (tokens: string[]) => [...new Set(tokens)].sort().join(" ")

/**
 * The literal part of a className, in the five shapes this codebase writes it.
 *
 * The `cn(` arms are the reason this differs from 44b's copy: govblock puts
 * most of its markup through `cn("base …", cond && "…")`, and a matcher that
 * only understood `className="…"` indexed a small fraction of the app. The
 * first argument is the base list, which is the one worth keying on.
 */
const CLASS_RE =
  /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\}|\{\s*cn\(\s*"([^"]*)"|\{\s*cn\(\s*`([^`]*)`)/

/** `className={cn(` with the base list on the NEXT line, which is what
 *  prettier's 80-column wrap does to every long one. Measured: without this
 *  the index missed rail-toggle, the card frames and most of packages/ui. */
const CONT_RE = /className\s*=\s*\{\s*cn\(\s*$/
const LEAD_RE = /^\s*(?:"([^"]*)"|`([^`]*)`)/

function classLinesIn(file: string, text: string): ClassLine[] {
  const out: ClassLine[] = []
  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = CLASS_RE.exec(lines[i]) ?? (CONT_RE.test(lines[i]) ? LEAD_RE.exec(lines[i + 1] ?? "") : null)
    if (!m) continue
    const raw = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "")
      // drop ${...} interpolation so a conditional class does not poison the set
      .replace(/\$\{[^}]*\}/g, " ")
    const tokens = raw.split(/\s+/).filter((t) => t && !t.includes("${"))
    if (tokens.length < 2) continue
    // The line reported is where `className` is written, not where the literal
    // wrapped to — that is the line you would go and edit.
    out.push({ file: rel(file), line: i + 1, tokens: new Set(tokens), key: norm(tokens) })
  }
  return out
}

const DECL_RE = /(?:export\s+)?(?:function|const|class)\s+([A-Z][\w$]*)/g

/**
 * ⚠ ONE pass over the roots, producing BOTH indexes. The first version resolved
 * a component by re-walking and re-reading every file per lookup, and a page
 * scan of ~50 distinct components measured 8.8s — unusable.
 *
 * ⚠ SINGLE-FLIGHT. A batch fans out ~300 concurrent `resolve()` calls, and each
 * one awaits the index. With an empty cache every one of them started its own
 * full walk — 300× the work, and the reason a page scan took upward of 15s.
 */
async function build(): Promise<Cache> {
  if (g.__devLocateBuilding) return g.__devLocateBuilding
  const run = buildNow()
  g.__devLocateBuilding = run
  try {
    return await run
  } finally {
    g.__devLocateBuilding = undefined
  }
}

async function buildNow(): Promise<Cache> {
  const now = Date.now()
  const hit = g.__devLocate
  if (hit && now - hit.checkedAt < RECHECK_MS) return hit

  const files = (await Promise.all(ROOTS.map((r) => walk(r)))).flat()
  // Invalidate on CONTENT, not on a clock. A timer either rebuilds constantly
  // or serves line numbers from before your last edit, and the second is the
  // one thing this tool must never do.
  const stamp = (
    await Promise.all(files.map(async (f) => `${f}:${(await stat(f)).mtimeMs}`))
  ).join("|")
  if (hit && stamp === hit.stamp) {
    hit.checkedAt = now
    return hit
  }

  // Parallel: sequential awaits over the file list were most of the cold cost.
  const texts = await Promise.all(files.map((f) => readFile(f, "utf8")))
  const lines: ClassLine[] = []
  const decls = new Map<string, string>()
  files.forEach((f, i) => {
    lines.push(...classLinesIn(f, texts[i]))
    for (const m of texts[i].matchAll(DECL_RE)) if (!decls.has(m[1])) decls.set(m[1], rel(f))
  })
  const next: Cache = { lines, decls, stamp, checkedAt: now }
  g.__devLocate = next
  return next
}

// ── layers ──────────────────────────────────────────────────────────────────

export type Layer = "system" | "shared" | "page" | "unknown"

function layerOf(file: string | null): Layer {
  if (!file) return "unknown"
  if (file.startsWith("packages/ui/src/")) return "system"
  if (file.startsWith("apps/web/components/")) return "shared"
  if (file.startsWith("apps/web/app/")) return "page"
  return "unknown"
}

// ── the extraction signal ───────────────────────────────────────────────────

/**
 * Two counts, deliberately reported separately rather than summed into one
 * confident-looking number.
 *
 *   EXACT — the identical class list somewhere else. High confidence, and a
 *           FLOOR rather than a census: it finds markup copy-pasted verbatim
 *           and misses the same component written with one class different,
 *           which is the more common way duplication happens. `exact: 1` means
 *           "no verbatim twin", never "unique".
 *   NEAR  — same idea, one or two classes apart (Jaccard ≥ 0.75 over sets of
 *           3+ tokens). Looser, so it is the one to distrust first if the
 *           numbers look wrong.
 *
 * Sets under 3 tokens are skipped for NEAR entirely — `flex items-center`
 * matches half the codebase and saying so is not information.
 */
const SIM_MIN = 0.75
const NEAR_MIN_TOKENS = 3

function similarity(a: Set<string>, b: Set<string>): number {
  let hit = 0
  for (const t of a) if (b.has(t)) hit++
  return hit / (a.size + b.size - hit)
}

export type Verdict = "extract" | "local" | "watch" | "unique"

/**
 *   extract — 3+ places over 2+ files. Repetition ACROSS files is the case a
 *             shared component actually solves.
 *   local   — 3+ places inside one file. Usually a `.map()` rendering a list,
 *             which is already the right answer; extracting would be ceremony.
 *   watch   — 2 places. One repeat is coincidence, the third is a pattern.
 *   unique  — everything else.
 */
function verdictFor(total: number, fileCount: number): Verdict {
  if (total >= 3 && fileCount >= 2) return "extract"
  if (total >= 3) return "local"
  if (total === 2) return "watch"
  return "unique"
}

// ── shared resolution ───────────────────────────────────────────────────────

type Resolved = {
  file: string | null
  line: number | null
  layer: Layer
  /** No component in the chain named a file of ours, so this came from a
   *  whole-index search and the file may belong to someone else entirely. */
  loose: boolean
  exact: number
  near: number
  files: number
  examples: string[]
  verdict: Verdict
}

/**
 * ⚠ SCOPE TO A FILE OR SAY NOTHING (Brendan, 2026-09-12). A span on /docs came
 * back as `app/(records)/forms/[id]/page.tsx:98` because both files carry
 * `text-sm text-muted-foreground` and the global search took whichever came
 * first. A confident wrong file is worse than no answer from a tool whose
 * whole job is leaving no ambiguity about what to edit.
 *
 * So the WHOLE owner chain gets tried, not just the nearest name — the nearest
 * is often a framework component out of node_modules (`LinkComponent` is
 * Next's `Link`) that no file of ours declares. The first name that does
 * resolve scopes the search. Only a chain that resolves to nothing at all
 * falls back to searching everything, and that result is marked `loose` so the
 * caller can treat it as the guess it is.
 */
async function resolve(chain: string[], className: string, deep: boolean): Promise<Resolved> {
  const { lines: idx, decls } = await build()
  const tokens = className.split(/\s+/).filter(Boolean)
  const probe = [...tokens].sort((a, b) => b.length - a.length).slice(0, 4)

  let file: string | null = null
  for (const name of chain) {
    if (!/^[A-Z][\w$]*$/.test(name)) continue
    const hit = decls.get(name)
    if (hit) {
      file = hit
      break
    }
  }
  const loose = !file
  let line: number | null = null
  const inFile = file ? idx.filter((c) => c.file === file) : idx
  const hit = probe.length ? inFile.find((c) => probe.every((t) => c.tokens.has(t))) : undefined
  if (hit) {
    file = hit.file
    line = hit.line
  }

  const base = {
    file,
    line,
    layer: layerOf(file),
    exact: 0,
    near: 0,
    files: 0,
    examples: [] as string[],
    verdict: "unique" as Verdict,
    loose,
  }
  // The batch pass wants layers and nothing else — counting repeats for 300
  // elements would walk the index 300 times for numbers no one is reading yet.
  if (!deep || !hit) return base

  let exact = 0
  let near = 0
  const files = new Set<string>()
  const examples: string[] = []
  for (const c of idx) {
    if (c.file === hit.file && c.line === hit.line) {
      exact++
      files.add(c.file)
      continue
    }
    if (c.key === hit.key) {
      exact++
      files.add(c.file)
      if (examples.length < 4) examples.push(`${c.file}:${c.line}`)
    } else if (
      hit.tokens.size >= NEAR_MIN_TOKENS &&
      c.tokens.size >= NEAR_MIN_TOKENS &&
      similarity(hit.tokens, c.tokens) >= SIM_MIN
    ) {
      near++
      files.add(c.file)
      if (examples.length < 4) examples.push(`~ ${c.file}:${c.line}`)
    }
  }
  return {
    ...base,
    exact,
    near,
    files: files.size,
    examples,
    verdict: verdictFor(exact + near, files.size),
  }
}

// ── the route ───────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 })
  }

  const url = new URL(req.url)
  const chain = (url.searchParams.get("chain") ?? url.searchParams.get("component") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
  const className = (url.searchParams.get("class") ?? "").trim()
  if (!chain.length && !className) {
    return NextResponse.json({ error: "need chain or class" }, { status: 400 })
  }
  try {
    return NextResponse.json(await resolve(chain, className, true))
  } catch {
    return NextResponse.json({ file: null, line: null, layer: "unknown", verdict: "unique", loose: true })
  }
}

/**
 * Batch — one request for the whole page, so the panel can colour every
 * element and count the layers. The client dedupes by (component|class) first,
 * which collapses a few thousand DOM nodes to a couple of hundred keys.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 })
  }
  try {
    const { items } = (await req.json()) as { items: { chain?: string; class: string }[] }
    const out = await Promise.all(
      (items ?? []).slice(0, 800).map(async (it) => {
        const chain = (it.chain ?? "").split(",").map((n) => n.trim()).filter(Boolean)
        const r = await resolve(chain, it.class ?? "", false)
        return { file: r.file, line: r.line, layer: r.layer, loose: r.loose }
      })
    )
    return NextResponse.json({ results: out })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
