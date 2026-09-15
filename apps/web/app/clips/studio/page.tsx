import type { Metadata } from "next"
import dynamic from "next/dynamic"

// /clips/studio: build a video template from scenes and knobs, fed by a bill or a roll call's link.
export const metadata: Metadata = { title: "Studio", description: "Build a video template from scenes and knobs, and feed it any bill or roll call." }

const Studio = dynamic(() => import("@/components/clips/studio/studio").then((m) => m.Studio))

export default function StudioPage() {
  return <Studio />
}
