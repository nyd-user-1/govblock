import type { Metadata } from "next"

import { Designer } from "@/components/create/designer"

// /create — livingston-v3's designer, with the whole site on its stage: the
// cards in three versions, and every block, each in the dashboard's shell,
// each reading the rail's scope. The data arrives in the browser from
// /api/policy under whatever jurisdiction and filters the rail wrote into the
// URL, so the page itself is static and shared by everyone.
export const metadata: Metadata = { title: "New Project", description: "Compose a view — a jurisdiction, a scope, a design, a block — save it as a preset, and take the code." }

export default function CreatePage() {
  return <Designer />
}
