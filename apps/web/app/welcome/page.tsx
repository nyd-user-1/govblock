import type { Metadata } from "next"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"

import { auth } from "@/lib/auth/config"
import { getProfile, INTERESTS, ROLES } from "@/lib/profile"
import { Onboarding } from "@/components/onboarding"
import ParticleMark from "@/components/flag-particles"

// /welcome (Brendan, 2026-09-11): where sign-in lands. A reader with a
// finished profile goes straight on to /home; a new one meets the onboarding
// form, on the login page's two columns.
export const metadata: Metadata = { title: "Welcome", description: "Tell GovBlock where you are and what you follow." }
export const dynamic = "force-dynamic"

export default async function WelcomePage() {
  let session: Session | null = null
  try {
    session = await auth()
  } catch {
    session = null
  }
  const user = session?.user
  if (!user?.id) redirect("/auth")
  const profile = await getProfile(user.id)
  if (profile?.completed_at) redirect("/home")
  const initial = {
    name: profile?.name ?? user.name ?? "",
    email: profile?.email ?? user.email ?? "",
    home_state: profile?.home_state ?? null,
    zip: profile?.zip ?? null,
    address: profile?.address ?? null,
    role: profile?.role ?? null,
    organization: profile?.organization ?? null,
    phone: profile?.phone ?? null,
    interests: profile?.interests ?? [],
    brief_opt_in: profile?.brief_opt_in ?? false,
    bio: profile?.bio ?? null,
  }
  return (
    <div className="grid min-h-[calc(100svh-var(--header-height))] lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold">Welcome to GovBlock</h1>
              <p className="text-balance text-muted-foreground">A minute of questions, once. Your home state opens with Congress the moment you finish.</p>
            </div>
            <Onboarding initial={initial} roles={ROLES} interests={INTERESTS} />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <ParticleMark className="absolute inset-0" />
      </div>
    </div>
  )
}
