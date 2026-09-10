'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `landmark`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The four columns rise in turn, left to right.

type LandmarkProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.08 } },
    },
    path2: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.16 } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.24 } },
    },
    path5: {
      initial: {},
      animate: {},
    },
    path6: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LandmarkProps) {
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
        d="M10 18v-7"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M14 18v-7"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M18 18v-7"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 22h18"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M6 18v-7"
        variants={variants.path6}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Landmark(props: LandmarkProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Landmark,
  Landmark as LandmarkIcon,
  type LandmarkProps,
  type LandmarkProps as LandmarkIconProps,
};
