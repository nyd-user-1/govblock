'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `coffee`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The steam rises: the three wisps lift in turn.

type CoffeeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.6, ease: 'easeInOut', delay: 0.1 } },
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.6, ease: 'easeInOut', delay: 0.2 } },
    },
    path3: {
      initial: {},
      animate: {},
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CoffeeProps) {
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
        d="M10 2v2"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M14 2v2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M6 2v2"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Coffee(props: CoffeeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Coffee,
  Coffee as CoffeeIcon,
  type CoffeeProps,
  type CoffeeProps as CoffeeIconProps,
};
