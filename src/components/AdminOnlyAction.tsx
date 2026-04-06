import type { ReactElement, ReactNode } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

interface AdminOnlyActionProps {
  children: ReactElement
  title?: string
  fallback?: ReactNode
}

const AdminOnlyAction = ({
  children,
  title = 'Admin permission required.',
  fallback = null,
}: AdminOnlyActionProps) => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  if (isAdmin) return children

  return (
    <div className="opacity-60 pointer-events-none" title={title} aria-disabled="true">
      {children}
      {fallback}
    </div>
  )
}

export default AdminOnlyAction
