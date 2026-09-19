"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { AArrowDown, AArrowUp, AlignJustify } from "lucide-react"

import { DEFAULTS, FONTS, setReaderSettings, SIZES, SPACINGS, useReaderSettings, type ReaderSettings } from "@/lib/reader-settings"
import { cn } from "@govblock/ui/lib/utils"

// The laws reader's Settings, the right rail's second view (Brendan,
// 2026-09-19, after esv.org's Text Settings): the view, the type, the theme,
// and what the text shows. Light, dark and auto are the site's own theme;
// sepia is the light theme with the reader's paper under it.

const THEMES: { value: ReaderSettings["theme"]; label: string; swatch: string }[] = [
  { value: "light", label: "Light", swatch: "bg-white text-neutral-900" },
  { value: "sepia", label: "Sepia", swatch: "bg-[#f3ead7] text-[#3b2f1e]" },
  { value: "dark", label: "Dark", swatch: "bg-neutral-900 text-neutral-100" },
  { value: "auto", label: "Auto", swatch: "bg-muted text-foreground" },
]

const SWITCHES: { key: keyof ReaderSettings; label: string }[] = [
  { key: "headings", label: "Headings" },
  { key: "numbers", label: "Section numbers" },
  { key: "crossrefs", label: "Cross-references" },
  { key: "notes", label: "Notes as markers" },
  { key: "justify", label: "Justified text" },
]

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="h-6 text-xs font-medium text-muted-foreground">{children}</p>
}

export function ReaderSettingsPanel() {
  const s = useReaderSettings()
  const { setTheme } = useTheme()
  const button = "flex h-9 flex-1 items-center justify-center rounded-md border bg-background text-sm transition-colors hover:bg-muted disabled:opacity-40"
  return (
    <div className="flex flex-col gap-5 p-4 pt-0 text-sm">
      <div className="flex flex-col gap-2">
        <Heading>View</Heading>
        <div className="flex rounded-md bg-muted p-0.5 text-xs">
          {(["reading", "code"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={s.view === v}
              onClick={() => setReaderSettings({ view: v })}
              className={cn("flex-1 rounded-[5px] px-2 py-1.5 font-medium text-muted-foreground", s.view === v && "bg-background text-foreground shadow-xs")}
            >
              {v === "reading" ? "Reading" : "Code"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Heading>Text</Heading>
        <div className="flex gap-2 [&_svg]:size-4">
          <button type="button" aria-label="Smaller text" disabled={s.size <= 0} onClick={() => setReaderSettings({ size: s.size - 1 })} className={button}>
            <AArrowDown />
          </button>
          <button type="button" aria-label="Larger text" disabled={s.size >= SIZES.length - 1} onClick={() => setReaderSettings({ size: s.size + 1 })} className={button}>
            <AArrowUp />
          </button>
          <button
            type="button"
            aria-label={`Line spacing ${s.spacing + 1} of ${SPACINGS.length}`}
            onClick={() => setReaderSettings({ spacing: (s.spacing + 1) % SPACINGS.length })}
            className={button}
          >
            <AlignJustify />
            <span className="ml-1 text-xs tabular-nums text-muted-foreground">{s.spacing + 1}</span>
          </button>
        </div>
        <select
          aria-label="Font"
          value={s.font}
          onChange={(e) => setReaderSettings({ font: e.target.value as ReaderSettings["font"] })}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          style={{ fontFamily: FONTS[s.font] }}
        >
          <option value="serif">Serif</option>
          <option value="sans">Sans</option>
          <option value="mono">Mono</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Heading>Theme</Heading>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={s.theme === t.value}
              onClick={() => {
                setReaderSettings({ theme: t.value })
                setTheme(t.value === "auto" ? "system" : t.value === "dark" ? "dark" : "light")
              }}
              className={cn("flex h-12 items-end justify-center rounded-md border pb-1 text-[0.7rem]", t.swatch, s.theme === t.value && "ring-2 ring-ring ring-offset-1 ring-offset-background")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Heading>Show</Heading>
        {SWITCHES.map((sw) => (
          <label key={sw.key} className="flex items-center justify-between rounded-md px-1 py-1.5 text-[0.8rem] hover:bg-muted">
            {sw.label}
            <input type="checkbox" checked={Boolean(s[sw.key])} onChange={(e) => setReaderSettings({ [sw.key]: e.target.checked })} className="size-4 accent-foreground" />
          </label>
        ))}
      </div>

      <button type="button" onClick={() => setReaderSettings(DEFAULTS)} className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Reset
      </button>
    </div>
  )
}
