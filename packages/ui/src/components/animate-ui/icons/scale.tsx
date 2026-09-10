'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `scale`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The beam tips and the pans follow, then it levels.

type ScaleProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: {},
      animate: {},
    },
    path2: {
      initial: { y: 0 },
      animate: { y: [0, 1.2, -1.2, 0], transition: { duration: 0.8, ease: 'easeInOut' } },
    },
    path3: {
      initial: { rotate: 0 },
      animate: { rotate: [0, -6, 6, 0], transition: { duration: 0.8, ease: 'easeInOut' } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, -1.2, 1.2, 0], transition: { duration: 0.8, ease: 'easeInOut' } },
    },
    path5: {
      initial: {},
      animate: {},
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ScaleProps) {
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
        d="M12 3v18"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m19 8 3 8a5 5 0 0 1-6 0zV7"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m5 8 3 8a5 5 0 0 1-6 0zV7"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M7 21h10"
        variants={variants.path5}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Scale(props: ScaleProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Scale,
  Scale as ScaleIcon,
  type ScaleProps,
  type ScaleProps as ScaleIconProps,
};
