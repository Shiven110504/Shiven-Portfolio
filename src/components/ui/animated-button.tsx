'use client';

import { motion, Transition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { scaleOnHover } from '@/lib/animations';
import { InteractiveComponentProps } from '@/types';

export interface AnimatedButtonProps extends InteractiveComponentProps {
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export function AnimatedButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  href,
  target = '_self',
  animationProps,
  ...props
}: AnimatedButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    accent: 'bg-purple-600 hover:bg-purple-700 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-300'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  };

  const baseClasses = cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  const content = (
    <motion.div
      className={cn('flex items-center gap-2', loading && 'opacity-70')}
      variants={scaleOnHover}
      initial="initial"
      whileHover={!disabled && !loading ? 'hover' : 'initial'}
      whileTap={!disabled && !loading ? 'tap' : 'initial'}
      transition={animationProps as Transition}
    >
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        target={target}
        className={baseClasses}
        onClick={onClick}
        variants={scaleOnHover}
        initial="initial"
        whileHover={!disabled ? 'hover' : 'initial'}
        whileTap={!disabled ? 'tap' : 'initial'}
        {...props}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      className={baseClasses}
      onClick={onClick}
      disabled={disabled || loading}
      variants={scaleOnHover}
      initial="initial"
      whileHover={!disabled && !loading ? 'hover' : 'initial'}
      whileTap={!disabled && !loading ? 'tap' : 'initial'}
      {...props}
    >
      {content}
    </motion.button>
  );
}
