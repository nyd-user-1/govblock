import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"

import { Unite } from "@/components/unite"

import "../unite/unite.css"

// A second /unite (Brendan, 2026-09-11) — the same page for now, so the two
// can slide into each other; it forks from components/unite.tsx when it needs
// to differ.
export const metadata: Metadata = {
  title: "Unite 2",
  description: "What's wrong with America?",
}

export default async function Unite2Page() {
  const code = await readFile(
    path.join(process.cwd(), "components/canvasui/ParticleScroll.tsx"),
    "utf8"
  )
  return <Unite code={code} />
}
