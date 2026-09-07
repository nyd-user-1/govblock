import "server-only"

import { auth } from "@/lib/auth/config"

/** The signed-in reader, or null. `auth()` throws without AUTH_SECRET; that is a null here, not a 500. */
export async function who() {
  try {
    const session = await auth()
    const user = session?.user
    return user?.id ? { id: user.id, email: user.email ?? null, name: user.name ?? null } : null
  } catch {
    return null
  }
}
