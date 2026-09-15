import { NextResponse } from "next/server"

import { viewerOf } from "@/lib/clips/server"
import { readTranscript, storedTranscript, TranscriptError, youtubeId } from "@/lib/clips/youtube"

// A YouTube video's transcript by its link (?url=) or its id (?v=). One
// already kept is anyone's; reading a new one spends a caption read, so it
// takes a signed-in reader.

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const videoId = youtubeId(params.get("v") ?? params.get("url") ?? "")
  if (!videoId) return NextResponse.json({ error: "Paste a YouTube link." }, { status: 400 })
  try {
    const kept = await storedTranscript(videoId)
    if (kept) return NextResponse.json({ transcript: kept })
    if (!(await viewerOf())) return NextResponse.json({ error: "Sign in to read a new video's transcript." }, { status: 401 })
    return NextResponse.json({ transcript: await readTranscript(videoId) })
  } catch (error) {
    if (error instanceof TranscriptError) {
      // Said plainly: from the site's servers YouTube usually refuses a new video's captions.
      return NextResponse.json({ error: error.kind === "none" ? "This video has no captions, so there is no transcript." : "The transcript for this video is not available." }, { status: error.kind === "none" ? 404 : 503 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
