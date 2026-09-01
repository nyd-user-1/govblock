"use client"

import * as React from "react"

import { flagUrl, stateName } from "@/lib/filters"
import { chamberImage, hasSeal, partyColor } from "@/lib/imagery"
import { cn } from "@govblock/ui/lib/utils"

// Ported from livingston-v3 components/policy/imagery.tsx. Where an image
// belongs, an image goes: a chamber gets its seal, a person their portrait, a
// jurisdiction its flag. Plain <img> on purpose — portraits come from forty-odd
// government hosts.

export function FlagChip({
  state,
  className,
  width = 24,
}: {
  state: string
  className?: string
  width?: number
}) {
  const code = (state || "").toUpperCase()
  const height = Math.round((width * 2) / 3)
  return (
    <img
      src={flagUrl(code)}
      alt=""
      aria-hidden="true"
      data-slot="flag-chip"
     
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={cn("m-0 shrink-0 rounded-[4px] object-cover ring-1 ring-foreground/10", className)}
      style={{ width, height }}
    />
  )
}

export function ChamberSeal({
  state,
  chamber,
  className,
  size = 40,
}: {
  state: string
  chamber?: string | null
  className?: string
  size?: number
}) {
  const src = chamberImage(state, chamber)
  const label = [stateName(state), chamber].filter(Boolean).join(" ")
  if (!hasSeal(state, chamber)) {
    return <FlagChip state={state} width={size} className={className} />
  }
  return (
    <span
      data-slot="chamber-seal"
     
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60 select-none",
        className
      )}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" className="m-0 size-full object-contain p-0.5" />
    </span>
  )
}

export function MemberPortrait({
  name,
  photoUrl,
  state,
  chamber,
  className,
  size = 40,
}: {
  name: string | null | undefined
  photoUrl?: string | null
  state?: string | null
  chamber?: string | null
  className?: string
  size?: number
}) {
  const [failed, setFailed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setFailed(false), [photoUrl])
  React.useEffect(() => setMounted(true), [])
  // The remote portrait mounts after hydration so a 403 always reaches
  // onError and the seal stands in — never alt text drawn over the seal.
  const src = !mounted || !photoUrl || failed ? null : photoUrl
  const fallback = chamberImage(state ?? "US", chamber)

  return (
    <span
      data-slot="member-portrait"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted select-none",
        className
      )}
      style={{ width: size, height: size }}
     
    >
      <img src={fallback} alt="" aria-hidden="true" className="absolute inset-0 m-0 size-full object-contain p-1 opacity-70" />
      {src && (
        <img
          src={src}
          alt={name ?? ""}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 m-0 size-full object-cover object-top"
        />
      )}
    </span>
  )
}

export function PartyDot({
  party,
  serving = true,
  className,
}: {
  party: string | null | undefined
  serving?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
     
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ background: partyColor(party, { serving }) }}
    />
  )
}
