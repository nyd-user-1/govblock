'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `eye`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The eye blinks: the pupil closes and opens.

type EyeProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path: {
      initial: {},
      animate: {},
    },
    circle: {
      initial: { scale: 1 },
      animate: { scale: [1, 0.2, 1], transition: { duration: 0.4, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: EyeProps) {
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
        d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        variants={variants.path}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={12}
        cy={12}
        r={3}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Eye(props: EyeProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Eye,
  Eye as EyeIcon,
  type EyeProps,
  type EyeProps as EyeIconProps,
};
