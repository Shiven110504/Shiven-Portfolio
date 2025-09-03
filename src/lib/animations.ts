import { Variants } from 'framer-motion';

// Animation variants for UI components
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

export const scaleOnHover: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.05, transition: { duration: 0.2, ease: 'easeOut' } },
  tap: { scale: 0.95, transition: { duration: 0.1 } }
};

export const pageTransition: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.3 } }
};

// Utility functions
export function createStaggerDelay(index: number, baseDelay = 0.1): number {
  return baseDelay * index;
}

export const physicsSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8
} as const;
