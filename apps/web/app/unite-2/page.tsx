import type { Metadata } from "next"

import { Unite2 } from "@/components/unite-2"

import "../unite/unite.css"

// /unite-2 (Brendan, 2026-09-11): the ecosystem landing page, its own
// component so /unite is untouched. The slide between the two routes and the
// Red state / Blue state pair come from unite.css, shared.
export const metadata: Metadata = {
  title: "Unite",
  description:
    "A conversation between Americans in every congressional district, on open infrastructure for the record of American government.",
}

export default function Unite2Page() {
  return <Unite2 />
}
