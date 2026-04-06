import { cloneElement, isValidElement, type ReactElement } from 'react'
import { useAuthStore } from '@/store'

type AdminOnlyChildProps = {
  disabled?: boolean
  title?: string
}

interface AdminOnlyActionProps {
  children: ReactElement<AdminOnlyChildProps>
  title?: string
}

const AdminOnlyAction = ({ children, title = 'Admin only action' }: AdminOnlyActionProps) => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  if (!isValidElement(children)) {
    return null
  }

  const childProps = children.props
  const nextDisabled = Boolean(childProps.disabled) || !isAdmin

  return cloneElement(children, {
    disabled: nextDisabled,
    title: !isAdmin ? title : childProps.title,
  })
}

export default AdminOnlyAction