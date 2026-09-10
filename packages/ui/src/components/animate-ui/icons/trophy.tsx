'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `trophy`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The cup lifts and the base stays put.

type TrophyProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path3: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path4: {
      initial: {},
      animate: {},
    },
    path5: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path6: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: TrophyProps) {
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
        d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 22h16"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"
        variants={variants.path6}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Trophy(props: TrophyProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Trophy,
  Trophy as TrophyIcon,
  type TrophyProps,
  type TrophyProps as TrophyIconProps,
};
