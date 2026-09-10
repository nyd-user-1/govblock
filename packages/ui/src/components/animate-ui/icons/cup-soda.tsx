'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@govblock/ui/components/animate-ui/icons/icon';

// lucide's `cup-soda`, redrawn in animate-ui's pattern (2026-09-09): the same
// paths, so it is pixel-identical at rest, with one motion for when an
// AnimateIcon ancestor plays it. The straw bobs and the drink settles.

type CupSodaProps = IconProps<keyof typeof animations>;

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
      initial: { y: 0 },
      animate: { y: [0, 1, 0], transition: { duration: 0.5, ease: 'easeInOut', delay: 0.05 } },
    },
    path4: {
      initial: { y: 0 },
      animate: { y: [0, -1.5, 0], transition: { duration: 0.5, ease: 'easeInOut' } },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CupSodaProps) {
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
        d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M5 8h14"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"
        variants={variants.path3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m12 8 1-6h2"
        variants={variants.path4}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function CupSoda(props: CupSodaProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  CupSoda,
  CupSoda as CupSodaIcon,
  type CupSodaProps,
  type CupSodaProps as CupSodaIconProps,
};
