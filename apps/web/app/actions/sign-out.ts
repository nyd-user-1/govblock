"use server"

import { signOut } from "@/lib/auth/config"

/**
 * Signs the reader out and lands them on the root (Brendan, 2026-09-22): one click from the account menu, no stop at
 * /auth on the way. It landed on /signed-out from 2026-09-14 until then — a page that said the session was closed
 * while the header above it still wore the avatar.
 */
export async function signOutToLanding() {
  await signOut({ redirectTo: "/" })
}
