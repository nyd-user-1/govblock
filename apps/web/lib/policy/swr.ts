"use client"

import { useSnapshot } from "@/lib/policy/use-policy"

// The `useSWR(key, fetcher, options)` shape livingston-v3's FEC explorer
// calls, answered from the snapshot instead of the network.
export default function useSWR<T>(key: string | null, _fetcher?: unknown, _options?: unknown) {
  return useSnapshot<T>(key)
}
