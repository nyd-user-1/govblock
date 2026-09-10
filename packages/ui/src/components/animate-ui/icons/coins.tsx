'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `coins`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The front coin lifts; the one behind it settles.

type CoinsProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path3: {
      initial: { y: 0 },
      animate: { y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    circle: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CoinsProps) {
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
        d="M13.744 17.736a6 6 0 1 1-7.48-7.48"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M15 6h1v4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m6.134 14.768.866-.5 2 3.464"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={16}
        cy={8}
        r={6}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Coins(props: CoinsProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Coins,
  Coins as CoinsIcon,
  type CoinsProps,
  type CoinsProps as CoinsIconProps,
};
