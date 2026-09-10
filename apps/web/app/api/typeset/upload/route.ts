import { NextResponse } from "next/server"

import { fileUrl, keyFor, MAX_BYTES, putUpload } from "@/lib/typeset/uploads"

// POST multipart/form-data with one `file`: stored in the uploads bucket,
// answered with what the editor's media nodes keep — key, name, size, type
// and the URL it is served from here.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File))
    return NextResponse.json({ error: "file required" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: `Files up to ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 }
    )
  const key = keyFor(file.name)
  try {
    await putUpload(key, new Uint8Array(await file.arrayBuffer()), file.type)
  } catch (error) {
    console.error("typeset: upload failed", error)
    return NextResponse.json(
      { error: "The file could not be stored." },
      { status: 502 }
    )
  }
  return NextResponse.json({
    key,
    name: file.name,
    size: file.size,
    type: file.type,
    url: fileUrl(key),
  })
}
