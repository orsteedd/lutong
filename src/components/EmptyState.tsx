import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  message: string
  icon?: ReactNode
  className?: string
}

const EmptyState = ({ title, message, icon = '○', className }: EmptyStateProps) => {
  return (
    <div className={cn('rounded-xl border border-[#dceae4] bg-[#f8fcfa] px-4 py-10 text-center', className)}>
      <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6e8e0] bg-white text-lg text-[#7F1D1D]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mt-1 text-xs text-[#64748b]">{message}</p>
    </div>
  )
}

export default EmptyState
