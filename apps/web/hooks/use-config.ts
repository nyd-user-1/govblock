"use client"

import { useLocal } from "@/lib/policy/use-local"

// v3 hooks/use-config.ts kept this in a jotai storage atom; the same shape
// on the per-browser hook the rest of the app uses.
type Config = {
  style: "new-york-v4"
  packageManager: "npm" | "yarn" | "pnpm" | "bun"
  installationType: "cli" | "manual"
}

export function useConfig() {
  return useLocal<Config>("config", { style: "new-york-v4", packageManager: "pnpm", installationType: "cli" })
}
