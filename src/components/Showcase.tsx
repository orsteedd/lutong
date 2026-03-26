import { useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  Input,
  Badge,
  Toast,
} from '@/components'

const ComponentShowcase = () => {
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'default' | 'success' | 'destructive'>('default')

  const handleShowToast = (type: 'default' | 'success' | 'destructive', message: string) => {
    setToastType(type)
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  return (
    <div className="space-y-8">
      {/* Buttons Section */}
      <Card>
        <CardHeader>
          <CardTitle as="h3">Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="default" onClick={() => handleShowToast('success', 'Primary button clicked!')}>
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </CardContent>
      </Card>

      {/* Button Sizes */}
      <Card>
        <CardHeader>
          <CardTitle as="h3">Button Sizes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">🔍</Button>
          </div>
        </CardContent>
      </Card>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle as="h3">Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">Normal Input</label>
            <Input placeholder="Enter text..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">Search Barcode</label>
            <Input type="text" placeholder="Scan or type barcode..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">Disabled Input</label>
            <Input placeholder="Disabled..." disabled />
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle as="h3">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Example */}
      <Card>
        <CardHeader>
          <CardTitle as="h3">Dialog</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger>
              <Button variant="default">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <p className="text-gray-600">Are you sure you want to proceed with this action?</p>
              </DialogBody>
              <DialogFooter>
                <DialogClose>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose>
                  <Button variant="default" onClick={() => handleShowToast('success', 'Action confirmed!')}>
                    Confirm
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast
            title="Notification"
            description={toastMessage}
            variant={toastType}
            onClose={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  )
}

export default ComponentShowcase
