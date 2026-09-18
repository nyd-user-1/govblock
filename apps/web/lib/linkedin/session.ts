import "server-only"

import { NextResponse } from "next/server"

import { auth } from "@/lib/auth/config"

// /posts publishes as a real person and a real company, so it answers an
// admin alone (reader_profiles.admin), the way the Stream page does.

export async function adminId(): Promise<string | null> {
  try {
    const session = await auth()
    const user = session?.user as { id?: string; admin?: boolean } | undefined
    return user?.id && user.admin === true ? user.id : null
  } catch {
    return null
  }
}

export const refused = () => NextResponse.json({ error: "Only an admin can schedule LinkedIn posts." }, { status: 403 })

export const PRIVATE = { "cache-control": "private, no-store" }
