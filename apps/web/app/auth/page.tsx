import { redirect } from "next/navigation"
import type { Session } from "next-auth"

import { auth, signIn, signInConfigured, signOut } from "@/lib/auth/config"
import { getProfile, INTERESTS } from "@/lib/profile"
import { SignOutButton } from "@/components/sign-out-button"
import { SignStage } from "@/components/sign-stage"

// The account surface. State and buttons — nothing else.
//
// Brendan's ruling, 2026-09-02: no explainers anywhere here. The signed-in page
// used to tell the reader what their user id was and why it began with `u-`,
// which is an answer to a question nobody asked and internals nobody needs. A
// signed-in reader does not get a page about their key; they get sent on.

const title = "Account"
const description =
  "Sign in so what you connect follows you instead of this browser."

/**
 * Where a signed-in reader goes, both after consent and if they come back here.
 *
 * `/workspace/data` was a stand-in for an authenticated home page that did not
 * exist yet. It does now (Brendan, 2026-09-10: "it should have routed me to
 * /home"), and this constant is the only thing that had to change.
 */
const HOME = "/home"
/** Where sign-in lands (2026-09-13): back here, at the welcome step, which a reader with a finished profile is sent past to /home. */
const WELCOME = "/auth#welcome"

export const metadata = { title, description }
export const dynamic = "force-dynamic"

async function signInWithGoogle() {
  "use server"
  await signIn("google", { redirectTo: WELCOME })
}

async function signOutEverywhere() {
  "use server"
  await signOut({ redirectTo: "/" })
}

// Auth.js sends its failures back here because `pages.error` points at this
// page. Left unread, a `?error=` would return a reader to an unchanged sign-in
// button with no account and no explanation. Each code gets a sentence, and the
// sentence says whose problem it is — that is state, not an explainer.
//
// The one failure that never arrives here: while the consent screen is in
// Testing, Google blocks an address that is not on the test-user list on
// Google's OWN page, and the reader never comes back to us at all.
const ERRORS: Record<string, string> = {
  Configuration:
    "Sign-in is misconfigured on this deployment. That one is ours.",
  AccessDenied:
    "Google would not hand over the sign-in — consent declined, or this address is not on the test-user list.",
  Verification: "That sign-in link has already been used, or it expired.",
  LinkExpired: "That sign-in link has expired or has already been used. Request a new one.",
  OAuthSignin: "We could not start the handoff to Google.",
  OAuthCallback: "Google answered and we could not read the answer.",
  OAuthAccountNotLinked:
    "That address has already signed in here by a different route.",
  CredentialsSignin: "Those sign-in details were not accepted.",
  SessionRequired: "You need to be signed in to see that.",
  EmailSignin:
    "Email sign-in is not switched on here yet. That one is ours, not yours.",
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signout?: string }>
}) {
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

  // Signed in with a finished profile: this page has nothing to say, and
  // sending them on is the ruling. The one exception is arriving here
  // deliberately to sign out — without it the header's account affordance
  // would lead somewhere that bounces, and a signed-in reader would have no
  // way out at all. A signed-in reader with no finished profile meets the
  // welcome steps on this page (2026-09-13), where the magic link lands them.
  const profile = user?.id ? await getProfile(user.id) : null
  const welcome = !!user?.id && !profile?.completed_at
  if (user?.id && signout === undefined && !welcome) redirect(HOME)

  return (
    <>
      {user?.id && signout !== undefined && (
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
        welcome={welcome}
        email={user?.email ?? ""}
        saved={welcome && profile ? { name: profile.name ?? "", home_state: profile.home_state, zip: profile.zip, address: profile.address, phone: profile.phone, interests: profile.interests ?? [], lng: profile.lng, lat: profile.lat } : undefined}
        google={signInConfigured ? signInWithGoogle : undefined}
        interests={INTERESTS}
      />
    </>
  )
}
