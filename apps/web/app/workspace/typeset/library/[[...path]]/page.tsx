import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetLibrary } from "@/components/workspace/typeset-library"
import { libraryTitle, readLibraryQuery, resolveLibrary } from "@/lib/xml/library-data"
import { libraryHref } from "@/lib/xml/library"

// /workspace/typeset/library[/<path>] (window 4, 2026-09-14): the corpus as
// libraries a reader browses, filters, sorts and loads from. Families of law,
// jurisdictions, a jurisdiction's codes and sessions, and the Works inside
// one, each opening in the XML view. Paths are in lib/xml/library-data.ts. A
// state reads `us/ny` in the path (2026-09-15); a link still saying `us-ny`
// is sent there.

type Params = Promise<{ path?: string[] }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `${libraryTitle((await params).path ?? [])} · Library` }
}

export default async function TypesetLibraryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const segments = (await params).path ?? []
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") sp.set(key, value)
  if (/^us-[a-z]{2}$/.test(decodeURIComponent(segments[0] ?? ""))) redirect(`${libraryHref(segments.map((s) => decodeURIComponent(s)).join("/"))}${sp.size ? `?${sp}` : ""}`)
  const resolved = await resolveLibrary(segments, { ...readLibraryQuery(sp), offset: 0 })
  if (!resolved) notFound()
  if ("redirect" in resolved) redirect(resolved.redirect)
  return (
    <LocksProvider>
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetLibrary listing={resolved.listing} />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
