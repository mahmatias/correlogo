import { ReactNode, MouseEventHandler } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'bg-bg-elevated text-text-primary hover:opacity-80',
  ghost: 'text-text-muted hover:text-text-primary',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizeClasses: Record<string, string> = {
  sm: 'p-1 text-xs rounded',
  md: 'p-2 rounded-lg',
  lg: 'p-4 rounded-xl font-bold',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`whitespace-nowrap transition-colors disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
