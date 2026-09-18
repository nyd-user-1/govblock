import { NextResponse } from "next/server"

import { adminId, refused } from "@/lib/linkedin/session"
import { getUpload } from "@/lib/typeset/uploads"

import { imageFolder } from "../../posts/input"

// GET /api/linkedin/images/<user>/<file>: a post's image back for the
// dialog's thumbnails. Only the admin whose folder it is may read it.

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const userId = await adminId()
  if (!userId) return refused()
  const { key } = await params
  const [owner, file] = key
  if (key.length !== 2 || `linkedin/${owner}/` !== imageFolder(userId) || !/^[\w-]+\.(png|jpg|gif)$/.test(file ?? "")) return NextResponse.json({ error: "not found" }, { status: 404 })
  try {
    const object = await getUpload(`linkedin/${owner}/${file}`)
    return new Response(Buffer.from(await object.Body!.transformToByteArray()), {
      headers: { "content-type": object.ContentType ?? "application/octet-stream", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" },
    })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
