import { ActivityIcon, FileTextIcon, GitBranchIcon, GitCompareArrowsIcon, GitForkIcon, HistoryIcon, ListTreeIcon, type LucideIcon } from "lucide-react"

// Typeset's views of one bill (Brendan, 2026-09-12): one route per view under
// /workspace/typeset/bill/{id}, and the numbered switcher in the footer walks
// the first five. Typeset is the editor; Outline is the same page in the
// Notion posture with the table of contents beside it; Git is the bill as a
// file in a repository, the way /workspace/data draws it; Diff is the
// printings as one scrolling redline; Activity is what the legislature did to
// the bill, by date. Versions and Fork are Git's own views — the printings as
// commits with what each one changed, and the reader's editable copy — and
// are reached from Git's History button and pencil, as on GitHub.
//
// The old query form (?bill=…&item=…) redirects here; see app/workspace/typeset.

export type TypesetView = "typeset" | "outline" | "git" | "comp" | "actions" | "versions" | "fork"

export type ViewSpec = { key: TypesetView; slug: string; label: string; icon: LucideIcon }

/** The numbered views, 01–05. */
export const TYPESET_VIEWS: readonly ViewSpec[] = [
  { key: "typeset", slug: "", label: "Typeset", icon: FileTextIcon },
  { key: "outline", slug: "outline", label: "Outline", icon: ListTreeIcon },
  { key: "git", slug: "git", label: "Git", icon: GitBranchIcon },
  { key: "comp", slug: "comp", label: "Diff", icon: GitCompareArrowsIcon },
  { key: "actions", slug: "actions", label: "Activity", icon: ActivityIcon },
]

/** Git's own views, unnumbered. */
export const GIT_VIEWS: readonly ViewSpec[] = [
  { key: "versions", slug: "versions", label: "Versions", icon: HistoryIcon },
  { key: "fork", slug: "fork", label: "Fork", icon: GitForkIcon },
]

export const ALL_VIEWS: readonly ViewSpec[] = [...TYPESET_VIEWS, ...GIT_VIEWS]

export function viewSpec(view: TypesetView): ViewSpec {
  return ALL_VIEWS.find((v) => v.key === view) ?? TYPESET_VIEWS[0]
}

/** The view a path segment names; the bare bill route is Typeset; anything else is nothing. */
export function viewFromSlug(slug: string | undefined): TypesetView | null {
  if (!slug) return "typeset"
  return ALL_VIEWS.find((v) => v.slug === slug)?.key ?? null
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
  changelog: "actions",
  diff: "comp",
}

/** Which of Git's tabs (as file-view.tsx names them) a view shows, and back. */
export const GIT_TAB_OF: Record<Extract<TypesetView, "git" | "versions" | "fork">, string> = { git: "text", versions: "changes", fork: "edit" }
export function viewOfGitTab(tab: string | null | undefined): Extract<TypesetView, "git" | "versions" | "fork"> {
  if (tab === "changes" || tab === "history") return "versions"
  if (tab === "edit" || tab === "fork") return "fork"
  return "git"
}
