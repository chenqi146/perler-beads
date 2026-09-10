import { cn } from './cn';

type ColorSwatchProps = {
  hex: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'square' | 'circle';
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
};

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const;

export function ColorSwatch({
  hex,
  size = 'sm',
  shape = 'square',
  isSelected = false,
  className,
  onClick,
  'aria-label': ariaLabel,
}: ColorSwatchProps) {
  const classes = cn(
    'inline-block shrink-0 border border-gray-300 dark:border-gray-600',
    sizeClass[size],
    shape === 'circle' ? 'rounded-full' : 'rounded',
    isSelected && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800',
    className,
  );
  const style = { backgroundColor: hex };

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? hex}
        onClick={onClick}
        className={cn(
          classes,
          'touch-manipulation hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        )}
        style={style}
      />
    );
  }

  return <span aria-hidden="true" className={classes} style={style} />;
}
