import { forwardRef } from 'react'
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const BASE_CLASSES =
  'w-full rounded-md border border-ink-700 bg-ink-800 text-parchment-100 outline-none transition placeholder:text-parchment-400 focus:border-ember-500 disabled:opacity-50'

const SIZE_CLASSES = {
  sm: 'px-2 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
} as const

type FieldSize = keyof typeof SIZE_CLASSES

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn('mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-parchment-400', className)}
    {...props}
  />
)

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: FieldSize }
>(
  ({ size = 'md', className, ...props }, ref) => (
    <input ref={ref} className={cn(BASE_CLASSES, SIZE_CLASSES[size], className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { size?: FieldSize }
>(({ size = 'md', className, ...props }, ref) => (
  <textarea ref={ref} className={cn(BASE_CLASSES, SIZE_CLASSES[size], className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const Select = forwardRef<
  HTMLSelectElement,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: FieldSize }
>(
  ({ size = 'md', className, ...props }, ref) => (
    <select ref={ref} className={cn(BASE_CLASSES, SIZE_CLASSES[size], className)} {...props} />
  ),
)
Select.displayName = 'Select'
