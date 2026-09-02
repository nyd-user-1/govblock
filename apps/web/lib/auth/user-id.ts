import "server-only"

import { auth } from "./config"
import { USER_ID_PATTERN, USER_ID_PREFIX, isUserId } from "./contract"

// The published accessor. The rule it enforces lives in `./contract`, which
// imports nothing; this file is the one place that asks Auth.js who the reader
// is. Lane X consumes `identify()` and the re-exports below and nothing else.

export { USER_ID_PATTERN, USER_ID_PREFIX, isUserId, userIdForSubject } from "./contract"

export type Identity =
  /** Signed in. `id` is `u-` followed by the provider's stable subject. */
  | { kind: "user"; id: string }
  /** Signed out. `id` is the per-browser claim check, exactly as before. */
  | { kind: "browser"; id: string }

/**
 * Who to key this reader's data to.
 *
 * The claim check cannot be read on the server — it lives in the browser's
 * localStorage — so callers pass the value the browser sent them, the way
 * `/api/connectors/[service]/connect` already does. A signed-in reader's
 * session wins over whatever claim check the browser also sent.
 *
 * Returns `null` when there is neither a session nor a usable claim check,
 * which is the same 400 the connect route returns today. Nothing about
 * signed-out behaviour changes until somebody actually signs in.
 *
 * **The check that is doing security work here** is the last one. A claim check
 * is safe to take on the caller's word only because it is 122 bits of
 * randomness nobody else can guess. A user id is not: a Google `sub` is stable
 * for a person across every app they sign into, so it is knowable by parties
 * who are not that person. The moment signed-in ids and browser-minted ids
 * share one namespace, a caller who sends someone's user id as their claim
 * check is handed that person's Drive and Calendar grants. So a claim check
 * that is shaped like a user id is refused outright — which is a thing this
 * function can only *do* because `u-` makes the two shapes distinguishable by
 * construction. That is the prefix earning its two characters.
 */
export async function identify(claimCheck?: string | null): Promise<Identity | null> {
  // A missing AUTH_SECRET or an unconfigured provider must not take the
  // signed-out path down with it: every surface that works today keeps working
  // while sign-in is still behind its honest state.
  try {
    const session = await auth()
    const id = session?.user?.id
    if (typeof id === "string" && isUserId(id)) return { kind: "user", id }
  } catch {
    // No session machinery available. Fall through to the browser.
  }

  const browser = String(claimCheck ?? "").trim()
  if (!USER_ID_PATTERN.test(browser)) return null
  if (isUserId(browser)) return null // a user id is not a bearer token; see above
  return { kind: "browser", id: browser }
}
