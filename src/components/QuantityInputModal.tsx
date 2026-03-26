import { useState } from 'react'
import { Dialog, Input, Button } from '@/components'
import type { InventoryItemData } from '@/lib/scanEngine'

interface QuantityInputModalProps {
  isOpen: boolean
  sku: string
  itemName: string
  modeLabel?: string
  itemDetails?: InventoryItemData
  onSubmit: (quantity: number) => void
  onInvalidQuantity?: () => void
  onCancel: () => void
  defaultQuantity?: number
}

const QuantityInputModal = ({
  isOpen,
  sku,
  itemName,
  modeLabel = 'Scan',
  itemDetails,
  onSubmit,
  onInvalidQuantity,
  onCancel,
  defaultQuantity = 1,
}: QuantityInputModalProps) => {
  const [quantity, setQuantity] = useState(defaultQuantity.toString())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (qty > 0) {
      onSubmit(qty)
      setQuantity(defaultQuantity.toString())
      return
    }
    onInvalidQuantity?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
        <div className="bg-white w-full md:w-96 rounded-t-2xl md:rounded-2xl p-6 space-y-4 shadow-xl">
          {/* Item Info */}
          <div>
            <div className="text-xs font-mono text-gray-600 mb-1">{sku}</div>
            <h2 className="text-xl font-bold text-black">{itemName}</h2>
            {itemDetails && (
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <div>📍 {itemDetails.location}</div>
                <div>📦 {itemDetails.category}</div>
                <div>
                  Stock range: {itemDetails.minStock}–{itemDetails.maxStock} {itemDetails.unit}
                </div>
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                {modeLabel} quantity ({itemDetails?.unit || 'units'})
              </label>
              <Input
                type="number"
                min="1"
                max="9999"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                autoFocus
                className="text-center text-2xl font-bold"
              />
            </div>

            {/* Quick Quantity Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 25].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setQuantity(qty.toString())}
                  className="h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 active:bg-primary active:text-white transition-all"
                >
                  {qty}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="flex-1"
                type="button"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                type="submit"
                className="flex-1"
              >
                ✓ Confirm {modeLabel} ({quantity})
              </Button>
            </div>
          </form>

          {/* Continue Scanning Hint */}
          <p className="text-xs text-gray-600 text-center">
            After confirming, you'll return to scanning
          </p>
        </div>
      </div>
    </Dialog>
  )
}

export default QuantityInputModal
