import type { Metadata } from "next"

import { NotFoundCard } from "@/components/stand-in"

// Any address that answers to nothing, and any page that calls notFound() (Brendan, 2026-09-21: "the site has no
// styled not-found page — build it"): the card under the site's header, where the framework's bare "404" stood.
export const metadata: Metadata = { title: "Not found" }

export default function NotFound() {
  return <NotFoundCard />
}
