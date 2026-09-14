"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"

// The reader's home state, for the places that show Congress beside it: the
// header's flag stack and the rail's Scope. The profile's home and nothing
// else (Brendan, 2026-09-13): a signed-in reader with no home has Congress
// alone, and no state they once browsed stands in for one.

const CONGRESS = "US"

export function useHomeState(): string | null {
  const { reader } = useJurisdiction()
  return reader.home && reader.home !== CONGRESS ? reader.home : null
}
