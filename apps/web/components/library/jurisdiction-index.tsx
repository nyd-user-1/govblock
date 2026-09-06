import Link from "next/link"

import { STATE_NAMES } from "@/lib/filters"
import { DocsPage, type DocsLink } from "@/components/docs-page"
import { H2 } from "@/components/typeset"

// The components index (ui.shadcn.com/docs/components) with the jurisdictions
// where the components are: a title, a line, "All Jurisdictions", and every
// one of the 52 as a link three across (Brendan, 2026-09-05). The API doc and
// the Bulk Datasets doc are the two pages drawn on it.

// The 52 with a record: Congress, the fifty states and the District. The
// seal set carries Puerto Rico as well, and the record does not.
export const JURISDICTIONS = Object.entries(STATE_NAMES)
  .filter(([code]) => code !== "PR")
  .map(([code, name]) => ({ code, name: code === "US" ? "U.S. Congress" : name }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function JurisdictionIndex({
  title,
  description,
  slug,
  previous,
  next,
  base,
  children,
}: {
  title: string
  description: string
  slug: string
  previous: DocsLink
  next: DocsLink
  /** Where a jurisdiction's own page lives: `/docs/api`, `/docs/datasets`. */
  base: string
  /** Prose above the list. */
  children?: React.ReactNode
}) {
  return (
    <DocsPage title={title} description={description} slug={slug} previous={previous} next={next}>
      {children}
      <H2>All Jurisdictions</H2>
      <div data-not-typeset="true" className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-x-8 lg:gap-x-16 lg:gap-y-6 xl:gap-x-20">
        {JURISDICTIONS.map((j) => (
          <Link key={j.code} href={`${base}/${j.code.toLowerCase()}`} className="inline-flex items-center gap-2 text-lg font-medium underline-offset-4 hover:underline md:text-base">
            {j.name}
          </Link>
        ))}
      </div>
    </DocsPage>
  )
}
