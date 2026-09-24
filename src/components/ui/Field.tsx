import { forwardRef } from 'react'
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const FIELD_CLASSES =
  'w-full rounded-md border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-parchment-100 outline-none transition placeholder:text-parchment-400 focus:border-ember-500 disabled:opacity-50'

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn('mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-parchment-400', className)}
    {...props}
  />
)

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(FIELD_CLASSES, className)} {...props} />,
)
Select.displayName = 'Select'
