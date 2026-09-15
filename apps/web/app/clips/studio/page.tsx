import type { Metadata } from "next"
import dynamic from "next/dynamic"

import { previewFontVariables } from "@/app/preview/fonts"

// /clips/studio: a gallery of video templates, each restyled from the customizer and fed by any GovBlock link.
export const metadata: Metadata = { title: "Studio", description: "Turn any bill, vote, member, committee, party or state into a short video, styled your way." }

const Studio = dynamic(() => import("@/components/clips/studio/studio").then((m) => m.Studio))

export default function StudioPage() {
  return (
    <div className={`${previewFontVariables} contents`}>
      <Studio />
    </div>
  )
}
