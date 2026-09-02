import "server-only"

/**
 * The origin a reader actually typed, not the one the Lambda sees.
 *
 * `new URL(request.url).origin` on Amplify's SSR compute is
 * `https://localhost:3000` — the request reaches the function on an internal
 * URL and only the forwarded headers carry the public host. It fails loudly
 * here, because AgentCore rejects a return URL that is not registered on the
 * workload identity, and that is the good case; anything that merely *built* a
 * link from it would have shipped a localhost link to a reader.
 */
export function publicOrigin(request: Request) {
  const headers = request.headers
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? "https"
    return `${proto}://${host}`
  }
  return new URL(request.url).origin
}
