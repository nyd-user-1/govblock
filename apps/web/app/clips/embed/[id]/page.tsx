import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { previewFontVariables } from "@/app/preview/fonts"
import { ClipEmbed } from "@/components/clips/embed"
import { getClip } from "@/lib/clips/server"

// /clips/embed/[id]: a posted clip for an <iframe>. Inside a frame the root
// layout drops the site header and footer, so the clip is the whole document.

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const clip = await getClip((await params).id, null)
  return { title: clip?.title ?? "Clip" }
}

export default async function ClipEmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const clip = await getClip((await params).id, null)
  if (!clip || clip.visibility !== "public" || clip.status !== "published") notFound()
  return (
    <div className={`${previewFontVariables} h-svh w-full bg-black`}>
      <ClipEmbed clip={clip} />
    </div>
  )
}
