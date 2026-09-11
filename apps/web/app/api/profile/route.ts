import { NextResponse } from "next/server"

import { auth, update } from "@/lib/auth/config"
import { getProfile, saveProfile, type ProfilePatch } from "@/lib/profile"

// The signed-in reader's profile: what onboarding and the settings page read
// and write. Nobody else's; the session names the reader.

export const dynamic = "force-dynamic"

async function reader() {
  try {
    const session = await auth()
    return session?.user?.id ? session.user : null
  } catch {
    return null
  }
}

export async function GET() {
  const user = await reader()
  if (!user?.id) return NextResponse.json({ profile: null }, { status: 401 })
  return NextResponse.json({ profile: await getProfile(user.id) })
}

export async function POST(request: Request) {
  const user = await reader()
  if (!user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const patch = (await request.json().catch(() => ({}))) as ProfilePatch
  const profile = await saveProfile(user.id, { ...patch, email: patch.email ?? user.email ?? null, name: patch.name ?? user.name ?? null, image: patch.image ?? user.image ?? null })
  if (!profile) return NextResponse.json({ error: "The profile could not be saved." }, { status: 500 })
  // The token learns the home state now, so the next page reads it.
  try {
    await update({ home: profile.home_state } as never)
  } catch (error) {
    console.error("profile: session update failed", error)
  }
  return NextResponse.json({ profile })
}
