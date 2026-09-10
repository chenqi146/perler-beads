import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

type IconButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'aria-label'> & {
  'aria-label': string;
  isActive?: boolean;
  tone?: 'neutral' | 'amber' | 'danger';
  children: ReactNode;
};

export function IconButton({
  className,
  isActive = false,
  tone = 'neutral',
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  const filled = isActive || tone === 'amber';
  const danger = tone === 'danger';

  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg touch-manipulation',
        'hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-40',
        'dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900',
        filled && !danger && 'bg-amber-500 text-white hover:bg-amber-600',
        !filled && !danger && 'text-gray-700 dark:text-gray-200',
        danger && 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

export function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
