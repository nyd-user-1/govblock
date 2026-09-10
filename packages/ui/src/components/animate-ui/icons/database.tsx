'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `database`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The stack lifts from the top down.

type DatabaseProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    ellipse: {
      initial: { y: 0 },
      animate: { y: [0, -2, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, -1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: DatabaseProps) {
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
      <motion.ellipse
        cx={12}
        cy={5}
        rx={9}
        ry={3}
        variants={variants.ellipse}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 5V19A9 3 0 0 0 21 19V5"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 12A9 3 0 0 0 21 12"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Database(props: DatabaseProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Database,
  Database as DatabaseIcon,
  type DatabaseProps,
  type DatabaseProps as DatabaseIconProps,
};
