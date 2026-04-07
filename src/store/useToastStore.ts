import { create } from 'zustand'

export type ToastVariant = 'success' | 'warning' | 'destructive'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  isLeaving?: boolean
}

const buildToastKey = (toast: Omit<ToastMessage, 'id'>) =>
  `${toast.variant}::${toast.title.trim()}::${(toast.description ?? '').trim()}`

interface ToastStore {
  toasts: ToastMessage[]
  pushToast: (toast: Omit<ToastMessage, 'id'>) => string
  dismissToast: (id: string) => void
  clearToasts: () => void
}

const TOAST_VISIBLE_MS = 680
const TOAST_LEAVE_MS = 180

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  pushToast: (toast) => {
    const toastKey = buildToastKey(toast)
    let existingId: string | null = null
    let createdId: string | null = null

    set((state) => {
      const existingToast = state.toasts.find((item) => buildToastKey(item) === toastKey)
      if (existingToast) {
        existingId = existingToast.id
        return state
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      createdId = id

      return {
        toasts: [...state.toasts, { ...toast, id, isLeaving: false }].slice(-5),
      }
    })

    if (existingId) {
      return existingId
    }

    if (!createdId) {
      return ''
    }

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.map((item) =>
          item.id === createdId ? { ...item, isLeaving: true } : item
        ),
      }))

      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== createdId) }))
      }, TOAST_LEAVE_MS)
    }, TOAST_VISIBLE_MS)

    return createdId
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((item) => (item.id === id ? { ...item, isLeaving: true } : item)),
    }))

    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
    }, TOAST_LEAVE_MS)
  },

  clearToasts: () => set({ toasts: [] }),
}))
