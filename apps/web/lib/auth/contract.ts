// THE USER-ID CONTRACT — the seam between lane AUTH and lane X.
//
// One string keys everything a reader accumulates: the AgentCore vault's
// `--user-id` for Drive and Calendar grants, Agentic Inbox threads, and tasks.
// This file is the whole rule for that string. It imports nothing, so both the
// Auth.js config (which mints the id) and `identify()` (which hands it out) can
// depend on it without a cycle, and neither can drift from it.
//
// Guarantees, every one of them measured rather than assumed:
//
//   * matches /^[A-Za-z0-9-]{8,64}$/ — because lane X's connect route already
//     enforces exactly that on the value it forwards to the vault. No
//     underscores, no colons.
//   * never empty, and never longer than 128 characters — the vault refuses
//     both. 128 was found by bisection: 128 mints, 129 raises
//     ValidationException. The 64 above is the tighter of the two limits and
//     therefore the one that binds.
//   * stable across sign-outs, so a reader who signs back in finds the
//     connections they made.
//
// What it deliberately does NOT do: prove anything to AgentCore. The vault
// mints a token for any well-formed string, including one belonging to nobody
// — so `identify()` IS the access-control decision for every per-user grant on
// the site. It is small on purpose.

/** The contract's charset and length, in one place so callers can reuse it. */
export const USER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

/**
 * The `u-` prefix, and why it is here rather than passing Google's `sub`
 * through unaltered.
 *
 * A signed-out reader's key is the claim check — a `crypto.randomUUID()`, or a
 * `cc-`/`ephemeral-` fallback when storage is refused. A signed-in reader's key
 * is a Google `sub`, ~21 digits. Those two shapes never collide *in practice*,
 * and "in practice" is doing all the work in that sentence: it rests on Google
 * never changing a format it documents only as "an opaque string".
 *
 * §3's merge has to look at a key and say whether it belongs to a person or to
 * a browser, because that is precisely the question it migrates on. Two
 * characters buy that answer by construction instead of by a heuristic. The
 * lead's ruling — no prefix *schemes* — is about not inventing namespaces
 * later; this is one prefix, decided before the first user exists, and the
 * ruling named this exact shape.
 */
export const USER_ID_PREFIX = "u-"

/**
 * Mint the contract's id from a provider's subject, or return `null` if it
 * cannot be done within the contract.
 *
 * Returning `null` rather than a best-effort string is the point. Google's
 * `sub` is documented as an opaque string of up to 255 characters; today it is
 * ~21 digits and fits, but a subject with a character outside `[A-Za-z0-9-]`,
 * or one long enough to breach 64, must not be quietly reshaped — a reshaped id
 * is a *different* id, and a reader whose id changes silently loses every grant
 * they made. The caller refuses the sign-in instead, visibly.
 */
export function userIdForSubject(subject: string | null | undefined): string | null {
  const id = `${USER_ID_PREFIX}${String(subject ?? "").trim()}`
  return USER_ID_PATTERN.test(id) ? id : null
}

/** Whether an id belongs to a signed-in person rather than to a browser. */
export function isUserId(id: string): boolean {
  return USER_ID_PATTERN.test(id) && id.startsWith(USER_ID_PREFIX)
}
