import NextAuth, { type NextAuthResult } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

// Sign-in, chosen by measurement rather than by stack loyalty.
//
// The evaluation that picked Auth.js over Cognito turned on one finding: the
// AgentCore vault's `--user-id` is an **opaque partition key**, not an identity
// it verifies. It minted a token for a Cognito sub, a Google sub, a bare email
// address, and for a user id that has never existed anywhere. So Cognito's
// `sub` had no privileged fit at the seam it was supposed to win, and what was
// left favoured staying in-app: our own domain owns the redirect URI, the
// session costs no network call, and the whole surface is this directory.
//
// **The consequence that matters more than the choice**: the security boundary
// is THIS FILE, not AgentCore. Whoever `identify()` says the reader is, is who
// the vault hands their Drive and Calendar tokens to. The vault will not
// second-guess it.
//
// Pinned to 5.0.0-beta.32 exactly, no caret. v5 has been in beta for 33
// releases since 2023-10-24; that is a real risk and the containment is that
// everything it touches lives under `lib/auth/**`.

import { getProfile } from "@/lib/profile"

import { USER_ID_PATTERN, userIdForSubject } from "./contract"

const clientId = process.env.AUTH_GOOGLE_ID
const clientSecret = process.env.AUTH_GOOGLE_SECRET

/**
 * Whether sign-in can actually work right now.
 *
 * A dedicated `govblock-signin` OAuth client is deliberately separate from the
 * `GOOGLE_OAUTH_CLIENT_ID` the connectors vault uses. Sharing one would copy a
 * secret that has never left AWS into app config, where a compromise would
 * reach every reader's Drive and Calendar grants and a rotation would break
 * sign-in and every stored grant at the same instant. Splitting costs one extra
 * console client and buys two independent blast radii.
 *
 * Until Brendan's client and `AUTH_SECRET` both exist, the surfaces say so
 * rather than offering a button that fails.
 */
export const signInConfigured = Boolean(clientId && clientSecret && process.env.AUTH_SECRET)

/**
 * The email form signs a developer in on the dev server (Brendan, 2026-09-07:
 * "fix this, at least momentarily so I can login"). Any address, any
 * password, never in production: the provider exists only when NODE_ENV is
 * not "production", so a deployed build has no such door. The subject is the
 * address, lowercased and reduced to the contract's charset, so the same
 * address is the same reader every time.
 */
export const devSignIn = process.env.NODE_ENV !== "production"

const devProvider = Credentials({
  id: "dev",
  name: "Development",
  credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
  authorize: async (credentials) => {
    const email = String(credentials?.email ?? "").trim().toLowerCase()
    if (!email) return null
    const id = `dev-${email.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`.slice(0, 60)
    return { id, email, name: email.split("@")[0] }
  },
})

const nextAuth = NextAuth({
  // With no client there is no provider, so Auth.js renders no sign-in route
  // rather than a broken one. /auth reads `signInConfigured` and says why.
  providers: [...(signInConfigured ? [Google({ clientId, clientSecret })] : []), ...(devSignIn ? [devProvider] : [])],

  // No database. The session is a signed, encrypted cookie the reader carries,
  // which is what keeps SSR free of a network round trip: measured at 1.4 ms
  // cold and 225 B on the wire, against 177 ms and 3,920 B for the Cognito
  // shape this replaced.
  session: { strategy: "jwt" },

  // Our own page, in the site's vocabulary, rather than Auth.js's default.
  pages: { signIn: "/auth", signOut: "/auth", error: "/auth" },

  // Amplify's WEB_COMPUTE Lambda believes it is localhost:3000 and only the
  // forwarded headers carry the real host — the trap `lib/agents/connections/
  // origin.ts` already documents, which would have mangled every callback URL
  // here too. Auth.js reads `x-forwarded-host` when trusted, and `AUTH_URL`
  // overrides the request URL outright. Both are set; belt and braces on the
  // one platform behaviour that has already bitten this codebase once.
  trustHost: true,

  callbacks: {
    // Mint the user id ONCE, here, from the provider's own subject — and refuse
    // to mint one that breaks the published contract rather than letting a
    // malformed id reach the vault. `account` is present only on the sign-in
    // hop; on every later call the id is already on the token.
    //
    // Pinning it ourselves instead of leaning on `token.sub` is deliberate: the
    // contract's stability guarantee is ours to keep, not Auth.js's to change
    // in a beta release.
    async jwt({ token, account, trigger, session }) {
      if (account?.providerAccountId) {
        const id = userIdForSubject(account.providerAccountId)
        if (id) token.uid = id
        else delete token.uid
      }
      // The home state rides the token (Brendan, 2026-09-11): read from the
      // profile at sign-in and whenever the app updates the session after
      // onboarding — once, not on every request. A token from before today
      // has no `home` at all and reads it the first time it is seen.
      const updated = trigger === "update" && session && typeof (session as { home?: unknown }).home !== "undefined"
      if (updated) token.home = (session as { home?: string | null }).home ?? null
      else if (account || typeof token.home === "undefined") {
        token.home = null
        if (typeof token.uid === "string") {
          try {
            token.home = (await getProfile(token.uid))?.home_state ?? null
          } catch {
            token.home = null
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (typeof token.uid === "string" && USER_ID_PATTERN.test(token.uid))
        session.user.id = token.uid
      ;(session.user as { home?: string | null }).home = typeof token.home === "string" ? token.home : null
      return session
    },
  },
})

// These are annotated rather than destructured straight out of `NextAuth()`.
// This is a `node-linker=hoisted` pnpm workspace, so `next-auth` lives in the
// repo-root `node_modules` and TypeScript cannot name the inferred type without
// writing `../../../../node_modules/next-auth/lib` into the declaration — which
// it refuses as non-portable. It compiled in the standalone probe app for
// exactly the reason it does not compile here, and Amplify gates the build on
// type errors, so this would have failed in production and nowhere earlier.
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut
export const auth: NextAuthResult["auth"] = nextAuth.auth
/** Rewrites the session's token from the server — onboarding uses it to set the home state without a fresh sign-in. */
export const update: NextAuthResult["unstable_update"] = nextAuth.unstable_update
