import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
  children?: ReactNode
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-[#e6f4ef] text-[#1e8572] border border-[#bde1d3]',
      secondary: 'bg-[#e2e8f0] text-[#334155] border border-[#cbd5e1]',
      destructive: 'bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5]',
      outline: 'bg-transparent border border-[#cbd5e1] text-[#475569]',
      success: 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]',
      warning: 'bg-[#fef3c7] text-[#b45309] border border-[#fcd34d]',
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'

export { Badge }
