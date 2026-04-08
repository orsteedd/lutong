import { useToastStore, type ToastVariant } from '@/store/useToastStore'

interface NotifyOptions {
  title: string
  description?: string
  variant: ToastVariant
}

export const notify = ({ title, description, variant }: NotifyOptions) => {
  useToastStore.getState().pushToast({ title, description, variant })
}

export const notifySuccess = (title: string, description?: string) =>
  notify({ title, description, variant: 'success' })

export const notifyStaged = (title: string, description?: string) =>
  notify({ title, description, variant: 'warning' })

export const notifyError = (title: string, description?: string) =>
  notify({ title, description, variant: 'destructive' })
