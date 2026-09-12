import { NextResponse } from "next/server"

import { auth } from "@/lib/auth/config"
import { ALLOWED_TYPES, fileUrl, keyFor, MAX_BYTES, putUpload, typeOf } from "@/lib/typeset/uploads"

// POST multipart/form-data with one `file`: stored in the uploads bucket,
// answered with what the editor's media nodes keep — key, name, size, type
// and the URL it is served from here.
//
// Signed-in readers only, and only the kinds of file a document carries
// (2026-09-12: an audit found the route open to anyone, storing whatever
// content type the client named, and the file route serving it back from
// this origin — a stored-XSS path and an open write into the bucket). The
// type is decided here from the name and the declared type, never taken as
// given.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File))
    return NextResponse.json({ error: "file required" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: `Files up to ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 413 }
    )
  const type = typeOf(file.name, file.type)
  if (!type)
    return NextResponse.json({ error: `That kind of file is not accepted. Images, PDFs, Office documents, CSV and plain text are: ${Object.keys(ALLOWED_TYPES).join(", ")}.` }, { status: 415 })
  const key = keyFor(file.name)
  try {
    await putUpload(key, new Uint8Array(await file.arrayBuffer()), type)
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
    type,
    url: fileUrl(key),
  })
}
