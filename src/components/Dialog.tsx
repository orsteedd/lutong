import { useState, useCallback, forwardRef, type ReactNode } from 'react'
import React from 'react'
import { cn } from '@/lib/cn'

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType | null>(null)

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

const Dialog = ({ open: controlledOpen, onOpenChange, children }: DialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  
  const setOpen = useCallback((value: boolean) => {
    if (!isControlled) setInternalOpen(value)
    onOpenChange?.(value)
  }, [isControlled, onOpenChange])
  
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

const useDialogContext = () => {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error('Dialog components must be used within Dialog')
  return context
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
}

const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = useDialogContext()
    return (
      <button
        ref={ref}
        onClick={(e) => {
          setOpen(true)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)
DialogTrigger.displayName = 'DialogTrigger'

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, ...props }, ref) => {
    const { open, setOpen } = useDialogContext()
    
    if (!open) return null
    
    return (
      <>
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={ref}
            className={cn(
              'bg-white border border-gray-200 rounded-xl shadow-lg max-w-md w-full max-h-[92vh] overflow-hidden flex flex-col',
              className
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
          />
        </div>
      </>
    )
  }
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4 border-b border-gray-200', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('text-lg font-semibold text-[#111827]', className)} {...props} />
)
DialogTitle.displayName = 'DialogTitle'

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4 overflow-y-auto', className)} {...props} />
)
DialogBody.displayName = 'DialogBody'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 shrink-0', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogClose = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = useDialogContext()
    return (
      <button
        ref={ref}
        onClick={(e) => {
          setOpen(false)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)
DialogClose.displayName = 'DialogClose'

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose }
