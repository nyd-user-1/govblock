import { redirect } from "next/navigation"
import type { Session } from "next-auth"

import { auth, signIn, signInConfigured, signOut } from "@/lib/auth/config"
import { getProfile, INTERESTS } from "@/lib/profile"
import { SignOutButton } from "@/components/sign-out-button"
import { SignStage, type Stage } from "@/components/sign-stage"

// The hero and what sits under it, on four pages (Brendan, 2026-09-14): the
// root, /sign-up, /sign-in and /auth. State and buttons — nothing else
// (Brendan's ruling, 2026-09-02: no explainers anywhere here).
//
// Where a signed-in reader goes: one with a finished profile is sent to
// /home from every page but the root and /auth?signout; one without is sent
// to /sign-up#welcome, where the onboarding lives, from every page but
// /sign-up itself.

const HOME = "/home"
const WELCOME = "/sign-up#welcome"

async function signInWithGoogleToWelcome() {
  "use server"
  await signIn("google", { redirectTo: WELCOME })
}

async function signInWithGoogleHome() {
  "use server"
  await signIn("google", { redirectTo: HOME })
}

async function signOutEverywhere() {
  "use server"
  await signOut({ redirectTo: "/signed-out" })
}

// Auth.js sends its failures to /sign-in because `pages.error` points there.
// Left unread, a `?error=` would return a reader to an unchanged sign-in
// button with no account and no explanation. Each code gets a sentence, and the
// sentence says whose problem it is — that is state, not an explainer.
//
// The one failure that never arrives here: while the consent screen is in
// Testing, Google blocks an address that is not on the test-user list on
// Google's OWN page, and the reader never comes back to us at all.
const ERRORS: Record<string, string> = {
  Configuration: "Sign-in is misconfigured on this deployment. That one is ours.",
  AccessDenied: "Google would not hand over the sign-in — consent declined, or this address is not on the test-user list.",
  Verification: "That sign-in link has already been used, or it expired.",
  LinkExpired: "That sign-in link has expired or has already been used. Request a new one.",
  OAuthSignin: "We could not start the handoff to Google.",
  OAuthCallback: "Google answered and we could not read the answer.",
  OAuthAccountNotLinked: "That address has already signed in here by a different route.",
  CredentialsSignin: "Those sign-in details were not accepted.",
  SessionRequired: "You need to be signed in to see that.",
  EmailSignin: "Email sign-in is not switched on here yet. That one is ours, not yours.",
}

export type SignSearch = Promise<{ error?: string; signout?: string }>

export async function SignPage({ stage, searchParams }: { stage: Stage; searchParams: SignSearch }) {
  const { error, signout } = await searchParams

  // `auth()` throws when AUTH_SECRET is absent, which is a state this page
  // exists to show — so it must not be the thing that 500s it.
  let session: Session | null = null
  try {
    session = await auth()
  } catch {
    session = null
  }
  const user = session?.user

  const profile = user?.id ? await getProfile(user.id) : null
  const welcome = !!user?.id && !profile?.completed_at
  const signingOut = stage === "auth" && signout !== undefined
  if (user?.id && !signingOut) {
    if (welcome && stage !== "sign-up") redirect(WELCOME)
    if (!welcome && stage !== "root") redirect(HOME)
  }

  const google = signInConfigured ? (stage === "sign-in" ? signInWithGoogleHome : signInWithGoogleToWelcome) : undefined

  return (
    <>
      {user?.id && signingOut && (
        <div className="flex justify-center px-6 pt-6">
          <div className="flex w-full max-w-sm flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
            <span className="min-w-0 truncate text-sm">{user.name ?? user.email ?? "Signed in"}</span>
            <form action={signOutEverywhere} className="ml-auto">
              <SignOutButton />
            </form>
          </div>
        </div>
      )}
      {error && (
        <div className="flex justify-center px-6 pt-6">
          <div className="w-full max-w-sm rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              {ERRORS[error] ?? "Sign-in failed."} <code className="rounded bg-muted px-1 py-0.5 text-xs">{error}</code>
            </p>
          </div>
        </div>
      )}
      <SignStage
        stage={stage}
        welcome={welcome && stage === "sign-up"}
        email={user?.email ?? ""}
        saved={welcome && profile ? { name: profile.name ?? "", home_state: profile.home_state, zip: profile.zip, address: profile.address, phone: profile.phone, interests: profile.interests ?? [], lng: profile.lng, lat: profile.lat } : undefined}
        google={google}
        interests={INTERESTS}
      />
    </>
  )
}
