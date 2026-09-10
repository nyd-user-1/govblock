"use client"

import dynamic from "next/dynamic"

// The visual inspector (Brendan, 2026-09-10): click any element on the page
// and it names the component and the file and line that renders it, opens it
// in the editor, or copies `path:line`. That last one is the point — most of
// a day's back-and-forth is "which file draws this?", and a screenshot
// cannot answer it.
//
// Loaded `ssr: false` because the package reaches for `window` as it is
// imported, and a "use client" component still runs once on the server.
// The package's own instructions are Vite's (`import.meta.env.VITE_ROOT`);
// here the root comes from an environment variable the dev script exports,
// because Next inlines a NEXT_PUBLIC_ value into the client bundle and
// `import.meta.env` does not exist. In production the package resolves to a
// 254-byte stub that renders null, so the built site pays nothing — the
// guard below is belt and braces for a dev build served anywhere else.

const Trace = dynamic(() => import("@react-trace/kit"), { ssr: false })

const ROOT = process.env.NEXT_PUBLIC_PROJECT_ROOT

export function DevTrace() {
  if (process.env.NODE_ENV === "production" || !ROOT) return null
  return <Trace root={ROOT} editor="vscode" />
}
