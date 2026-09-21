import type { Metadata } from "next"
import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ProgressGroup } from "@/components/progress-group"
import { LabSwitch } from "@/components/routes/lab-switch"
import BUILD from "@/lib/build-sizes.json"
import { STATE_NAMES } from "@/lib/filters"
import { inLab, PINNED } from "@/lib/lab"
import { adminId } from "@/lib/linkedin/session"
import { ROUTES } from "@/lib/routes.generated"
import { SURFACES } from "@/lib/workspace/path"
import { H2 } from "@/components/typeset"

// /routes (Brendan, 2026-09-11): every URL the app serves, so the ones nobody
// remembers can be found and cut. The list is read off the app directory by
// scripts/routes/generate.mjs; the dynamic routes are opened out here where
// their values are known — the surfaces, the 52 jurisdictions — and
// shown as a pattern with one example where they are not. The notes name
// what a route is when its path does not say: the retired ones, the
// sandboxes, the redirects. (The shadcn template's gallery — /blocks, /view —
// came out the day this page was made.)
//
// Each route has a switch (Brendan, 2026-09-20): on is published, off is the
// lab, where a route stays in development and is kept out of production and
// out of Amplify's output cap (lib/lab.ts). The switches edit the working
// tree, so they show in development, to an admin; everywhere else a route in
// the lab is marked and not linked, since production does not serve it.
//
// Above them, the build's budget (Brendan, 2026-09-20): the last good build's
// output against Amplify's cap, by part, so what a route costs is in view
// beside the switch that would take it out. scripts/routes/build-sizes.mjs
// reads it off the build log after a deploy.
//
// On the docs shell (Brendan, 2026-09-20): its head, its headings and rules,
// and the index of the page's sections in the right rail.

export const metadata: Metadata = { title: "Routes", description: "Every URL the site serves." }

const JURISDICTIONS = Object.keys(STATE_NAMES).filter((c) => c !== "PR").map((c) => c.toLowerCase())

const NOTES: Record<string, string> = {
  "/create": "retired; redirects into the workspace",
  "/agent": "the singular; redirects to /agents",
  "/typeset": "the old typeset; the editor is /workspace/typeset",
  "/workspace/typeset-2": "redirects to /workspace/typeset",
  "/preview/typeset/[name]": "the bill workspace's five pages in a preview frame",
  "/lab/changelog": "the first bill-stream changelog, ported from livingston-v3; /changelog is the second",
  "/lab/unite-2": "sandbox: the ecosystem landing page, with the root's old sections two and three",
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
  ["/docs/changelog-v2, /docs/changelog", "/changelog"],
  ["/docs/bills, /docs/committees, /docs/directory, …", "/bills, /committees, /members, …"],
  ["/anything.md", "/api/markdown/anything"],
]

const REGISTRY = ["directory-search", "district-join", "map-basemap", "map-bounds", "map-palette", "policy-filters", "policy-imagery", "registry", "seals", "state-districts", "state-fips", "use-local"]

/** The values a dynamic segment takes, where they are finite and known. */
function expand(route: string): { hrefs: string[]; more?: string } | null {
  if (route === "/workspace/[surface]") return { hrefs: SURFACES.map((s) => `/workspace/${s}`) }
  const jurisdiction = /^\/(desk|laws|news|state|state\/\[state\]\/charts|docs\/api|docs\/datasets)\/\[state\]$/.exec(route)
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

function Row({ path, note, lab, editable, children }: { path: string; note?: string; lab: boolean; editable: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className={lab ? "text-sm text-muted-foreground" : "text-sm"}>{path}</code>
        {lab && <span className="text-xs font-medium text-amber-600 dark:text-amber-500">lab</span>}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
        {editable && (
          <span className="ml-auto self-center">
            <LabSwitch path={path} lab={lab} disabled={PINNED.has(path) || path.startsWith("/lab/")} />
          </span>
        )}
      </span>
      {children}
    </li>
  )
}

export default async function RoutesPage() {
  const pages = ROUTES.filter((r) => r.kind === "page")
  const apis = ROUTES.filter((r) => r.kind === "api")
  const dev = process.env.NODE_ENV === "development"
  const editable = dev && Boolean(await adminId())
  const labCount = ROUTES.filter((r) => inLab(r.path)).length
  const sections = [...(editable ? ["Build"] : []), "Pages", "API", "Registry files", "Redirects"]
  return (
    <DocsPage
      title="Routes"
      description={`${pages.length} pages, ${apis.length} API routes, ${REGISTRY.length} registry files and the redirects, read off the app directory; ${labCount} in the lab, off production. The dynamic routes are opened out where their values are known.`}
      slug="/routes"
      next={{ name: "ERD", url: "/erd" }}
      rail={<DocsTableOfContents toc={sections.map((title) => ({ title, url: `#${title.toLowerCase().replace(/\s+/g, "-")}`, depth: 2 }))} />}
    >
      {editable && (
        <>
          <H2>Build</H2>
          <p>
            Job {BUILD.job} · {BUILD.commit} · {new Date(BUILD.built).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {BUILD.exact ? "" : " · sizes to the nearest megabyte of disk, a few percent over what Amplify weighs"}
          </p>
          <div data-not-typeset="true" className="mt-4">
            <ProgressGroup parts={BUILD.parts.map((p) => ({ label: p.label, value: p.bytes }))} limit={BUILD.cap} format={(bytes) => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`} />
          </div>
          <hr />
        </>
      )}
      <H2>Pages</H2>
      <ul data-not-typeset="true" className="m-0 mt-4 list-none divide-y p-0">
        {pages.map((r) => {
          const open = expand(r.path)
          const example = EXAMPLES[r.path]
          const isStatic = !r.path.includes("[")
          const lab = inLab(r.path)
          const served = dev || !lab
          return (
            <Row key={r.path} path={r.path} note={NOTES[r.path]} lab={lab} editable={editable}>
              {isStatic && served && (
                <Link href={r.path} className="w-fit text-xs text-primary hover:underline">
                  open
                </Link>
              )}
              {open && served && (
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
      <hr />
      <H2>API</H2>
      <ul data-not-typeset="true" className="m-0 mt-4 list-none divide-y p-0">
        {apis.map((r) => (
          <Row key={r.path} path={r.path} lab={inLab(r.path)} editable={editable} />
        ))}
      </ul>
      <hr />
      <H2>Registry files</H2>
      <p>Static JSON in the public bucket, the @44gov shadcn registry.</p>
      <div data-not-typeset="true" className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
        {REGISTRY.map((n) => (
          <a key={n} href={`/r/${n}.json`} className="text-xs text-primary hover:underline">
            /r/{n}.json
          </a>
        ))}
      </div>
      <hr />
      <H2>Redirects</H2>
      <ul data-not-typeset="true" className="m-0 mt-4 list-none divide-y p-0">
        {REDIRECTS.map(([from, to]) => (
          <li key={from} className="flex flex-wrap gap-x-3 py-2 text-sm">
            <code>{from}</code>
            <span className="text-muted-foreground">to</span>
            <code>{to}</code>
          </li>
        ))}
      </ul>
    </DocsPage>
  )
}
