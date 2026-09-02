import { NextResponse } from "next/server"

import { getForm, presignForm } from "@/lib/policy/forms-queries"

// One form: the row, and a presigned S3 GET for its PDF.
//
// The URL is minted per request and lives fifteen minutes, so this answer is
// never cached — a cached one would hand a later reader a dead link. The bytes
// do not pass through here: the browser fetches them from S3 with the signature.

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const form = await getForm(Number(id))
    if (!form) return NextResponse.json({ error: `no form ${id}` }, { status: 404 })
    const url = await presignForm(form.s3_key)
    return NextResponse.json(
      {
        ...form,
        pdf: url,
        // Said plainly rather than left for the caller to infer from a null.
        pdfError: url ? null : "The PDF could not be signed for. The file is in S3 and the site could not reach it.",
      },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`policy/forms/${id} failed`, message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
