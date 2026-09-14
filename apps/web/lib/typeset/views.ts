import { FileCodeIcon, FileDiffIcon, FileTextIcon, GitBranchIcon, GitCompareArrowsIcon, GitForkIcon, ListTreeIcon, type LucideIcon } from "lucide-react"

// Typeset's views of one bill (Brendan, 2026-09-12): one route per view under
// /workspace/typeset/bill/{id}, and the numbered switcher in the footer walks
// the five. Typeset is the editor; Outline is the same page with the table of
// contents beside it; Redline is the printings as one scrolling redline, the
// animated compare that used to live at /comp; Git is the bill as a file in a
// repository, the way /workspace/data draws it; Diff is the real diff, each
// version against the one before, unified or split. Fork is Git's own view,
// the reader's editable copy, reached from Git's pencil.
//
// Settled 2026-09-13: they all started as separate products and are features
// of one editor. The bill's actions and its versions are sidebars now, not
// views, so the Activity and Versions routes are gone; their old slugs still
// open the right thing (LEGACY_SLUGS). The old query form (?bill=…&item=…)
// redirects here; see app/workspace/typeset.

export type TypesetView = "typeset" | "outline" | "redline" | "git" | "diff" | "xml" | "fork"

/** The bill /workspace/typeset opens when none is named: H.R. 6644, the 21st
 *  Century ROAD to Housing Act (Brendan, 2026-09-13). */
export const DEFAULT_BILL = 2058568

export type ViewSpec = { key: TypesetView; slug: string; label: string; icon: LucideIcon }

/** The numbered views, 01–06. XML (window 1, 2026-09-14) is the bill drawn from its USLM in the Tiptap reader, beside Typeset until it reaches parity. */
export const TYPESET_VIEWS: readonly ViewSpec[] = [
  { key: "typeset", slug: "", label: "Typeset", icon: FileTextIcon },
  { key: "outline", slug: "outline", label: "Outline", icon: ListTreeIcon },
  { key: "redline", slug: "redline", label: "Redline", icon: GitCompareArrowsIcon },
  { key: "git", slug: "git", label: "Git", icon: GitBranchIcon },
  { key: "diff", slug: "diff", label: "Diff", icon: FileDiffIcon },
  { key: "xml", slug: "xml", label: "XML", icon: FileCodeIcon },
]

/** Git's own views, unnumbered. */
export const GIT_VIEWS: readonly ViewSpec[] = [{ key: "fork", slug: "fork", label: "Fork", icon: GitForkIcon }]

export const ALL_VIEWS: readonly ViewSpec[] = [...TYPESET_VIEWS, ...GIT_VIEWS]

/** Slugs the routes used to have, and the view each opens now. */
export const LEGACY_SLUGS: Record<string, TypesetView> = { comp: "redline", versions: "diff", actions: "typeset" }

export function viewSpec(view: TypesetView): ViewSpec {
  return ALL_VIEWS.find((v) => v.key === view) ?? TYPESET_VIEWS[0]
}

/** The view a path segment names; the bare bill route is Typeset; an old slug is its view; anything else is nothing. */
export function viewFromSlug(slug: string | undefined): TypesetView | null {
  if (!slug) return "typeset"
  return ALL_VIEWS.find((v) => v.slug === slug)?.key ?? LEGACY_SLUGS[slug] ?? null
}

export function typesetHref(billId: number | string, view: TypesetView = "typeset", query?: URLSearchParams | Record<string, string | null | undefined>): string {
  const spec = viewSpec(view)
  const params = query instanceof URLSearchParams ? query : new URLSearchParams()
  if (query && !(query instanceof URLSearchParams)) for (const [k, v] of Object.entries(query)) if (v) params.set(k, v)
  const search = params.toString()
  return `/workspace/typeset/bill/${billId}${spec.slug ? `/${spec.slug}` : ""}${search ? `?${search}` : ""}`
}

/** The old `item` keys, as the views they were. */
export const LEGACY_ITEM_VIEW: Record<string, TypesetView> = {
  article: "typeset",
  docs: "typeset",
  potion: "outline",
  changelog: "typeset",
  diff: "redline",
}

/** Which of Git's tabs (as file-view.tsx names them) a view shows, and back. */
export const GIT_TAB_OF: Record<Extract<TypesetView, "git" | "diff" | "fork">, string> = { git: "text", diff: "changes", fork: "edit" }
export function viewOfGitTab(tab: string | null | undefined): Extract<TypesetView, "git" | "diff" | "fork"> {
  if (tab === "changes" || tab === "history") return "diff"
  if (tab === "edit" || tab === "fork") return "fork"
  return "git"
}
