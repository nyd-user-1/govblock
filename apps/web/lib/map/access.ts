import { overlay, type OverlayId } from "@/lib/map/overlays"

// Who may switch an overlay on. The same rule the datasets grid reads
// (`lib/workspace/datasets.ts`): Congress and the national boundaries are
// open to everyone, a state's own districts belong to a signed-in reader
// whose jurisdiction it is, and every other state waits on a paid plan.
// The map never hides what is locked — the picker draws it disabled with
// the word that unlocks it.

export type Access =
  | { open: true }
  | { open: false; reason: "Sign in" | "Plan"; why: string }

/**
 * Off the production site the gate stands open (Brendan, 2026-09-10: "i'm
 * the only one on this thing right now"), so every state can be tested
 * without an account. The rule below is what production reads.
 */
const ALL_ACCESS = process.env.NODE_ENV !== "production"

export function accessTo(
  id: OverlayId,
  reader: { signedIn: boolean; home: string }
): Access {
  const o = overlay(id)
  if (!o || o.scope === "public" || ALL_ACCESS) return { open: true }
  if (o.state !== reader.home)
    return {
      open: false,
      reason: "Plan",
      why: "Another state's districts wait on a paid plan",
    }
  if (!reader.signedIn)
    return {
      open: false,
      reason: "Sign in",
      why: "Sign in to draw your own state's districts",
    }
  return { open: true }
}
