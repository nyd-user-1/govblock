import { NextResponse } from "next/server"

import { getUpload } from "@/lib/typeset/uploads"

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
    return new Response(object.Body?.transformToWebStream(), {
      headers: {
        "content-type": object.ContentType ?? "application/octet-stream",
        ...(object.ContentLength
          ? { "content-length": String(object.ContentLength) }
          : {}),
        "cache-control": "public, max-age=31536000, immutable",
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
