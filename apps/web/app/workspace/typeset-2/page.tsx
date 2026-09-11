import { redirect } from "next/navigation"

// /workspace/typeset-2 grew into the Typeset editor and moved to
// /workspace/typeset (Brendan, 2026-09-11); the old address still answers.
export default async function WorkspaceTypeset2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) for (const one of Array.isArray(v) ? v : v == null ? [] : [v]) qs.append(k, one)
  const q = qs.toString()
  redirect(`/workspace/typeset${q ? `?${q}` : ""}`)
}
