// Chrome origin-trial tokens, one <meta http-equiv="origin-trial"> each in
// app/layout.tsx. A token only switches its feature on for the origin it was
// minted for, so every page can carry all of them; pages that never use the
// feature are unaffected. Tokens are public by design — they sit in page
// source — and are renewed at developer.chrome.com/origintrials.
//
// HTMLInCanvas (Brendan, 2026-09-10): the API <ParticleScroll> on /unite draws
// through. The trial runs Chrome 148–154 and ends 2026-10-19; after that the
// effect falls back to plain HTML unless the trial is extended or the feature
// ships.

export const ORIGIN_TRIALS: { origin: string; feature: string; token: string }[] = [
  {
    origin: "http://localhost:3000",
    feature: "HTMLInCanvas",
    token:
      "AuPrHzLOxgYQ9kxuVeYenTn49YKt+jfp5hsKGbuig4JrLjwOPPmhtLekBPuHLQ1ARJjlxK0Vgethx7YC1KMRlwEAAABPeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiSFRNTEluQ2FudmFzIiwiZXhwaXJ5IjoxNzkyNDU0NDAwfQ==",
  },
  {
    // Matches every subdomain, so it covers each project on nysgpt.com.
    origin: "https://nysgpt.com",
    feature: "HTMLInCanvas",
    token:
      "AovRMusAbRv3oRmiVnTpk/wfdyU5IAIlrLAWjVQ223uxmdNEY2o3txib4feOsX0NugI3eMzgAmh8Nn7XrUDCDgwAAABjeyJvcmlnaW4iOiJodHRwczovL255c2dwdC5jb206NDQzIiwiZmVhdHVyZSI6IkhUTUxJbkNhbnZhcyIsImV4cGlyeSI6MTc5MjQ1NDQwMCwiaXNTdWJkb21haW4iOnRydWV9",
  },
]
