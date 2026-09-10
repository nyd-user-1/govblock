'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `type`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The stem of the T draws downward.

type TypeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { pathLength: 1, opacity: 1 },
      animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
    path2: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: {},
      animate: {},
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: TypeProps) {
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
        d="M12 4v16"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M9 20h6"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Type(props: TypeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Type,
  Type as TypeIcon,
  type TypeProps,
  type TypeProps as TypeIconProps,
};
