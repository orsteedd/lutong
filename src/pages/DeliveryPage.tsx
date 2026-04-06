import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components'
import { useAuthStore, useInventoryStore, useModeActions, useOfflineQueueStore, useApprovalStore } from '@/store'
import { verifyDeliverySession, type DeliverySessionData } from '@/lib/deliveryVerification'

interface DraftDeliveryLine {
  sku: string
  name: string
  expectedQty: number
}

const DELIVERY_GROUND_TRUTH_KEY = 'malatang.deliveryGroundTruthSessions.v1'

const DeliveryPage = () => {
  const navigate = useNavigate()
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768)
  const user = useAuthStore((state) => state.user)
  const { setMode } = useModeActions()
  const pendingScansState = useOfflineQueueStore((state) => state.pendingScans)
  const inventoryItemsState = useInventoryStore((state) => state.items)
  const createApprovalRecord = useApprovalStore((state) => state.createRecord)
  const [customSessions, setCustomSessions] = useState<DeliverySessionData[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [newSupplier, setNewSupplier] = useState('')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [draftSku, setDraftSku] = useState('')
  const [draftQty, setDraftQty] = useState('')
  const [draftLines, setDraftLines] = useState<DraftDeliveryLine[]>([])
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'

  const pendingScans = Array.isArray(pendingScansState) ? pendingScansState : []
  const inventoryItems = Array.isArray(inventoryItemsState) ? inventoryItemsState : []
  const selectedInventoryItem = useMemo(
    () => inventoryItems.find((item) => item.sku === draftSku),
    [draftSku, inventoryItems]
  )

  const deliverySessions = useMemo(() => [...customSessions], [customSessions])

  const nextDeliveryId = useMemo(() => {
    const used = new Set(deliverySessions.map((session) => session.id.toUpperCase()))
    const maxSeed = deliverySessions.reduce((max, session) => {
      const match = session.id.toUpperCase().match(/^DEL(\d+)$/)
      if (!match) return max
      const value = Number.parseInt(match[1], 10)
      return Number.isInteger(value) && value > max ? value : max
    }, 0)

    let candidate = maxSeed + 1
    while (used.has(`DEL${String(candidate).padStart(3, '0')}`)) {
      candidate += 1
    }

    return `DEL${String(candidate).padStart(3, '0')}`
  }, [deliverySessions])

  const selectedSession =
    deliverySessions.find((session) => session.id === selectedSessionId) ??
    deliverySessions[0]

  useEffect(() => {
    if (selectedSessionId || deliverySessions.length === 0) return
    setSelectedSessionId(deliverySessions[0].id)
  }, [deliverySessions, selectedSessionId])

  const report = useMemo(() => {
    if (!selectedSession) {
      return {
        sessionId: 'N/A',
        generatedAt: Date.now(),
        status: 'pending_approval' as const,
        rows: [],
        wrongItems: [],
        totals: {
          totalExpectedQty: 0,
          totalActualQty: 0,
          matchedCount: 0,
          partialCount: 0,
          discrepancyCount: 0,
          shortageCount: 0,
          overDeliveryCount: 0,
          wrongItemCount: 0,
        },
      }
    }

    return verifyDeliverySession(selectedSession, pendingScans)
  }, [pendingScans, selectedSession])

  const scansForSessionCount = pendingScans.filter(
    (scan) => scan.type === 'delivery' && scan.metadata?.sessionId === selectedSession?.id
  ).length

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DELIVERY_GROUND_TRUTH_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return

      const sanitized = parsed
        .filter((session): session is DeliverySessionData => {
          if (!session || typeof session !== 'object') return false
          const candidate = session as DeliverySessionData
          return (
            typeof candidate.id === 'string' &&
            typeof candidate.date === 'string' &&
            typeof candidate.supplier === 'string' &&
            (candidate.status === 'pending' || candidate.status === 'completed') &&
            Array.isArray(candidate.expected)
          )
        })
        .map((session) => ({
          ...session,
          expected: session.expected.filter(
            (line) =>
              typeof line.sku === 'string' &&
              typeof line.name === 'string' &&
              Number.isInteger(line.expectedQty) &&
              line.expectedQty > 0
          ),
        }))
        .filter((session) => session.expected.length > 0)

      setCustomSessions(sanitized)
    } catch {
      setCustomSessions([])
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DELIVERY_GROUND_TRUTH_KEY,
        JSON.stringify(customSessions)
      )
    } catch {
      // Ignore quota/storage access errors in private mode.
    }
  }, [customSessions])

  const addDraftLine = () => {
    const sku = draftSku.trim().toUpperCase()
    const qty = Number.parseInt(draftQty, 10)

    if (!sku) {
      setFormMessage('Select an item SKU first.')
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setFormMessage('Expected quantity must be greater than 0.')
      return
    }

    if (!selectedInventoryItem) {
      setFormMessage('SKU must come from an existing inventory item.')
      return
    }

    const itemName = selectedInventoryItem.name

    setDraftLines((prev) => {
      const existing = prev.find((line) => line.sku === sku)
      if (!existing) {
        return [...prev, { sku, name: itemName, expectedQty: qty }]
      }

      return prev.map((line) =>
        line.sku === sku
          ? { ...line, expectedQty: line.expectedQty + qty }
          : line
      )
    })

    setDraftQty('')
    setFormMessage(null)
  }

  const removeDraftLine = (sku: string) => {
    setDraftLines((prev) => prev.filter((line) => line.sku !== sku))
  }

  const createDeliveryGroundTruth = () => {
    const id = nextDeliveryId
    const supplier = newSupplier.trim()

    if (!supplier) {
      setFormMessage('Supplier is required.')
      return
    }

    if (draftLines.length === 0) {
      setFormMessage('Add at least one expected item for this delivery.')
      return
    }

    const session: DeliverySessionData = {
      id,
      supplier,
      date: newDate,
      status: 'pending',
      expected: draftLines,
    }

    setCustomSessions((prev) => [session, ...prev])
    setSelectedSessionId(id)
    setNewSupplier('')
    setNewDate(new Date().toISOString().slice(0, 10))
    setDraftSku('')
    setDraftQty('')
    setDraftLines([])
    setFormMessage(`Delivery ground truth ${id} created and selected.`)
  }

  const startDeliveryScan = () => {
    if (!selectedSession) {
      setFormMessage('Create a delivery ground truth first before scanning.')
      return
    }
    setMode('delivery')
    navigate(`/scan?mode=delivery&session=${selectedSession.id}`)
  }

  const submitForApproval = () => {
    if (!selectedSession) {
      setApprovalMessage('No delivery session selected.')
      return
    }

    const lineItems = [
      ...report.rows
        .filter((row) => row.variance !== 0)
        .map((row) => {
          const match = inventoryItems.find((item) => item.sku === row.sku)
          return {
            itemId: match?.id,
            sku: row.sku,
            name: row.name,
            delta: row.variance,
            reason: row.variance > 0 ? 'delivery overage' : 'delivery shortage',
          }
        }),
      ...report.wrongItems.map((wrong) => ({
        itemId: inventoryItems.find((item) => item.sku === wrong.sku)?.id,
        sku: wrong.sku,
        name: inventoryItems.find((item) => item.sku === wrong.sku)?.name || 'Unknown Item',
        delta: wrong.actualQty,
        reason: 'delivery wrong item',
      })),
    ]

    if (lineItems.length === 0) {
      setApprovalMessage('No discrepancies to submit for approval.')
      return
    }

    createApprovalRecord({
      type: 'delivery_discrepancy',
      title: `Delivery Discrepancy • ${selectedSession.id}`,
      summary: `${lineItems.length} discrepancy line(s) pending admin approval`,
      lineItems,
    })

    setApprovalMessage('Delivery discrepancy record queued for approval.')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'completed':
        return 'success'
      default:
        return 'default'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Delivery (Gatekeeper)</h1>
        <p className="text-[#64748b]">Fast scan verification with real-time discrepancy detection.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Create Delivery Ground Truth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Ground truth creation and approval submission are restricted to admins.
            </div>
          )}
          <p className="text-xs text-[#64748b]">
            Ground truth quantity is defined per delivery session here and is independent from current inventory stock quantity.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm text-[#334155]">
              Auto Delivery ID
              <input
                type="text"
                value={nextDeliveryId}
                readOnly
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-[#f8fbfa] px-3 py-2 text-[#64748b]"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Supplier
              <input
                type="text"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Supplier name"
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm text-[#334155]">
              Expected Arrival Date
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="rounded-xl border border-[#dceae4] bg-[#f7fcfa] p-3 space-y-3">
            <p className="text-sm font-semibold text-[#0f172a]">Expected Items</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3 items-end">
              <label className="text-sm text-[#334155]">
                Item
                <select
                  value={draftSku}
                  onChange={(e) => setDraftSku(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                  disabled={inventoryItems.length === 0 || !isAdmin}
                >
                  <option value="">{inventoryItems.length === 0 ? 'No inventory items available' : 'Select SKU'}</option>
                  {inventoryItems.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} • {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#334155]">
                Expected Qty
                <input
                  type="number"
                  min={1}
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-[#d6e8e0] bg-white px-3 py-2"
                  disabled={inventoryItems.length === 0 || !isAdmin}
                />
              </label>
              <Button type="button" className="h-10" onClick={addDraftLine} disabled={inventoryItems.length === 0 || !isAdmin}>
                Add Item
              </Button>
            </div>

            {inventoryItems.length === 0 && (
              <p className="text-xs text-amber-700">
                Add inventory items first before creating delivery SKUs.
              </p>
            )}

            {draftLines.length === 0 ? (
              <p className="text-xs text-[#64748b]">No expected items added yet.</p>
            ) : (
              <div className="space-y-2">
                {draftLines.map((line) => (
                  <div key={line.sku} className="flex items-center justify-between rounded-lg border border-[#d6e8e0] bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-black">{line.sku}</p>
                      <p className="text-xs text-gray-600">{line.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{line.expectedQty} expected</Badge>
                      <Button variant="outline" className="h-8" onClick={() => removeDraftLine(line.sku)} disabled={!isAdmin}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-11" onClick={createDeliveryGroundTruth} disabled={!isAdmin}>Save Ground Truth Delivery</Button>
            {formMessage && <p className="text-xs text-[#64748b]">{formMessage}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isMobileView ? (
          <>
            <Button variant="default" className="h-12" onClick={startDeliveryScan}>
              🚚 Start Gatekeeper Scan ({selectedSession?.id || 'No Session'})
            </Button>
            <Button
              variant="secondary"
              className="h-12"
              disabled={!selectedSession}
              onClick={() => {
                if (!selectedSession) return
                navigate(`/scan?mode=delivery&session=${selectedSession.id}`)
              }}
            >
              ⚡ Quick Open Scanner
            </Button>
          </>
        ) : (
          <div className="md:col-span-2 rounded-xl border border-[#dceae4] bg-[#f7fcfa] px-3 py-3 text-sm text-[#475569]">
            Scanner actions are available on mobile only.
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Delivery Session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deliverySessions.map((delivery) => (
              <button
                key={delivery.id}
                type="button"
                onClick={() => setSelectedSessionId(delivery.id)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selectedSession?.id === delivery.id
                    ? 'border-[#bde1d3] bg-[#ebf7f2]'
                    : 'border-[#dceae4] bg-white hover:border-[#b7dcca]'
                }`}
              >
                <p className="font-semibold text-black">{delivery.id}</p>
                <p className="text-xs text-gray-600">{delivery.date} • {delivery.expected.length} expected SKUs</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-600">Expected Qty</p>
              <p className="text-3xl font-bold text-black">{report.totals.totalExpectedQty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-600">Actual Qty</p>
              <p className="text-3xl font-bold text-black">{report.totals.totalActualQty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-600">Scans</p>
              <p className="text-3xl font-bold text-black">{scansForSessionCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-600">Report Status</p>
              <Badge variant="warning">Pending Approval</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active deliveries */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {deliverySessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No deliveries to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliverySessions.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-4 bg-[#f7fcfa] rounded-xl border border-[#dceae4]">
                  <div className="flex-1">
                    <div className="font-medium text-black">{delivery.id}</div>
                    <div className="text-sm text-gray-600">{delivery.date} • {delivery.supplier} • {delivery.expected.length} expected SKUs</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusColor(delivery.status)}>
                      {delivery.status === 'pending' ? '⏳ Pending' : '✓ Completed'}
                    </Badge>
                    <Button variant="outline" className="h-11" onClick={() => setSelectedSessionId(delivery.id)}>
                      View Session
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time expected vs actual */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Real-Time Verification • {selectedSession?.id || 'No Session'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-green-100 text-green-800 px-2 py-1">Green = Matched</span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-1">Yellow = Partial</span>
            <span className="rounded-full bg-red-100 text-red-800 px-2 py-1">Red = Discrepancy</span>
          </div>
          <div className="space-y-2">
            {report.rows.map((row) => (
              <div
                key={row.sku}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  row.status === 'matched'
                    ? 'border-green-200 bg-green-50'
                    : row.status === 'partial'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                }`}
              >
                <div>
                  <p className="font-medium text-black text-sm">{row.name}</p>
                  <p className="text-xs text-gray-600">{row.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-black">Exp {row.expectedQty} • Act {row.actualQty}</p>
                  <p
                    className={`text-xs font-semibold ${
                      row.status === 'matched'
                        ? 'text-green-700'
                        : row.status === 'partial'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {row.status === 'matched'
                      ? 'Matched'
                      : row.status === 'partial'
                        ? `Shortage ${Math.abs(row.variance)}`
                        : `Over +${row.variance}`}
                  </p>
                </div>
              </div>
            ))}

            {report.wrongItems.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800 mb-2">Wrong Item Scans</p>
                <div className="space-y-2">
                  {report.wrongItems.map((wrong) => (
                    <div key={wrong.sku} className="flex items-center justify-between rounded-lg bg-white border border-red-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-black">{wrong.sku}</p>
                        <p className="text-xs text-red-700">Not in expected delivery list</p>
                      </div>
                      <p className="text-sm font-bold text-red-700">{wrong.actualQty} scanned</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery report */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Delivery Report Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-700">Session: {report.sessionId}</p>
              <p className="text-xs text-gray-600">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
            <Badge variant="warning">Status: Pending Approval</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-gray-700">Matched</p>
              <p className="font-semibold text-green-700">{report.totals.matchedCount}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-gray-700">Shortage</p>
              <p className="font-semibold text-amber-700">{report.totals.shortageCount}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-gray-700">Over-Delivery</p>
              <p className="font-semibold text-red-700">{report.totals.overDeliveryCount}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-gray-700">Wrong Item</p>
              <p className="font-semibold text-red-700">{report.totals.wrongItemCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-11" onClick={submitForApproval} disabled={!isAdmin}>Submit For Approval</Button>
            <Button variant="outline" className="h-11" onClick={() => navigate('/approvals')}>
              Open Approval Queue
            </Button>
          </div>
          {approvalMessage && <p className="text-xs text-gray-600">{approvalMessage}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning mb-2">{deliverySessions.filter((s) => s.status === 'pending').length}</div>
              <p className="text-gray-600">Sessions Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success mb-2">{deliverySessions.filter((s) => s.status === 'completed').length}</div>
              <p className="text-gray-600">Sessions Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-black mb-2">{report.totals.discrepancyCount}</div>
              <p className="text-gray-600">Total Discrepancies</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#f8fcfa] border-[#dceae4]">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-[#0f172a] mb-3">Gatekeeper Flow</h3>
          <ol className="space-y-2 text-sm text-[#475569] list-decimal list-inside">
            <li>Select session</li>
            <li>Scan and verify in real time</li>
            <li>Submit report for approval</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

export default DeliveryPage
