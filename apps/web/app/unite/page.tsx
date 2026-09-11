import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"

import { Unite } from "@/components/unite"

import "./unite.css"

export const metadata: Metadata = {
  title: "Unite",
  description: "What's wrong with America?",
}

export default async function UnitePage() {
  // Section 2's Code panel shows the component it runs, read from the one
  // vendored copy rather than pasted in twice.
  const code = await readFile(
    path.join(process.cwd(), "components/canvasui/ParticleScroll.tsx"),
    "utf8"
  )
  return <Unite code={code} />
}
