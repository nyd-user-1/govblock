"use server"

import { headers } from "next/headers"

import { originFrom, requestLink, type RequestLinkResult } from "@/lib/auth/email-link"

/** Emails a sign-in link to the form's `email`. Never redirects; the page says "check your email" from the result. */
export async function sendLink(form: FormData): Promise<RequestLinkResult> {
  const origin = originFrom(await headers())
  if (!origin) return { ok: false, reason: "send-failed" }
  return requestLink(String(form.get("email") ?? ""), origin)
}
