import type { Metadata } from "next"

import { BlocksWorkspace } from "@/components/workspace/blocks-workspace"

// /workspace/blocks — the site's own parts as a catalogue (Brendan,
// 2026-09-07), and /workspace/blocks/{slug} one of them alone on the stage.
export const metadata: Metadata = { title: "Blocks", description: "Every block the site is built from, live, at the size it needs." }

export default async function BlocksPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  return <BlocksWorkspace slug={slug?.[0]} />
}
