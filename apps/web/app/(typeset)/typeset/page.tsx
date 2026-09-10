import { type Metadata } from "next"

// /typeset is a blank page under the site header (Brendan, 2026-09-09:
// "besides that leave it blank"). It had forwarded to /workspace/typeset
// since 2026-09-07; the route's own layout and loading skeleton went with the
// forward, so nothing paints here but the header.
export const metadata: Metadata = { title: "Typeset" }

export default function TypesetPage() {
  return null
}
