import type { Metadata } from "next"
import Link from "next/link"

import { BLOCK_TABS } from "@/lib/blocks-tabs"
import { getBlockNames, registryCategories } from "@/lib/blocks"
import { STATE_NAMES } from "@/lib/filters"
import { ROUTES } from "@/lib/routes.generated"
import { BLOCK_DOCS } from "@/lib/workspace/block-docs"
import { ROOMS } from "@/lib/workspace/path"

// /routes (Brendan, 2026-09-11): every URL the app serves, so the ones nobody
// remembers can be found and cut. The list is read off the app directory by
// scripts/routes/generate.mjs; the dynamic routes are opened out here where
// their values are known — the blocks, the rooms, the 52 jurisdictions — and
// shown as a pattern with one example where they are not. The notes name
// what a route is when its path does not say: the shadcn template's pages,
// the retired ones, the redirects.

export const metadata: Metadata = { title: "Routes", description: "Every URL the site serves." }

const JURISDICTIONS = Object.keys(STATE_NAMES).filter((c) => c !== "PR").map((c) => c.toLowerCase())

const NOTES: Record<string, string> = {
  "/blocks": "shadcn template: the blocks gallery",
  "/blocks/[...categories]": "shadcn template: a category or one of our tabs, rendering the seven registry blocks",
  "/view/[style]/[name]": "shadcn template: a registry block alone in an iframe, for the gallery",
  "/create": "retired; redirects into the workspace",
  "/agent": "the singular; redirects to /agents",
  "/typeset": "the old typeset; the editor is /workspace/typeset",
  "/workspace/typeset-2": "redirects to /workspace/typeset",
  "/workspace/calendar-alt": "the calendar block from /blocks/calendar as a page",
  "/preview/typeset/[name]": "the bill workspace's five pages in a preview frame",
  "/docs/changelog-v2": "a second changelog, ported from livingston-v3",
  "/unite": "sandbox: the particle flag and canvasui's particle scroll",
  "/unite-2": "sandbox: the ecosystem landing page",
  "/diff": "redirects to the RAISE Act's compare page",
  "/welcome": "onboarding after sign-in",
  "/routes": "this page",
  "/connectors": "the connectors the server cannot answer for",
}

const REDIRECTS: [string, string][] = [
  ["/newsroom", "/desk"],
  ["/newsroom?state=XX", "/desk/xx"],
  ["/public-laws", "/bills/us"],
  ["/docs/laws", "/bills/us"],
  ["/docs/bills, /docs/committees, /docs/directory, …", "/bills, /committees, /members, …"],
  ["/anything.md", "/api/markdown/anything"],
]

const REGISTRY = ["directory-search", "district-join", "map-basemap", "map-bounds", "map-palette", "policy-filters", "policy-imagery", "registry", "seals", "state-districts", "state-fips", "use-local"]

/** The values a dynamic segment takes, where they are finite and known. */
function expand(route: string): { hrefs: string[]; more?: string } | null {
  if (route === "/view/[style]/[name]") return { hrefs: getBlockNames().map((n) => `/view/new-york-v4/${n}`) }
  if (route === "/blocks/[...categories]") return { hrefs: [...BLOCK_TABS.map((t) => `/blocks/${t.value}`), ...registryCategories.filter((c) => !c.hidden).map((c) => `/blocks/${c.slug}`)] }
  if (route === "/docs/blocks/[slug]") return { hrefs: BLOCK_DOCS.map((d) => `/docs/blocks/${d.slug}`) }
  if (route === "/workspace/[room]") return { hrefs: ROOMS.map((r) => `/workspace/${r}`) }
  const jurisdiction = /^\/(desk|laws|news|docs\/api|docs\/datasets)\/\[state\]$/.exec(route)
  if (jurisdiction) return { hrefs: JURISDICTIONS.map((c) => route.replace("[state]", c)) }
  return null
}

const EXAMPLES: Record<string, string> = {
  "/bills/[id]": "/bills/2015571 (a numeric id) or /bills/ny (a jurisdiction)",
  "/bills/[id]/compare": "/bills/2015571/compare",
  "/committees/[id]": "/committees/hsju00",
  "/members/[id]": "/members/12345",
  "/amendments/[id]": "/amendments/1",
  "/agents/[slug]": "/agents/bill-reader",
  "/calendar/[view]/[date]": "/calendar/month/2026-09-11",
  "/news/[state]/[id]": "/news/ny/1",
  "/roll-call-votes/[session]": "/roll-call-votes/119-1",
  "/roll-call-votes/[session]/[roll]": "/roll-call-votes/119-1/1",
  "/workspace/data/[...path]": "/workspace/data/us/house/2026/bill/hb4499",
  "/workspace/dashboard/[...page]": "/workspace/dashboard/settings/profile",
  "/workspace/blocks/[[...slug]]": "/workspace/blocks",
  "/legislative-subjects/[state]/[slug]": "/legislative-subjects/us/health",
  "/policy-areas/[state]/[slug]": "/policy-areas/us/health",
}

function Row({ path, note, children }: { path: string; note?: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="text-sm">{path}</code>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
      {children}
    </li>
  )
}

export default function RoutesPage() {
  const pages = ROUTES.filter((r) => r.kind === "page")
  const apis = ROUTES.filter((r) => r.kind === "api")
  return (
    <div className="container-wrapper px-4 py-10 md:px-6">
      <div className="container flex max-w-4xl flex-col gap-10 px-0">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Routes</h1>
          <p className="text-muted-foreground">
            {pages.length} pages, {apis.length} API routes, {REGISTRY.length} registry files and the redirects, read off the app directory. The dynamic routes are opened out where their values are known.
          </p>
        </header>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pages</h2>
          <ul className="divide-y">
            {pages.map((r) => {
              const open = expand(r.path)
              const example = EXAMPLES[r.path]
              const isStatic = !r.path.includes("[")
              return (
                <Row key={r.path} path={r.path} note={NOTES[r.path]}>
                  {isStatic && (
                    <Link href={r.path} className="w-fit text-xs text-primary hover:underline">
                      open
                    </Link>
                  )}
                  {open && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                      {open.hrefs.map((h) => (
                        <Link key={h} href={h} className="text-xs text-primary hover:underline">
                          {h}
                        </Link>
                      ))}
                    </div>
                  )}
                  {!open && example && <span className="text-xs text-muted-foreground">e.g. {example}</span>}
                </Row>
              )
            })}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">API</h2>
          <ul className="divide-y">
            {apis.map((r) => (
              <Row key={r.path} path={r.path} />
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Registry files</h2>
          <p className="mb-3 text-sm text-muted-foreground">Static JSON under public/r, the @nysgpt shadcn registry.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {REGISTRY.map((n) => (
              <a key={n} href={`/r/${n}.json`} className="text-xs text-primary hover:underline">
                /r/{n}.json
              </a>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Redirects</h2>
          <ul className="divide-y">
            {REDIRECTS.map(([from, to]) => (
              <li key={from} className="flex flex-wrap gap-x-3 py-2 text-sm">
                <code>{from}</code>
                <span className="text-muted-foreground">to</span>
                <code>{to}</code>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
