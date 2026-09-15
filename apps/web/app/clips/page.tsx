import type { Metadata } from "next"

import { previewFontVariables } from "@/app/preview/fonts"
import { ClipsApp } from "@/components/clips/clips-app"

// Short vertical video, recorded in the browser and kept in it: the mock of
// the Clips experience, 2026-09-07. See components/clips/store.ts for where
// Cloudflare Stream plugs in once it is wired.
export const metadata: Metadata = { title: "Clips", description: "Short video from the record, and your own." }

export default function ClipsPage() {
  // Studio clips set their own faces.
  return (
    <div className={`${previewFontVariables} contents`}>
      <ClipsApp />
    </div>
  )
}
