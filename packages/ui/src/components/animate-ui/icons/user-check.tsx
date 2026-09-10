'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `user-check`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The head lifts and the check draws.

type UserCheckProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.1 } },
    },
    path2: {
      initial: {},
      animate: {},
    },
    circle: {
      initial: { y: 0 },
      animate: { y: [0, -1.5, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: UserCheckProps) {
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
        d="m16 11 2 2 4-4"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={9}
        cy={7}
        r={4}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function UserCheck(props: UserCheckProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  UserCheck,
  UserCheck as UserCheckIcon,
  type UserCheckProps,
  type UserCheckProps as UserCheckIconProps,
};
