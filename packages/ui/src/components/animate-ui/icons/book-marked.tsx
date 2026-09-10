'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `book-marked`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The ribbon slides down the page and back.

type BookMarkedProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: {},
      animate: {},
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BookMarkedProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M10 2v8l3-3 3 3V2"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function BookMarked(props: BookMarkedProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  BookMarked,
  BookMarked as BookMarkedIcon,
  type BookMarkedProps,
  type BookMarkedProps as BookMarkedIconProps,
};
