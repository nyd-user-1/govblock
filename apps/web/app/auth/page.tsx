import { redirect } from "next/navigation"
import type { Session } from "next-auth"

import { DocsPage } from "@/components/docs-page"
import { auth, signIn, signInConfigured, signOut } from "@/lib/auth/config"
import { Button } from "@govblock/ui/components/nova/button"

// The account surface. State and buttons — nothing else.
//
// Brendan's ruling, 2026-09-02: no explainers anywhere here. The signed-in page
// used to tell the reader what their user id was and why it began with `u-`,
// which is an answer to a question nobody asked and internals nobody needs. A
// signed-in reader does not get a page about their key; they get sent on.

const title = "Account"
const description = "Sign in so what you connect follows you instead of this browser."

/**
 * Where a signed-in reader goes, both after consent and if they come back here.
 *
 * `/create` "until further notice" — Brendan's words, and the "until" is doing
 * real work: it is a stand-in for an authenticated home page that does not
 * exist yet, not a considered destination. When one exists, this constant is
 * the only thing that changes.
 */
const HOME = "/create"

export const metadata = { title, description }
export const dynamic = "force-dynamic"

function GoogleMark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logos/google.svg" alt="" width={16} height={16} className="size-4" data-not-typeset="" />
}

async function signInWithGoogle() {
  "use server"
  await signIn("google", { redirectTo: HOME })
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
  Configuration: "Sign-in is misconfigured on this deployment. That one is ours.",
  AccessDenied: "Google would not hand over the sign-in — consent declined, or this address is not on the test-user list.",
  Verification: "That sign-in link has already been used, or it expired.",
  OAuthSignin: "We could not start the handoff to Google.",
  OAuthCallback: "Google answered and we could not read the answer.",
  OAuthAccountNotLinked: "That address has already signed in here by a different route.",
  CredentialsSignin: "Those sign-in details were not accepted.",
  SessionRequired: "You need to be signed in to see that.",
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
    <DocsPage
      title={title}
      description={description}
      slug="/auth"
      previous={{ name: "Connectors", url: "/connectors" }}
      next={{ name: "Agents", url: "/agents" }}
    >
      <div className="flex flex-col gap-4 rounded-xl border p-5">
        {user?.id ? (
          <div className="flex flex-wrap items-center gap-3">
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
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">
                  {ERRORS[error] ?? "Sign-in failed."}{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{error}</code>
                </p>
              </div>
            ) : null}

            {signInConfigured ? (
              <form action={signInWithGoogle}>
                <Button type="submit" variant="outline" size="lg">
                  <GoogleMark />
                  Sign in with Google
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign-in is not switched on here yet. That one is ours, not yours.
              </p>
            )}

            <div className="flex items-center gap-2 border-t pt-4 text-sm">
              <span className="font-medium">Email a link instead</span>
              <span className="ml-auto text-xs text-muted-foreground">Not yet</span>
            </div>
          </>
        )}
      </div>
    </DocsPage>
  )
}
