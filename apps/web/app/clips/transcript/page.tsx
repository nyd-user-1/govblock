import type { Metadata } from "next"

import { TranscriptPage } from "@/components/clips/transcript"

// /clips/transcript: paste a YouTube link, read what was said, jump to any line.
export const metadata: Metadata = { title: "Transcript", description: "Read any hearing or speech on YouTube line by line, find the moment, and cut it into clips." }

export default function Page() {
  return <TranscriptPage />
}
