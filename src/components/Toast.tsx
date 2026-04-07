import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ToastProps {
  className?: string
  title?: ReactNode
  description?: ReactNode
  variant?: 'default' | 'destructive' | 'success'
  onClose?: () => void
  children?: ReactNode
}

const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant = 'default', onClose }, ref) => {
    const variants = {
      default: 'bg-gray-900 text-white',
      destructive: 'bg-error text-white',
      success: 'bg-success text-white',
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-4 px-4 py-3 rounded-xl shadow-lg border border-gray-700 animate-in slide-in-from-bottom-5 duration-300',
          variants[variant],
          className
        )}
      >
        <div className="flex-1">
          {title && <div className="font-semibold">{title}</div>}
          {description && <div className="text-sm opacity-90">{description}</div>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xl leading-none hover:opacity-70"
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
