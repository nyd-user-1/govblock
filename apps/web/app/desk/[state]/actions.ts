"use server"

import { revalidatePath } from "next/cache"

/** Drops the desk's cached page so the next render reads the tables again (the refresh icons, Brendan, 2026-09-11). */
export async function refreshDesk(state: string) {
  revalidatePath(`/desk/${state.toLowerCase()}`)
}
