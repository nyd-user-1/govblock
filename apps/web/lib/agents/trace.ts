import "server-only"

import { createHash } from "node:crypto"

// A trail for the connector flow, because there was none.
//
// This app had no server-side observability at all: §4 recorded that Amplify's
// WEB_COMPUTE has no CloudWatch group, and when Brendan's consent failed at
// 4:40 AM there was nothing to read — the whole diagnosis had to be done from
// timestamps and headless re-enactment. The compute role has always been able
// to write to `/aws/amplify/*`; the group does not exist because nothing has
// ever logged. So this is the first line written, and whether the group appears
// after it is itself the experiment.
//
// **The claim check is never logged.** It is the credential: anyone holding it
// holds the connection. Eight hex characters of its SHA-256 are enough to say
// "these two lines are the same reader" and not enough to be that reader.
//
// The same short id goes back in the response so a screenshot of a failed card
// and a log line can be matched without anyone pasting a secret anywhere.

export function readerTrace(claimCheck: string) {
  return createHash("sha256").update(claimCheck).digest("hex").slice(0, 8)
}

export function trace(event: string, fields: Record<string, string | number | boolean | null | undefined>) {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
  // One line, so a CloudWatch filter on `govblock.connectors` finds the flow.
  console.log(`govblock.connectors ${event} ${parts.join(" ")}`)
}
