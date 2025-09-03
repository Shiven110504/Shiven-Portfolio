// Global type definitions for the portfolio

// Component variant types
export type ComponentVariant = 'primary' | 'secondary' | 'accent' | 'ghost';
export type ComponentSize = 'sm' | 'md' | 'lg' | 'xl';

// Animation types
export interface AnimationProps {
  duration?: number;
  delay?: number;
  ease?: string | number[];
  repeat?: number;
  repeatType?: 'loop' | 'reverse' | 'mirror';
}

// UI component props interfaces
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  variant?: ComponentVariant;
  size?: ComponentSize;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  animationProps?: AnimationProps;
}

// Form component types
export interface FormFieldProps extends BaseComponentProps {
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Layout component types
export interface SectionProps extends BaseComponentProps {
  id?: string;
  fullWidth?: boolean;
  containerClassName?: string;
}

// Animation component types
export interface AnimatedSectionProps extends SectionProps {
  animationType?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'stagger';
  staggerDelay?: number;
}

// Event handler types
export type EventHandler<T = void> = (event?: T) => void;
export type AsyncEventHandler<T = void> = (event?: T) => Promise<void>;

// Utility types
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
