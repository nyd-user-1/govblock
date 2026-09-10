'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `square-play`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The play mark swells once.

type SquarePlayProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    rect: {
      initial: {},
      animate: {},
    },
    path: {
      initial: { scale: 1 },
      animate: { scale: [1, 1.2, 1], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: SquarePlayProps) {
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
      <motion.rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={2}
        variants={variants.rect}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function SquarePlay(props: SquarePlayProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  SquarePlay,
  SquarePlay as SquarePlayIcon,
  type SquarePlayProps,
  type SquarePlayProps as SquarePlayIconProps,
};
