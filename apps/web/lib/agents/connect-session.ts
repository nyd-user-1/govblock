// The vault's authorization session, remembered by the browser that opened it.
//
// `GetResourceOauth2Token` is session-scoped and the API says so: `sessionUri`
// "tracks the authorization flow state across multiple requests", and the
// response carries a `sessionStatus`. A call that sends no `sessionUri` opens a
// NEW session every time — proved against the vault before writing this: two
// consecutive calls for the same user id, same provider, same scope, returned
// two different `request_uri`s.
//
// That is why Brendan could complete the Google consent twice and still read
// "Not connected": the check that ran afterwards was asking about a session
// nobody had ever walked through, not about the one he had just finished.
//
// The session lives in the browser beside the claim check, because that is
// where the rest of this connection already lives and it keeps the route
// stateless. It is cleared the moment a token comes back, so a stale session
// cannot outlive the grant it belonged to.

const KEY = (service: string) => `govblock:connect-session:${service}`

export function loadSession(service: string): string | undefined {
  try {
    return window.localStorage.getItem(KEY(service)) ?? undefined
  } catch {
    return undefined
  }
}

export function rememberSession(service: string, sessionUri: string | undefined) {
  try {
    if (sessionUri) window.localStorage.setItem(KEY(service), sessionUri)
  } catch {}
}

export function forgetSession(service: string) {
  try {
    window.localStorage.removeItem(KEY(service))
  } catch {}
}
