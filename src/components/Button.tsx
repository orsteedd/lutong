import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  children?: ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 shadow-sm'
    
    const variants = {
      default: 'bg-[#B91C1C] text-white hover:bg-[#7F1D1D] active:bg-[#651313] focus-visible:ring-[#B91C1C]',
      secondary: 'bg-[#111827] text-white hover:bg-[#7F1D1D] active:bg-[#651313] focus-visible:ring-[#7F1D1D]',
      destructive: 'bg-[#B91C1C] text-white hover:bg-[#7F1D1D] active:bg-[#651313] focus-visible:ring-[#B91C1C]',
      outline: 'border border-[#D7B2B2] text-[#7F1D1D] bg-white hover:bg-[#FDF2F2] active:bg-[#FBE7E7]',
      ghost: 'hover:bg-[#f8f1f1] active:bg-[#f2e7e7] text-[#334155]',
      link: 'text-[#7F1D1D] underline-offset-4 hover:underline shadow-none',
    }
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm h-9',
      md: 'px-4 py-2 text-base h-11',
      lg: 'px-6 py-3 text-lg h-12',
      icon: 'h-10 w-10',
    }
    
    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
