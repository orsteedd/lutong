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
      default: 'bg-[#1e8572] text-white hover:bg-[#186c5d] active:bg-[#14594d] focus-visible:ring-[#1e8572]',
      secondary: 'bg-[#0f172a] text-white hover:bg-[#1f2937] active:bg-[#111827] focus-visible:ring-[#0f172a]',
      destructive: 'bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b] focus-visible:ring-[#dc2626]',
      outline: 'border border-[#b7d7cc] text-[#1e8572] bg-white hover:bg-[#f1f8f5] active:bg-[#e5f2ed]',
      ghost: 'hover:bg-[#eef5f2] active:bg-[#e3efea] text-[#334155]',
      link: 'text-[#1e8572] underline-offset-4 hover:underline shadow-none',
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
