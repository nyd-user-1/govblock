import { NextResponse } from "next/server"

import { IMAGE_MAX_BYTES, IMAGE_TYPES, type PostImage } from "@/lib/linkedin/types"
import { adminId, PRIVATE, refused } from "@/lib/linkedin/session"
import { putUpload } from "@/lib/typeset/uploads"

import { imageFolder } from "../posts/input"

// POST multipart/form-data with one `file`: an image for a post, kept in the
// uploads bucket under linkedin/ until the publisher sends it. PNG, JPEG and
// GIF, the kinds LinkedIn takes; the type is decided from the name, never
// taken from the client.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const userId = await adminId()
  if (!userId) return refused()
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 })
  if (file.size > IMAGE_MAX_BYTES) return NextResponse.json({ error: `Images up to ${IMAGE_MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 })
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const type = IMAGE_TYPES[ext]
  if (!type) return NextResponse.json({ error: "PNG, JPEG or GIF only." }, { status: 415 })
  const key = `${imageFolder(userId)}${crypto.randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`
  try {
    await putUpload(key, new Uint8Array(await file.arrayBuffer()), type)
  } catch (error) {
    console.error("linkedin: image upload failed", error)
    return NextResponse.json({ error: "The image could not be stored." }, { status: 502 })
  }
  const image: PostImage = { key, name: file.name, type }
  return NextResponse.json(image, { status: 201, headers: PRIVATE })
}
