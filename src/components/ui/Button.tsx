import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-ember-500 text-ink-950 hover:bg-ember-400 active:bg-ember-600',
  secondary: 'border border-ink-700 text-parchment-200 hover:border-ink-600 hover:bg-ink-800',
  ghost: 'text-parchment-300 hover:text-parchment-100 hover:bg-ink-800/60',
  danger: 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}>(({ variant = 'primary', size = 'md', className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      className,
    )}
    {...props}
  />
))
Button.displayName = 'Button'
