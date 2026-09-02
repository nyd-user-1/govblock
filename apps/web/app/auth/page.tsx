import Link from "next/link"
import type { Session } from "next-auth"

import { DocsPage } from "@/components/docs-page"
import { auth, signIn, signInConfigured, signOut } from "@/lib/auth/config"
import { USER_ID_PREFIX } from "@/lib/auth/contract"
import { Button } from "@govblock/ui/components/nova/button"

// The account surface. Two states and no third: signed in, or not — and when
// sign-in is not wired up yet, the page says which piece is missing instead of
// offering a button that fails. That is the house rule Brendan set: a surface
// says what WE lack, it never hides unfinished work.

const title = "Account"
const description =
  "Sign in so what you connect and what your agents do follows you, instead of following this browser."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

function GoogleMark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logos/google.svg" alt="" width={16} height={16} className="size-4" data-not-typeset="" />
}

async function signInWithGoogle() {
  "use server"
  await signIn("google", { redirectTo: "/auth" })
}

async function signOutEverywhere() {
  "use server"
  await signOut({ redirectTo: "/auth" })
}

// Auth.js sends its failures back here, because `pages.error` points at this
// page. Left unread, the `?error=` would return a reader to an unchanged
// sign-in button with no account and no explanation — the worst of both, and
// the exact shape of failure this project's creed calls dishonest. So each code
// gets a sentence, and the sentence says whose problem it is.
//
// The one failure that does NOT arrive here is worth naming: while the consent
// screen is in Testing, Google blocks an address that is not on the test-user
// list **on Google's own page**, and the reader never comes back to us at all.
// Nothing this file can render will catch that one.
const ERRORS: Record<string, string> = {
  Configuration:
    "This deployment's sign-in configuration is incomplete or wrong — that is ours to fix, not something you can retry into working.",
  AccessDenied:
    "Google would not hand over the sign-in. That is usually consent being declined, or this address not being on the test-user list while the consent screen is still in Testing.",
  Verification: "That sign-in link has already been used, or it has expired.",
  OAuthSignin: "We could not start the handoff to Google.",
  OAuthCallback: "Google answered, but we could not read the answer.",
  OAuthAccountNotLinked:
    "That email address has already signed in here by a different route, and linking the two is not built yet.",
  CredentialsSignin: "Those sign-in details were not accepted.",
  SessionRequired: "You need to be signed in to see that.",
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  // `auth()` can throw when AUTH_SECRET is absent, which is exactly the state
  // this page exists to explain — so it must not be the thing that 500s it.
  // `auth` is overloaded (server component / middleware / route handler), so
  // `ReturnType<typeof auth>` resolves to the middleware overload. Name the
  // session type outright.
  let session: Session | null = null
  try {
    session = await auth()
  } catch {
    session = null
  }

  const user = session?.user
  const signedIn = Boolean(user?.id)

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/auth"
      previous={{ name: "Connectors", url: "/connectors" }}
      next={{ name: "Agents", url: "/agents" }}
    >
      {signedIn ? (
        <div className="flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex items-center gap-3">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                width={40}
                height={40}
                data-not-typeset=""
                className="size-10 shrink-0 rounded-full"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{user?.name ?? "Signed in"}</span>
              <span className="truncate text-sm text-muted-foreground">{user?.email}</span>
            </span>
            <form action={signOutEverywhere} className="ml-auto">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
          <p className="text-sm text-muted-foreground">
            Your key on this site is{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{user?.id}</code> — the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{USER_ID_PREFIX}</code> marks it
            as a person rather than a browser. It is what a connector grant is filed under, and it
            does not change when you sign out and back in.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border p-5">
          {error ? (
            <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Sign-in did not complete</p>
              <p className="text-sm text-muted-foreground">
                {ERRORS[error] ?? "Sign-in failed, and Google did not say why in a way we recognise."}{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{error}</code>
              </p>
            </div>
          ) : null}
          {signInConfigured ? (
            <>
              <form action={signInWithGoogle}>
                {/* Outline, not the primary fill. Google's mark is a
                    four-colour glyph meant for a neutral ground; on our blue it
                    fights the fill and stops looking like Google's, which is
                    the one thing a sign-in button has to look like. */}
                <Button type="submit" variant="outline" size="lg">
                  <GoogleMark />
                  Sign in with Google
                </Button>
              </form>
              <p className="text-sm text-muted-foreground">
                govblock asks Google for your name, email address and picture — the{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">openid email profile</code>{" "}
                scopes, all of them non-sensitive. It does not ask for your mail, and the sign-in
                credential is a different OAuth client from the one a Drive or Calendar connection
                uses, so revoking one does not touch the other.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Sign-in is not switched on here yet.</p>
              <p className="text-sm text-muted-foreground">
                What is missing is ours, not yours: this deployment does not have the{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">govblock-signin</code> Google
                client and session secret in its environment. Until it does, this page shows you
                the state rather than a button that would fail on the way to Google.
              </p>
            </>
          )}
          <div className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Email a link instead</span>
            <span className="ml-auto text-xs">Not yet</span>
          </div>
          <p className="text-sm text-muted-foreground">
            A sign-in link to your inbox is the second way in, and it is deliberately waiting on the
            same verified-address machinery the agents use to email you an answer — one
            double-opt-in mechanism serving both, rather than two.
          </p>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold tracking-tight">What signing in changes</h2>
      <p>
        Today a connection you make on <Link href="/connectors">Connectors</Link> is filed under a
        token this browser minted for itself — a claim check. It says <em>this browser made that
        connection</em> and nothing more: it does not prove who you are, anyone with your browser
        has it, and clearing site storage destroys it. Signed in, the same connections file under
        you, and they are still there in a different browser.
      </p>
      <p>
        Signed out, nothing changes. The claim check stays exactly as it is, and every surface that
        works without an account keeps working without one.
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">
        What signing in does not change yet
      </h2>
      <p>
        Connections and inbox threads you have already made in this browser do <strong>not</strong>{" "}
        move onto your account on their own, and this page will not quietly adopt them. The offer to
        carry this browser&apos;s history over is a visible, one-time choice, and it is not built
        yet — so for now a signed-in reader starts empty and the browser&apos;s own history is still
        there when they sign out.
      </p>
    </DocsPage>
  )
}
