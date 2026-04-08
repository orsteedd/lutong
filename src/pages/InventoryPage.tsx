import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AdminOnlyAction, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, EmptyState } from '@/components'
import { useAuthStore, useInventoryStore, useOfflineQueueStore } from '@/store'
import { useActivityLogStore } from '@/store/useActivityLogStore'
import { computeInventoryStateSnapshot } from '@/lib/inventoryState'
import { notifyError, notifyStaged, notifySuccess } from '@/lib/toastNotify'
import QRCode from 'qrcode'

type InventoryOperationMode = 'delivery' | 'transfer' | 'wastage'

const INVENTORY_DELIVERY_SESSION_PREFIX = 'INV-DEL'

const closeRowActionsMenu = (event: MouseEvent<HTMLButtonElement>) => {
  const details = event.currentTarget.closest('details')
  if (details instanceof HTMLDetailsElement) {
    details.removeAttribute('open')
  }
}

const buildSkuBadgeSvg = (sku: string) => {
  const safeSku = sku
    .trim()
    .toUpperCase()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="240" viewBox="0 0 420 240" role="img" aria-label="SKU ${safeSku}">
      <rect width="420" height="240" rx="28" fill="#ffffff"/>
      <rect x="20" y="20" width="380" height="200" rx="24" fill="#f8fbfa" stroke="#d6e8e0" stroke-width="2"/>
      <text x="210" y="84" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#64748b">SKU</text>
      <text x="210" y="148" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#111827">${safeSku}</text>
      <text x="210" y="182" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#475569">Malatang Inventory</text>
    </svg>
  `.trim()
}

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
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [quickAdjustmentModalOpen, setQuickAdjustmentModalOpen] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategoryFilter, setStockCategoryFilter] = useState('all')
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

  const stockCategories = useMemo(
    () => Array.from(new Set(items.map((item) => (typeof item.category === 'string' ? item.category.trim() : '')).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  )

  const filteredStockItems = useMemo(() => {
    const query = stockSearch.trim().toLowerCase()

    return snapshot.items.filter((item) => {
      const baseItem = items.find((source) => source.sku === item.sku)
      const category = baseItem?.category?.trim() || 'Uncategorized'
      const searchableText = `${item.name} ${item.sku} ${category}`.toLowerCase()
      const matchesSearch = query.length === 0 || searchableText.includes(query)
      const matchesCategory = stockCategoryFilter === 'all' || category === stockCategoryFilter

      return matchesSearch && matchesCategory
    })
  }, [items, snapshot.items, stockCategoryFilter, stockSearch])

  const nextSku = useMemo(() => {
    const used = new Set(
      items
        .map((item) => (typeof item.sku === 'string' ? item.sku : ''))
        .filter((sku) => sku.trim().length > 0)
        .map((sku) => sku.toUpperCase())
    )
    const maxSeed = items.reduce((max, item) => {
      const sku = typeof item.sku === 'string' ? item.sku : ''
      const match = sku.toUpperCase().match(/^SKU-(\d+)$/)
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

  useEffect(() => {
    const handleOutsideClick = (event: Event) => {
      const target = event.target
      if (!(target instanceof Node)) return

      document.querySelectorAll('details[data-qr-actions-menu][open]').forEach((menu) => {
        if (menu instanceof HTMLDetailsElement && !menu.contains(target)) {
          menu.removeAttribute('open')
        }
      })
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
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
      notifyError('Validation error', 'Item name, category, and unit are required.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setFormMessage('Quantity must be 0 or higher.')
      notifyError('Validation error', 'Quantity must be 0 or higher.')
      return
    }

    if (!Number.isInteger(safetyBuffer) || safetyBuffer < 0) {
      setFormMessage('Safety buffer must be 0 or higher.')
      notifyError('Validation error', 'Safety buffer must be 0 or higher.')
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
    notifySuccess('Item added', `Item added to inventory with SKU ${sku}.`)
  }

  const handleApplyOperation = () => {
    const qty = Number.parseInt(operationQty, 10)

    if (!selectedOperationItem) {
      setOperationMessage('Select an existing item first.')
      notifyError('Validation error', 'Select an existing item first.')
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setOperationMessage('Quantity must be greater than 0.')
      notifyError('Validation error', 'Quantity must be greater than 0.')
      return
    }

    if (operationMode === 'wastage' && !wastageReason.trim()) {
      setOperationMessage('Wastage reason is required.')
      notifyError('Validation error', 'Wastage reason is required.')
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
      notifyStaged('Staged', `Delivery queued for ${selectedOperationItem.sku} (+${qty}).`)
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
      notifyStaged('Staged', `Transfer queued for ${selectedOperationItem.sku} (${qty}).`)
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
      notifyStaged('Staged', `Wastage queued for ${selectedOperationItem.sku} (-${qty}).`)
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

  const handleDownloadQr = async (sku: string) => {
    const dataUrl = qrBySku[sku]
    if (dataUrl) {
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${sku}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setQrMessage(`QR downloaded for ${sku}.`)
      return
    }

    const svgMarkup = buildSkuBadgeSvg(sku)
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    try {
      const image = new Image()
      image.decoding = 'async'

      const pngUrl = await new Promise<string>((resolve, reject) => {
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 420
          canvas.height = 240
          const context = canvas.getContext('2d')

          if (!context) {
            reject(new Error('Canvas unavailable'))
            return
          }

          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('PNG generation failed'))
              return
            }

            resolve(URL.createObjectURL(blob))
          }, 'image/png')
        }

        image.onerror = () => reject(new Error('SVG rendering failed'))
        image.src = svgUrl
      })

      const link = document.createElement('a')
      link.href = pngUrl
      link.download = `${sku}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pngUrl)
      setQrMessage(`SKU image downloaded for ${sku}.`)
    } catch {
      const fallbackLink = document.createElement('a')
      fallbackLink.href = svgUrl
      fallbackLink.download = `${sku}.svg`
      document.body.appendChild(fallbackLink)
      fallbackLink.click()
      document.body.removeChild(fallbackLink)
      setQrMessage(`SVG downloaded for ${sku}.`)
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
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
    notifyError('Deleted', `Item ${item.sku} removed from inventory.`)
  }

  const handleOpenQuickAdjustment = (sku: string) => {
    setOperationSku(sku)
    setOperationQty('')
    setOperationMessage(null)
    setQuickAdjustmentModalOpen(true)
  }

  if (isMobileView) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Inventory</h1>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button variant="default" className="h-11" onClick={() => setAddItemModalOpen(true)} disabled={!isAdmin}>
              + Add New Item
            </Button>
          </div>
        </div>
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
            <p className="text-3xl font-bold text-black">{snapshot.totals.projectedStockQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-sky-700">Display</p>
            <p className="text-3xl font-bold text-sky-700">{snapshot.totals.projectedDisplayQty}</p>
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

      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {!isAdmin && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-[#f8fbfa] px-3 py-2 text-[#64748b]"
                />
              </label>
              <label className="text-sm text-[#334155]">
                Item Name
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Item name"
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
                  disabled={!isAdmin}
                />
              </label>
            </div>

            {formMessage && <p className="text-xs text-[#64748b]">{formMessage}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Cancel
            </DialogClose>
            <AdminOnlyAction title="Only admins can add inventory items.">
              <Button className="h-11" onClick={handleAddItem}>Add Item</Button>
            </AdminOnlyAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickAdjustmentModalOpen} onOpenChange={setQuickAdjustmentModalOpen}>
        <DialogContent className="w-[min(96vw,72rem)] max-w-none max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Quick Adjustment</DialogTitle>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d6e8e0] text-[10px] text-[#64748b]"
                title="Delivery adds to Stock. Transfer moves Stock to Display without creating missing stock. Wastage permanently reduces usable stock and is logged."
                aria-label="Quick adjustment instructions"
              >
                i
              </span>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-sm text-[#334155]">
                Item (SKU)
                <select
                  value={operationSku}
                  onChange={(e) => setOperationSku(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
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
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
                  disabled={!isAdmin}
                />
              </label>

              <div className="flex items-end md:col-span-4 md:justify-end">
                <AdminOnlyAction title="Only admins can apply inventory operations.">
                  <Button className="h-11 w-full whitespace-nowrap md:w-auto md:min-w-[220px]" onClick={handleApplyOperation}>
                    Apply Operation
                  </Button>
                </AdminOnlyAction>
              </div>
            </div>

            {operationMode === 'wastage' && (
              <label className="text-sm text-[#334155] block">
                Wastage Reason
                <input
                  type="text"
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 py-2"
                  disabled={!isAdmin}
                />
              </label>
            )}

            {selectedOperationItem && (
              <p className="text-xs text-[#64748b]">
                Current split for {selectedOperationItem.sku}: Stock {snapshot.items.find((x) => x.sku === selectedOperationItem.sku)?.projectedStockQty ?? 0} • Display {snapshot.items.find((x) => x.sku === selectedOperationItem.sku)?.projectedDisplayQty ?? 0}
              </p>
            )}

            {operationMessage && <p className="text-xs text-[#64748b]">{operationMessage}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-[#d6e8e0] shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle as="h2">Current Stock List</CardTitle>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d6e8e0] text-[10px] text-[#64748b]"
                title="QR payload is the item SKU so scanners can reuse the same code format."
                aria-label="Stock list instructions"
              >
                i
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:w-[420px]">
              <label className="flex-1">
                <span className="sr-only">Search stock items</span>
                <input
                  type="search"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Search name or SKU"
                  className="h-10 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 text-sm text-black placeholder:text-[#94a3b8]"
                />
              </label>
              <label className="sm:w-48">
                <span className="sr-only">Filter by category</span>
                <select
                  value={stockCategoryFilter}
                  onChange={(e) => setStockCategoryFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#d6e8e0] bg-white px-3 text-sm text-black"
                >
                  <option value="all">All categories</option>
                  {stockCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {snapshot.items.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No data"
              message="No inventory items available yet."
            />
          ) : filteredStockItems.length === 0 ? (
            <EmptyState
              icon="🔎"
              title="No data"
              message="No items match your search or category filter."
            />
          ) : (
            <div className="space-y-2">
              {filteredStockItems.map((item) => {
                const baseItem = items.find((source) => source.sku === item.sku)
                const safetyBuffer = baseItem?.safetyBuffer ?? 0
                const unit = baseItem?.unit ?? 'pcs'
                const category = baseItem?.category ?? 'Uncategorized'
                const isLow = item.confirmedAvailable <= safetyBuffer
                const canPrintQr = Boolean(qrBySku[item.sku])
                return (
                  <div
                    key={item.itemId}
                    className="rounded-xl border border-[#dceae4] bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-black">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {item.sku} • {category}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={isLow ? 'warning' : 'success'}>
                          {item.projectedAvailable} {unit}
                        </Badge>

                        <details className="relative" data-qr-actions-menu>
                          <summary className="list-none cursor-pointer rounded-xl border border-[#d6e8e0] bg-white px-3 py-2 text-sm font-medium text-black hover:bg-[#f3f7f5]">
                            Actions
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-xl border border-[#dceae4] bg-white p-1 shadow-lg">
                            <AdminOnlyAction title="Only admins can apply inventory operations.">
                              <button
                                type="button"
                                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-black hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:text-gray-400"
                                onClick={(event) => {
                                  handleOpenQuickAdjustment(item.sku)
                                  closeRowActionsMenu(event)
                                }}
                              >
                                Quick Adjustment
                              </button>
                            </AdminOnlyAction>
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-black hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:text-gray-400"
                              onClick={(event) => {
                                handleGenerateQr(item.sku)
                                closeRowActionsMenu(event)
                              }}
                            >
                              Generate QR
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-black hover:bg-[#f3f7f5]"
                              onClick={(event) => {
                                handleDownloadQr(item.sku)
                                closeRowActionsMenu(event)
                              }}
                            >
                              Download SKU
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-black hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:text-gray-400"
                              disabled={!canPrintQr}
                              onClick={(event) => {
                                handlePrintQr(item.sku)
                                closeRowActionsMenu(event)
                              }}
                            >
                              Print QR
                            </button>
                            <AdminOnlyAction title="Only admins can remove QR assignments.">
                              <button
                                type="button"
                                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-black hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:text-gray-400"
                                onClick={(event) => {
                                  handleRemoveQr(item.sku)
                                  closeRowActionsMenu(event)
                                }}
                              >
                                Remove QR
                              </button>
                            </AdminOnlyAction>
                            <AdminOnlyAction title="Only admins can delete inventory items.">
                              <button
                                type="button"
                                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                onClick={(event) => {
                                  handleDeleteItem(item.itemId)
                                  closeRowActionsMenu(event)
                                }}
                              >
                                Delete Item
                              </button>
                            </AdminOnlyAction>
                          </div>
                        </details>
                      </div>
                    </div>

                    {qrBySku[item.sku] && (
                      <div className="mt-3 rounded-xl border border-[#e2ece8] bg-[#f7fcfa] p-3 max-w-[300px]">
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