"use client"

import * as React from "react"
import { addDays, addMinutes } from "date-fns"

import {
  DRAG_THRESHOLD,
  minutesFromOffset,
  SNAP_MINUTES,
  snapMinutes,
} from "@/lib/calendar/layout"
import type { CalendarEvent } from "@/lib/calendar/types"

import { useLatest } from "./calendar-provider"

// Pointer-capture drag to move (across days) or resize (bottom handle) an
// event block, snapped to 15-minute increments. The block itself is
// translated as a ghost preview, the real update only happens on drop.
export function useEventDrag(
  event: CalendarEvent,
  options: { onCommit: (start: Date, end: Date) => void }
) {
  const [dragging, setDragging] = React.useState(false)
  const [suppressed, setSuppressed] = React.useState(false)
  const [mode, setMode] = React.useState<"move" | "resize">("move")
  const [deltaMinutes, setDeltaMinutes] = React.useState(0)
  const [deltaDays, setDeltaDays] = React.useState(0)
  const [deltaX, setDeltaX] = React.useState(0)

  const state = React.useRef({
    active: false,
    dragging: false,
    mode: "move" as "move" | "resize",
    startX: 0,
    startY: 0,
    columnRects: [] as DOMRect[],
    columnIndex: -1,
    deltaMinutes: 0,
    deltaDays: 0,
  })
  const eventRef = useLatest(event)
  const onCommit = useLatest(options.onCommit)

  const reset = React.useCallback(() => {
    state.current.active = false
    state.current.dragging = false
    state.current.deltaMinutes = 0
    state.current.deltaDays = 0
    setDragging(false)
    setDeltaMinutes(0)
    setDeltaDays(0)
    setDeltaX(0)
  }, [])

  const release = React.useCallback(() => {
    setTimeout(() => setSuppressed(false))
  }, [])

  const onPointerdown = React.useCallback(
    (pointerEvent: React.PointerEvent) => {
      if (pointerEvent.button !== 0) {
        return
      }

      const target = pointerEvent.currentTarget as HTMLElement
      const current = state.current

      current.mode = (pointerEvent.target as HTMLElement).closest(
        "[data-resize-handle]"
      )
        ? "resize"
        : "move"
      setMode(current.mode)
      current.startX = pointerEvent.clientX
      current.startY = pointerEvent.clientY

      const grid = target.closest("[data-week-grid]")
      current.columnRects = grid
        ? [...grid.querySelectorAll("[data-day-column]")].map((column) =>
            column.getBoundingClientRect()
          )
        : []
      current.columnIndex = current.columnRects.findIndex(
        (rect) =>
          pointerEvent.clientX >= rect.left && pointerEvent.clientX < rect.right
      )

      target.setPointerCapture(pointerEvent.pointerId)
      current.active = true
    },
    []
  )

  const onPointermove = React.useCallback(
    (pointerEvent: React.PointerEvent) => {
      const current = state.current
      if (!current.active) {
        return
      }

      const dx = pointerEvent.clientX - current.startX
      const dy = pointerEvent.clientY - current.startY

      if (!current.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return
        }

        current.dragging = true
        setDragging(true)
        setSuppressed(true)
      }

      current.deltaMinutes = snapMinutes(minutesFromOffset(dy))
      setDeltaMinutes(current.deltaMinutes)

      if (current.mode === "move" && current.columnIndex !== -1) {
        const targetIndex = current.columnRects.findIndex(
          (rect) =>
            pointerEvent.clientX >= rect.left &&
            pointerEvent.clientX < rect.right
        )

        if (targetIndex !== -1) {
          current.deltaDays = targetIndex - current.columnIndex
          setDeltaDays(current.deltaDays)
          setDeltaX(
            current.columnRects[targetIndex]!.left -
              current.columnRects[current.columnIndex]!.left
          )
        }
      }
    },
    []
  )

  const onPointerup = React.useCallback(() => {
    const current = state.current

    if (current.active) {
      if (
        current.dragging &&
        (current.deltaMinutes !== 0 || current.deltaDays !== 0)
      ) {
        const source = eventRef.current
        const start = new Date(source.start)
        const end = new Date(source.end)

        if (current.mode === "move") {
          const shift = (date: Date) =>
            addMinutes(addDays(date, current.deltaDays), current.deltaMinutes)

          onCommit.current(shift(start), shift(end))
        } else {
          const resized = addMinutes(end, current.deltaMinutes)
          onCommit.current(
            start,
            resized > addMinutes(start, SNAP_MINUTES)
              ? resized
              : addMinutes(start, SNAP_MINUTES)
          )
        }
      }

      reset()
    }

    release()
  }, [reset, release, eventRef, onCommit])

  const onPointercancel = React.useCallback(() => {
    reset()
    release()
  }, [reset, release])

  React.useEffect(() => {
    function onKeydown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && state.current.dragging) {
        reset()
      }
    }

    function onBlur() {
      if (state.current.active) {
        reset()
        release()
      }
    }

    window.addEventListener("keydown", onKeydown)
    window.addEventListener("blur", onBlur)

    return () => {
      window.removeEventListener("keydown", onKeydown)
      window.removeEventListener("blur", onBlur)
    }
  }, [reset, release])

  return {
    dragging,
    suppressed,
    mode,
    deltaMinutes,
    deltaDays,
    deltaX,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
  }
}
