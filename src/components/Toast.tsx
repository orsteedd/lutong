import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ToastProps {
  className?: string
  title?: ReactNode
  description?: ReactNode
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  isLeaving?: boolean
  onClose?: () => void
  children?: ReactNode
}

const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant = 'default', isLeaving = false, onClose }, ref) => {
    const variants = {
      default: 'border-[#dceae4] bg-white text-[#111827] shadow-[0_14px_38px_rgba(15,23,42,0.16)]',
      destructive: 'border-[#fecaca] bg-[#fef2f2] text-[#7f1d1d] shadow-[0_14px_38px_rgba(127,29,29,0.18)]',
      success: 'border-[#bde1d3] bg-[#ebf7f2] text-[#14532d] shadow-[0_14px_38px_rgba(21,128,61,0.18)]',
      warning: 'border-[#f4c08a] bg-[#fff4e8] text-[#92400e] shadow-[0_14px_38px_rgba(146,64,14,0.16)]',
    }

    const accents = {
      default: 'bg-[#d6e8e0]',
      destructive: 'bg-[#dc2626]',
      success: 'bg-[#1e8572]',
      warning: 'bg-[#d97706]',
    }
    
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          'relative flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ease-out',
          isLeaving ? 'translate-y-1 scale-[0.985] opacity-0' : 'translate-y-0 scale-100 opacity-100',
          variants[variant],
          className
        )}
      >
        <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', accents[variant])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title && <div className="text-sm font-semibold leading-tight">{title}</div>}
          {description && <div className="mt-0.5 text-sm/5 opacity-95">{description}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-base leading-none hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = 'Toast'

export { Toast }
