import { NextResponse } from "next/server"
import { Resend } from "resend"

// The filled form, emailed. From livingston's api/send-application.ts.
//
//   POST { to, cc?, county?, code, filename, pdf: base64 }
//   → { ok, id, to }            the Resend message id is the proof it went
//   → 503 { error }             when RESEND_API_KEY is not set
//
// Two uses, and the difference matters: to the applicant, who signs it and
// files it; or to a county office on their behalf, always with a copy to
// them, so they hold a record of what was sent in their name. Most New York
// districts do not accept an emailed application as a filing — this puts the
// paperwork in front of a caseworker, it does not file it, and the body says
// so. One attachment, well inside the host's thirty seconds.

export const dynamic = "force-dynamic"
export const maxDuration = 30

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PDF = 10 * 1024 * 1024

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Email is not configured" }, { status: 503 })

  let body: { to?: unknown; cc?: unknown; county?: unknown; code?: unknown; filename?: unknown; pdf?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const to = String(body.to ?? "").trim()
  if (!EMAIL.test(to)) return NextResponse.json({ error: "That email address does not look right." }, { status: 400 })
  const cc = typeof body.cc === "string" && EMAIL.test(body.cc.trim()) ? body.cc.trim() : undefined
  const code = String(body.code ?? "form").replace(/[^A-Za-z0-9-]/g, "") || "form"
  const filename = String(body.filename ?? `${code}.pdf`).replace(/[^A-Za-z0-9._-]/g, "") || `${code}.pdf`
  const county = typeof body.county === "string" ? body.county.trim().slice(0, 40) : ""

  let pdf: Buffer
  try {
    pdf = Buffer.from(String(body.pdf ?? ""), "base64")
  } catch {
    return NextResponse.json({ error: "Could not read the file." }, { status: 400 })
  }
  if (!pdf.length || pdf.length > MAX_PDF || pdf.subarray(0, 4).toString() !== "%PDF") return NextResponse.json({ error: "That file does not look like a PDF." }, { status: 400 })

  const onBehalf = Boolean(cc)
  const html = onBehalf
    ? [
        `<p>Attached is a <strong>${code}</strong> application draft${county ? ` for ${county} County` : ""}, prepared with the applicant and sent at their request.</p>`,
        `<p>The applicant is copied on this message.</p>`,
        `<p style="color:#666;font-size:12px">Prepared with GovBlock. If a signed original or a different filing method is required, please reply so the applicant can complete it.</p>`,
      ].join("")
    : [
        `<p>Your <strong>${code}</strong> draft is attached.</p>`,
        `<p>It was filled in from the answers given in the conversation. <strong>Read it before you file it</strong>: check every line, and fill in anything that was left blank.</p>`,
        `<p>Nothing has been submitted to any agency. To file it, sign it and take or mail it to your county Department of Social Services, or apply online at <a href="https://mybenefits.ny.gov">mybenefits.ny.gov</a>.</p>`,
        `<p style="color:#666;font-size:12px">You always have the right to apply, whatever any screening says.</p>`,
      ].join("")

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "GovBlock <onboarding@resend.dev>",
    to: [to],
    cc: cc ? [cc] : undefined,
    subject: onBehalf ? `${code} application${county ? ` — ${county} County` : ""}` : `Your ${code} draft`,
    html,
    attachments: [{ filename, content: pdf.toString("base64") }],
  })

  if (error || !data) return NextResponse.json({ error: error?.message ?? "The email provider refused it." }, { status: 502 })
  return NextResponse.json({ ok: true, id: data.id, to, cc: cc ?? null })
}
