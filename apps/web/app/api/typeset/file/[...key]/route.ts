import { NextResponse } from "next/server"

import { getUpload, INLINE_TYPES } from "@/lib/typeset/uploads"

// A stored upload, streamed back from the private bucket. Keys carry a UUID,
// so a URL is as good as a capability and the response can be cached hard.

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  const path = key.map(decodeURIComponent).join("/")
  if (!path.startsWith("typeset/") || path.includes(".."))
    return NextResponse.json({ error: "no such file" }, { status: 404 })
  try {
    const object = await getUpload(path)
    const body = object.Body as unknown as ReadableStream | undefined
    if (!body)
      return NextResponse.json({ error: "no such file" }, { status: 404 })
    // The stored type is the one the upload route decided; anything else on
    // file (older uploads) is served as a download, and nothing is sniffed
    // into something a browser would run (2026-09-12).
    const type = object.ContentType ?? "application/octet-stream"
    const inline = INLINE_TYPES.has(type.split(";")[0].trim().toLowerCase())
    return new Response(object.Body?.transformToWebStream(), {
      headers: {
        "content-type": inline ? type : "application/octet-stream",
        ...(object.ContentLength
          ? { "content-length": String(object.ContentLength) }
          : {}),
        "content-disposition": inline ? "inline" : `attachment; filename="${path.split("/").pop()?.replace(/[^A-Za-z0-9._-]/g, "-") ?? "file"}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    const name = (error as { name?: string })?.name
    if (name === "NoSuchKey" || name === "NotFound")
      return NextResponse.json({ error: "no such file" }, { status: 404 })
    console.error("typeset: file read failed", error)
    return NextResponse.json(
      { error: "The file could not be read." },
      { status: 502 }
    )
  }
}
