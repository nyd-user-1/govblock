import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { STATE_NAMES, stateName } from "@/lib/filters"
import { PUBLISHERS } from "@/lib/laws-publishers"
import { one } from "@/lib/policy/db"
import { LawsBrowser } from "@/components/laws/laws-browser"

// One jurisdiction's standing law, free to read and to search. Brendan,
// 2026-09-04: "you had to pay to see the law? Give me a break."
//
// Outside the (records) group on purpose: that layout puts a documentation
// sidebar down the left, and this page already carries its own rail of laws.
// The page it has to be indistinguishable from is the one /laws has drawn
// since it was built, which is this one, full width.

export const revalidate = 3600

type Props = { params: Promise<{ state: string }> }

const of = (raw: string) => {
  const code = String(raw ?? "").toUpperCase()
  return STATE_NAMES[code] ? code : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = of((await params).state)
  if (!code) return { title: "Laws" }
  const name = stateName(code)
  return {
    title: `Laws of ${name} — govblock`,
    description: `The standing law of ${name} — every section, searchable, free.`,
  }
}

export default async function LawsStatePage({ params }: Props) {
  const code = of((await params).state)
  if (!code) notFound()

  // Whether this jurisdiction is on file at all. A page that cannot say so
  // draws an empty rail and lets a reader conclude the law does not exist.
  const held = await one<{ n: number }>(`select count(*)::int n from "Laws" where state = $1`, [code]).catch(() => null)
  if (!held || Number(held.n) === 0) return <NotHere code={code} />

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-col p-4 md:p-6">
      <LawsBrowser state={code} />
    </div>
  )
}

/**
 * The jurisdiction is real and its law is public; this record does not hold it
 * yet. Say that, and say where it is in the meantime.
 */
function NotHere({ code }: { code: string }) {
  const name = stateName(code)
  const publisher = PUBLISHERS[code]
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Laws of {name}</h1>
      <p className="text-[1.05rem] text-muted-foreground sm:text-base">
        {publisher ? (
          <>
            Not on this record yet. {name}&rsquo;s standing law is published by {publisher.name} at{" "}
            <a href={publisher.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {new URL(publisher.url).host}
            </a>
            {publisher.vendor ? `, through ${publisher.vendor}` : ""}. It is free to read there, and it is not here yet.
          </>
        ) : (
          <>Not on this record yet, and no source has been sized for it. The survey of where every jurisdiction publishes its law is in the repository at <code>apps/web/docs/state-law-sources.md</code>.</>
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        <Link href="/laws" className="text-primary underline-offset-4 hover:underline">
          Every jurisdiction
        </Link>
      </p>
    </div>
  )
}
