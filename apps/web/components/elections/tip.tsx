"use client"

import * as React from "react"

// A pointer-following tooltip for SVG marks, where the kit's tooltip (which
// anchors to an element) would sit still while the pointer crosses 435 seats.

export function useTip() {
  const [tip, setTip] = React.useState<{ x: number; y: number; body: React.ReactNode } | null>(null)
  const show = React.useCallback((body: React.ReactNode, e: { clientX: number; clientY: number }) => setTip({ x: e.clientX, y: e.clientY, body }), [])
  const hide = React.useCallback(() => setTip(null), [])
  const node = tip ? (
    <div className="pointer-events-none fixed z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background" style={{ left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 10px))" }}>
      {tip.body}
    </div>
  ) : null
  return { show, hide, node }
}
