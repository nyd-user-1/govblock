// The localStorage key the jurisdiction memory lives under. A plain module on
// purpose: jurisdiction.tsx is "use client", and a value imported from a
// client module into a server module (the layout's pre-paint script) arrives
// as a client-reference proxy, not the string — it stringified as `undefined`
// and the anti-flash script read the wrong key. Same family as BLOCK_TABS.
export const JURISDICTION_KEY = "govblock:jurisdiction"
