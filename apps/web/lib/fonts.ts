// Ported from livingston-v3 lib/fonts.ts — Geist for text and headings, Geist Mono for code.
import { Geist_Mono as FontMono, Geist as FontSans } from "next/font/google"

import { cn } from "@govblock/ui/lib/utils"

const fontSans = FontSans({ subsets: ["latin"], variable: "--font-sans" })
const fontHeading = FontSans({ subsets: ["latin"], variable: "--font-heading" })
const fontMono = FontMono({ subsets: ["latin"], variable: "--font-mono", weight: ["400"] })

export const fontVariables = cn(fontSans.variable, fontHeading.variable, fontMono.variable)
