import { type Metadata } from "next"

import { BLOCKS_DESCRIPTION, BLOCKS_TITLE } from "@/components/blocks-shell"

// Ported from livingston-v3 app/(app)/blocks/layout.tsx, and since 2026-09-02 a
// pass-through: the hero, the tab strip and the container moved to
// `components/blocks-shell.tsx` so that `/blocks/intelligence` can render the
// inbox frame alone. Every other page under this route renders `BlocksShell`
// and looks exactly as it did. One route tree, no route group — the catch-all's
// `generateStaticParams` already emits `intelligence`, and the route keeps its
// name.

export const metadata: Metadata = { title: BLOCKS_TITLE, description: BLOCKS_DESCRIPTION }

export default function BlocksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
