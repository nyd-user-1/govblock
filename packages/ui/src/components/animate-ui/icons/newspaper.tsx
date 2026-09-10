'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `newspaper`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The headline block blinks and the two lines write in.

type NewspaperProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.15 } },
    },
    path2: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
    path3: {
      initial: {},
      animate: {},
    },
    rect: {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.4, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: NewspaperProps) {
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
        d="M15 18h-5"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M18 14h-8"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.rect
        width={8}
        height={4}
        x={10}
        y={6}
        rx={1}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Newspaper(props: NewspaperProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Newspaper,
  Newspaper as NewspaperIcon,
  type NewspaperProps,
  type NewspaperProps as NewspaperIconProps,
};
