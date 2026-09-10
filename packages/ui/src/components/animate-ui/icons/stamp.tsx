'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `stamp`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The handle presses and the base takes it.

type StampProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, 2.5, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.08 } },
    },
    path3: {
      initial: {},
      animate: {},
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: StampProps) {
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
        d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M5 22h14"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Stamp(props: StampProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Stamp,
  Stamp as StampIcon,
  type StampProps,
  type StampProps as StampIconProps,
};
