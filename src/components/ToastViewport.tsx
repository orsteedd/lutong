import { Toast } from '@/components/Toast'
import { useToastStore } from '@/store/useToastStore'

const ToastViewport = () => {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[120] flex w-[min(94vw,460px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            isLeaving={Boolean(toast.isLeaving)}
            onClose={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

export default ToastViewport
