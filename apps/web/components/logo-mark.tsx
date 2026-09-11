"use client"

import * as React from "react"
import { motion } from "motion/react"

import { animations } from "@govblock/ui/components/animate-ui/icons/blocks"
import {
  getVariants,
  IconWrapper,
  useAnimateIconContext,
  type IconProps,
} from "@govblock/ui/components/animate-ui/icons/icon"

// The mark that moves (Brendan, 2026-09-11): animate-ui's Blocks, its L in
// the flag's blue and the top-right block in its red. Same geometry and same
// hover as the icons in the nav menus — the small block lifts out and settles
// back — with the colours the shared icon cannot carry, since it strokes
// everything in currentColor. The still copies are Icons.logo, public/logo.svg
// and app/icon.svg.

type LogoMarkProps = IconProps<keyof typeof animations>

function IconComponent({ size, ...props }: LogoMarkProps) {
  const { controls } = useAnimateIconContext()
  const variants = getVariants(animations)

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M10 22V7c0-.6-.4-1-1-1H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-.6-.4-1-1-1H2"
        stroke="#0a3161"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z"
        stroke="#b31942"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  )
}

export function LogoMark(props: LogoMarkProps) {
  return <IconWrapper icon={IconComponent} {...props} />
}
