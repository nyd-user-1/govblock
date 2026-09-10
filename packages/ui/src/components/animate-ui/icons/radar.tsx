'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `radar`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The needle sweeps one full turn about the centre.

type RadarProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: {},
      animate: {},
    },
    path3: {
      initial: {},
      animate: {},
    },
    path4: {
      initial: {},
      animate: {},
    },
    path5: {
      initial: {},
      animate: {},
    },
    path6: {
      initial: {},
      animate: {},
    },
    circle: {
      initial: {},
      animate: {},
    },
    path7: {
      initial: { rotate: 0, originX: -0.2491, originY: 1.2491 },
      animate: { rotate: [0, 360], originX: -0.2491, originY: 1.2491, transition: { duration: 1, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: RadarProps) {
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
        d="M19.07 4.93A10 10 0 0 0 6.99 3.34"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 6h.01"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M2.29 9.62A10 10 0 1 0 21.31 8.35"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M16.24 7.76A6 6 0 1 0 8.23 16.67"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 18h.01"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M17.99 11.66A6 6 0 0 1 15.77 16.67"
        variants={variants.path6}
        initial="initial"
        animate={controls}
      />
      <motion.circle
        cx={12}
        cy={12}
        r={2}
        variants={variants.circle}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m13.41 10.59 5.66-5.66"
        variants={variants.path7}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Radar(props: RadarProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Radar,
  Radar as RadarIcon,
  type RadarProps,
  type RadarProps as RadarIconProps,
};
