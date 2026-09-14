"use server"

import { signOut } from "@/lib/auth/config"

/** Signs the reader out and lands them on /signed-out (Brendan, 2026-09-14): one click from the account menu, no stop at /auth on the way. */
export async function signOutToLanding() {
  await signOut({ redirectTo: "/signed-out" })
}
