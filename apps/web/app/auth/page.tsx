import { redirect } from "next/navigation"
import type { Session } from "next-auth"

import {
  auth,
  devSignIn,
  signIn,
  signInConfigured,
  signOut,
} from "@/lib/auth/config"
import { Button } from "@govblock/ui/components/nova/button"
import { LoginForm } from "@/components/login-form"
import ParticleMark from "@/components/flag-particles"

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

export const metadata = { title, description }
export const dynamic = "force-dynamic"

async function signInWithGoogle() {
  "use server"
  await signIn("google", { redirectTo: HOME })
}

async function signOutEverywhere() {
  "use server"
  await signOut({ redirectTo: "/" })
}

// The email form has nowhere to go in production: no credentials or email
// provider is configured, and pressing Login says so through the error path
// every other failure takes. On the dev server it signs the developer in
// (lib/auth/config.ts, `devSignIn`).
async function signInWithEmail(form: FormData) {
  "use server"
  if (!devSignIn) redirect("/auth?error=EmailSignin")
  await signIn("dev", {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    redirectTo: HOME,
  })
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

  // Signed in: this page has nothing to say. Sending them on is the ruling.
  // The one exception is arriving here deliberately to sign out — without it
  // the header's account affordance would lead somewhere that bounces, and a
  // signed-in reader would have no way out at all.
  if (user?.id && signout === undefined) redirect(HOME)

  return (
    // shadcn's login-02 (Brendan, 2026-09-10): the form in a column of its
    // own on the left, the flag with the whole right half of the screen. The
    // grid stands under the site header rather than over it, so a reader can
    // still get back out.
    <div className="grid min-h-[calc(100svh-var(--header-height))] lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-6">
            {user?.id ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
                <span className="min-w-0 truncate text-sm">
                  {user.name ?? user.email ?? "Signed in"}
                </span>
                <form action={signOutEverywhere} className="ml-auto">
                  <Button type="submit" variant="outline" size="sm">
                    Sign out
                  </Button>
                </form>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Welcome back</h1>
                  <p className="text-balance text-muted-foreground">
                    Login to your GovBlock account
                  </p>
                </div>
                {error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">
                      {ERRORS[error] ?? "Sign-in failed."}{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {error}
                      </code>
                    </p>
                  </div>
                ) : null}
                <LoginForm
                  google={signInWithGoogle}
                  email={signInWithEmail}
                  googleReady={signInConfigured}
                />
                <p className="text-center text-xs text-balance text-muted-foreground">
                  By clicking continue, you agree to our{" "}
                  <a href="#">Terms of Service</a> and{" "}
                  <a href="#">Privacy Policy</a>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {/* The flag, drawn as 45,000 particles that scatter under the pointer
          and spring back (Brendan, 2026-09-09). It had half a card; on
          login-02 it has half the screen, which is the room it wanted. */}
      <div className="relative hidden bg-card lg:block">
        <ParticleMark className="absolute inset-0" />
      </div>
    </div>
  )
}
