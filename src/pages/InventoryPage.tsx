import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
import { useAuthStore, useInventoryStore, useOfflineQueueStore } from '@/store'
import { useActivityLogStore } from '@/store/useActivityLogStore'
import { computeInventoryStateSnapshot } from '@/lib/inventoryState'
import QRCode from 'qrcode'

type InventoryOperationMode = 'delivery' | 'transfer' | 'wastage'

const INVENTORY_DELIVERY_SESSION_PREFIX = 'INV-DEL'

const InventoryPage = () => {
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768)
  const user = useAuthStore((state) => state.user)
  const itemsState = useInventoryStore((state) => state.items)
  const addItem = useInventoryStore((state) => state.addItem)
  const removeItem = useInventoryStore((state) => state.removeItem)
  const scanQueueState = useOfflineQueueStore((state) => state.scanQueue)
  const enqueueScan = useOfflineQueueStore((state) => state.enqueueScan)
  const enqueueWastage = useOfflineQueueStore((state) => state.enqueueWastage)
  const addActivityLog = useActivityLogStore((state) => state.addLog)
  const [draftName, setDraftName] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [draftUnit, setDraftUnit] = useState('pcs')
  const [draftQuantity, setDraftQuantity] = useState('0')
  const [draftSafetyBuffer, setDraftSafetyBuffer] = useState('0')
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [operationSku, setOperationSku] = useState('')
  const [operationMode, setOperationMode] = useState<InventoryOperationMode>('delivery')
  const [operationQty, setOperationQty] = useState('')
  const [wastageReason, setWastageReason] = useState('Expired item')
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [qrBySku, setQrBySku] = useState<Record<string, string>>({})
  const [qrMessage, setQrMessage] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'

  const items = Array.isArray(itemsState) ? itemsState : []
  const scanQueue = Array.isArray(scanQueueState) ? scanQueueState : []

  const snapshot = useMemo(
    () => computeInventoryStateSnapshot(items, scanQueue),
    [items, scanQueue]
  )
  const selectedOperationItem = useMemo(
    () => items.find((item) => item.sku === operationSku),
    [items, operationSku]
  )

  const nextSku = useMemo(() => {
    const used = new Set(items.map((item) => item.sku.toUpperCase()))
    const maxSeed = items.reduce((max, item) => {
      const match = item.sku.toUpperCase().match(/^SKU-(\d+)$/)
      if (!match) return max
      const value = Number.parseInt(match[1], 10)
      return Number.isInteger(value) && value > max ? value : max
    }, 0)

    let candidate = maxSeed + 1
    while (used.has(`SKU-${String(candidate).padStart(3, '0')}`)) {
      candidate += 1
    }

    return `SKU-${String(candidate).padStart(3, '0')}`
  }, [items])

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleAddItem = () => {
    const sku = nextSku
    const name = draftName.trim()
    const category = draftCategory.trim()
    const unit = draftUnit.trim().toLowerCase()
    const quantity = Number.parseInt(draftQuantity, 10)
    const safetyBuffer = Number.parseInt(draftSafetyBuffer, 10)

    if (!name || !category || !unit) {
      setFormMessage('Item name, category, and unit are required.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setFormMessage('Quantity must be 0 or higher.')
      return
    }

    if (!Number.isInteger(safetyBuffer) || safetyBuffer < 0) {
      setFormMessage('Safety buffer must be 0 or higher.')
      return
    }

    addItem({
      id: `item-${Date.now()}`,
      sku,
      name,
      quantity,
      safetyBuffer,
      unit,
      category,
      lastUpdated: Date.now(),
    })

    setDraftName('')
    setDraftCategory('')
    setDraftUnit('pcs')
    setDraftQuantity('0')
    setDraftSafetyBuffer('0')
    setFormMessage(`Item added to inventory with SKU ${sku}.`)
  }

  const handleApplyOperation = () => {
    const qty = Number.parseInt(operationQty, 10)

    if (!selectedOperationItem) {
      setOperationMessage('Select an existing item first.')
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setOperationMessage('Quantity must be greater than 0.')
      return
    }

    if (operationMode === 'wastage' && !wastageReason.trim()) {
      setOperationMessage('Wastage reason is required.')
      return
    }

    const timestamp = Date.now()
    const baseId = `${selectedOperationItem.sku}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`

    if (operationMode === 'delivery') {
      const sessionId = `${INVENTORY_DELIVERY_SESSION_PREFIX}-${new Date(timestamp).toISOString().slice(0, 10)}`
      enqueueScan({
        id: `inv-del-${baseId}`,
        type: 'delivery',
        sku: selectedOperationItem.sku,
        name: selectedOperationItem.name,
        quantity: qty,
        timestamp,
        synced: false,
        metadata: { sessionId },
      })
      setOperationMessage(`Delivery applied: +${qty} to stock for ${selectedOperationItem.sku}.`)
    }

    if (operationMode === 'transfer') {
      enqueueScan({
        id: `inv-xfer-${baseId}`,
        type: 'transfer',
        sku: selectedOperationItem.sku,
        name: selectedOperationItem.name,
        quantity: qty,
        timestamp,
        synced: false,
        metadata: {
          fromLocation: 'Stock',
          toLocation: 'Display',
        },
      })
      setOperationMessage(`Transfer applied: ${qty} moved Stock -> Display for ${selectedOperationItem.sku}.`)
    }

    if (operationMode === 'wastage') {
      enqueueScan({
        id: `inv-waste-${baseId}`,
        type: 'wastage',
        sku: selectedOperationItem.sku,
        name: selectedOperationItem.name,
        quantity: qty,
        timestamp,
        synced: false,
        metadata: {
          reason: wastageReason.trim(),
        },
      })
      enqueueWastage({
        id: `waste-log-${baseId}`,
        sku: selectedOperationItem.sku,
        quantity: qty,
        reason: wastageReason.trim(),
        timestamp,
        synced: false,
      })
      setOperationMessage(`Wastage recorded: -${qty} from usable stock for ${selectedOperationItem.sku}.`)
    }

    setOperationQty('')
  }

  const handleGenerateQr = async (sku: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(sku, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
      })

      setQrBySku((prev) => ({
        ...prev,
        [sku]: dataUrl,
      }))
      setQrMessage(`QR generated for ${sku}.`)
    } catch {
      setQrMessage(`Failed to generate QR for ${sku}.`)
    }
  }

  const handleDownloadQr = (sku: string) => {
    const dataUrl = qrBySku[sku]
    if (!dataUrl) {
      setQrMessage(`Generate QR first for ${sku}.`)
      return
    }

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${sku}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setQrMessage(`QR downloaded for ${sku}.`)
  }

  const handlePrintQr = (sku: string) => {
    const dataUrl = qrBySku[sku]
    if (!dataUrl) {
      setQrMessage(`Generate QR first for ${sku}.`)
      return
    }

    const printWindow = window.open('', '_blank', 'width=420,height=560')
    if (!printWindow) {
      setQrMessage('Popup blocked. Allow popups to print QR.')
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR ${sku}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; text-align: center; }
            img { width: 280px; height: 280px; display: block; margin: 0 auto 12px; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            p { margin: 0; color: #475569; }
          </style>
        </head>
        <body>
          <h1>${sku}</h1>
          <img src="${dataUrl}" alt="QR ${sku}" />
          <p>Scan value: ${sku}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setQrMessage(`Print dialog opened for ${sku}.`)
  }

  const handleRemoveQr = (sku: string) => {
    setQrBySku((prev) => {
      const next = { ...prev }
      delete next[sku]
      return next
    })
    setQrMessage(`QR removed for ${sku}.`)
  }

  const handleDeleteItem = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      setFormMessage('Item not found.')
      return
    }

    const shouldDelete = window.confirm(
      `Remove ${item.name} (${item.sku}) entirely from inventory? This cannot be undone.`
    )

    if (!shouldDelete) return

    removeItem(itemId)
    setQrBySku((prev) => {
      const next = { ...prev }
      delete next[item.sku]
      return next
    })

    addActivityLog({
      user_id: 'operator-local',
      action_type: 'inventory_item_deleted',
      item_id: item.sku,
      timestamp: Date.now(),
      details: `Deleted inventory item ${item.name} (${item.sku}) from local DB`,
    })

    setOperationSku((prev) => (prev === item.sku ? '' : prev))
    setFormMessage(`Item ${item.sku} removed entirely from inventory and recorded in activity logs.`)
  }

  if (isMobileView) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Inventory</h1>
        <p className="text-[#64748b]">Desktop stock view for current item levels and pending adjustments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-gray-600">Items</p>
            <p className="text-3xl font-bold text-black">{snapshot.items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-gray-600">Stock</p>
            <p className="text-3xl font-bold text-black">{snapshot.totals.stockQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-sky-700">Display</p>
            <p className="text-3xl font-bold text-sky-700">{snapshot.totals.displayQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-gray-600">Pending Net</p>
            <p className="text-3xl font-bold text-[#1e8572]">
              {snapshot.totals.pendingNet > 0 ? '+' : ''}
              {snapshot.totals.pendingNet}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Add Inventory Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Inventory write actions are restricted to admins.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm text-[#334155]">
              Auto SKU
              <input
                type="text"
                value={nextSku}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-[#f8fbfa] px-3 py-2 text-[#64748b]"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Item Name
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Item name"
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
            <label className="text-sm text-[#334155]">
              Category
              <input
                type="text"
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                placeholder="Category"
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm text-[#334155]">
              Unit
              <input
                type="text"
                value={draftUnit}
                onChange={(e) => setDraftUnit(e.target.value)}
                placeholder="pcs, kg, bottle"
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
            <label className="text-sm text-[#334155]">
              Current Quantity
              <input
                type="number"
                min={0}
                value={draftQuantity}
                onChange={(e) => setDraftQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
            <label className="text-sm text-[#334155]">
              Safety Buffer
              <input
                type="number"
                min={0}
                value={draftSafetyBuffer}
                onChange={(e) => setDraftSafetyBuffer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-11" onClick={handleAddItem} disabled={!isAdmin}>Add Item</Button>
            {formMessage && <p className="text-xs text-[#64748b]">{formMessage}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Reuse Existing Item (Qty Operations)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-sm text-[#334155]">
              Item (SKU)
              <select
                value={operationSku}
                onChange={(e) => setOperationSku(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              >
                <option value="">Select existing item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.sku}>
                    {item.sku} • {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[#334155]">
              Mode
              <select
                value={operationMode}
                onChange={(e) => setOperationMode(e.target.value as InventoryOperationMode)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              >
                <option value="delivery">Delivery (+Stock)</option>
                <option value="transfer">Transfer (Stock -&gt; Display)</option>
                <option value="wastage">Wastage (Non-usable)</option>
              </select>
            </label>

            <label className="text-sm text-[#334155]">
              Quantity
              <input
                type="number"
                min={1}
                value={operationQty}
                onChange={(e) => setOperationQty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>

            <div className="flex items-end">
              <Button className="h-11 w-full" onClick={handleApplyOperation} disabled={!isAdmin}>Apply Operation</Button>
            </div>
          </div>

          {operationMode === 'wastage' && (
            <label className="text-sm text-[#334155] block">
              Wastage Reason
              <input
                type="text"
                value={wastageReason}
                onChange={(e) => setWastageReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                disabled={!isAdmin}
              />
            </label>
          )}

          <div className="rounded-lg border border-[#dceae4] bg-[#f7fcfa] px-3 py-2 text-xs text-[#64748b]">
            Delivery adds to Stock. Transfer moves Stock to Display without creating missing stock. Wastage permanently reduces usable stock and is logged.
          </div>

          {selectedOperationItem && (
            <p className="text-xs text-[#64748b]">
              Current split for {selectedOperationItem.sku}: Stock {snapshot.items.find((x) => x.sku === selectedOperationItem.sku)?.stockQty ?? 0} • Display {snapshot.items.find((x) => x.sku === selectedOperationItem.sku)?.displayQty ?? 0}
            </p>
          )}

          {operationMessage && <p className="text-xs text-[#64748b]">{operationMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Current Stock List</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[#64748b] mb-3">
            QR payload is the item SKU so scanners can reuse the same code format.
          </p>
          {snapshot.items.length === 0 ? (
            <p className="text-sm text-gray-600">No inventory items available yet.</p>
          ) : (
            <div className="space-y-2">
              {snapshot.items.map((item) => {
                const baseItem = items.find((source) => source.sku === item.sku)
                const safetyBuffer = baseItem?.safetyBuffer ?? 0
                const unit = baseItem?.unit ?? 'pcs'
                const category = baseItem?.category ?? 'Uncategorized'
                const isLow = item.confirmedAvailable <= safetyBuffer
                return (
                  <div
                    key={item.itemId}
                    className="rounded-lg border border-[#dceae4] bg-white px-3 py-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.sku} • {category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isLow ? 'warning' : 'success'}>
                          {item.confirmedAvailable} {unit}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button variant="outline" className="h-9" onClick={() => void handleGenerateQr(item.sku)}>
                        Generate QR
                      </Button>
                      <Button variant="outline" className="h-9" onClick={() => handleDownloadQr(item.sku)}>
                        Download
                      </Button>
                      <Button variant="outline" className="h-9" onClick={() => handlePrintQr(item.sku)}>
                        Print
                      </Button>
                      <Button variant="outline" className="h-9" onClick={() => handleRemoveQr(item.sku)} disabled={!isAdmin}>
                        Remove QR
                      </Button>
                      <Button variant="outline" className="h-9 border-red-300 text-red-700" onClick={() => handleDeleteItem(item.itemId)} disabled={!isAdmin}>
                        Delete Item
                      </Button>
                    </div>

                    {qrBySku[item.sku] && (
                      <div className="mt-3 rounded-lg border border-[#e2ece8] bg-[#f7fcfa] p-3 max-w-[300px]">
                        <img
                          src={qrBySku[item.sku]}
                          alt={`QR code for ${item.sku}`}
                          className="h-44 w-44 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {qrMessage && <p className="text-xs text-[#64748b] mt-3">{qrMessage}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export default InventoryPage