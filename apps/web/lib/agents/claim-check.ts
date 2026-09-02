// The claim check: who this browser is, for the purpose of holding a
// connection, and nothing more than that.
//
// govblock is public and has no accounts. A connection has to be keyed to
// *something*, and until there are accounts the only honest something is a
// random id this browser minted for itself. It is a claim check, not a
// password: it says **this browser made that connection** and does not prove
// who anyone is. Anyone holding it holds the connection, which is why it never
// leaves this origin and why clearing site storage revokes access from our
// side. 122 bits of randomness, so it cannot be guessed into — but it is not
// authentication and this file will not pretend it is.
//
// When accounts exist, the session's user id replaces this value and the
// connections keyed to it migrate once. That contract belongs to the auth lane;
// nothing here reaches across for it.

const KEY = "govblock:claim-check"

export function claimCheck(): string {
  try {
    const existing = window.localStorage.getItem(KEY)
    if (existing) return existing
    const minted =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cc-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    window.localStorage.setItem(KEY, minted)
    return minted
  } catch {
    // Storage refused — a private window with cookies blocked, say. The caller
    // gets a value that works for this page and vanishes with it, which is
    // worse than a persistent connection and better than an error.
    return `ephemeral-${Math.random().toString(36).slice(2)}`
  }
}
