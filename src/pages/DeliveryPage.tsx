import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, AdminOnlyAction } from '@/components'
import { useAuthStore, useInventoryStore, useModeActions, useOfflineQueueStore, useApprovalStore } from '@/store'
import { verifyDeliverySession, type DeliverySessionData } from '@/lib/deliveryVerification'

interface DraftDeliveryLine {
  sku: string
  name: string
  expectedQty: number
}

interface DeliveryHistoryRow {
  delivery: DeliverySessionData
  statusLabel: 'Matched' | 'Discrepancy'
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

  const activeSession = selectedSession
  const hasActiveSession = Boolean(activeSession)

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

  const recentDeliveries = useMemo<DeliveryHistoryRow[]>(
    () =>
      deliverySessions.slice(0, 5).map((delivery) => {
        const deliveryReport = verifyDeliverySession(delivery, pendingScans)
        const hasDiscrepancy = deliveryReport.totals.discrepancyCount > 0 || deliveryReport.totals.wrongItemCount > 0

        return {
          delivery,
          statusLabel: hasDiscrepancy ? 'Discrepancy' : 'Matched',
        }
      }),
    [deliverySessions, pendingScans]
  )

  const totalPerformance = useMemo(() => {
    const pendingCount = deliverySessions.filter((session) => session.status === 'pending').length
    const completedCount = deliverySessions.filter((session) => session.status === 'completed').length
    const discrepancyCount = deliverySessions.reduce((count, session) => {
      const deliveryReport = verifyDeliverySession(session, pendingScans)
      const hasDiscrepancy =
        deliveryReport.totals.discrepancyCount > 0 || deliveryReport.totals.wrongItemCount > 0

      return hasDiscrepancy ? count + 1 : count
    }, 0)

    return { pendingCount, completedCount, discrepancyCount }
  }, [deliverySessions, pendingScans])

  const handleViewReport = (deliveryId: string) => {
    setSelectedSessionId(deliveryId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  if (!hasActiveSession) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Delivery Verification</h1>
          <p className="text-[#64748b]">Fast scan verification with real-time discrepancy detection.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <span>Create Delivery Ground Truth</span>
              <button
                type="button"
                aria-label="Ground truth help"
                title="Ground truth quantity is defined per delivery session here and is independent from current inventory stock quantity."
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#cfe3db] text-[11px] font-semibold text-[#1e8572]"
              >
                i
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Ground truth creation and approval submission are restricted to admins.
              </div>
            )}
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
                <AdminOnlyAction title="Only admins can modify delivery ground truth lines.">
                  <Button type="button" className="h-10" onClick={addDraftLine} disabled={inventoryItems.length === 0}>
                    Add Item
                  </Button>
                </AdminOnlyAction>
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
                        <AdminOnlyAction title="Only admins can remove ground truth lines.">
                          <Button variant="outline" className="h-8" onClick={() => removeDraftLine(line.sku)}>
                            Remove
                          </Button>
                        </AdminOnlyAction>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AdminOnlyAction title="Only admins can create delivery ground truth sessions.">
                <Button className="h-11" onClick={createDeliveryGroundTruth}>Save Ground Truth</Button>
              </AdminOnlyAction>
              {formMessage && <p className="text-xs text-[#64748b]">{formMessage}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Delivery Verification</h1>
        <p className="text-[#64748b]">Fast scan verification with real-time discrepancy detection.</p>
      </div>

      <Card className="border-[#bde1d3] bg-[#ebf7f2] shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[#1e8572]">Live Verification Bar</p>
              <h2 className="text-xl font-bold text-[#0f172a]">{activeSession?.id}</h2>
              <p className="text-sm text-[#64748b]">
                {activeSession?.date} • {activeSession?.supplier} • {activeSession?.expected.length} expected SKUs
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusColor(activeSession?.status || 'pending')}>
                {activeSession?.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
              </Badge>
              <Button variant="outline" className="h-11" onClick={startDeliveryScan}>
                Start Gatekeeper Scan
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
              <span className="text-[#1e8572]">●</span> Expected {report.totals.totalExpectedQty}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
              <span className="text-[#1e8572]">●</span> Actual {report.totals.totalActualQty}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
              <span className="text-[#1e8572]">●</span> Scans {scansForSessionCount}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
              <span className="text-[#1e8572]">●</span> {report.totals.discrepancyCount} discrepancies
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Verification Snapshot</p>
                  <p className="text-xs text-[#64748b]">Matched, shortage, and over-delivery are summarized below.</p>
                </div>
                <Badge variant="warning">Pending Approval</Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div className="overflow-hidden rounded-full bg-[#edf4f1]">
                  <div className="flex h-2 w-full">
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${Math.max(report.totals.matchedCount, 0) / Math.max(report.rows.length || 1, 1) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-amber-500"
                      style={{
                        width: `${Math.max(report.totals.shortageCount, 0) / Math.max(report.rows.length || 1, 1) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500"
                      style={{
                        width: `${Math.max(report.totals.overDeliveryCount + report.totals.wrongItemCount, 0) / Math.max(report.rows.length || 1, 1) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-green-700">Matched</p>
                    <p className="font-semibold text-green-700">{report.totals.matchedCount}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-amber-700">Shortage</p>
                    <p className="font-semibold text-amber-700">{report.totals.shortageCount}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-red-700">Over-Delivery</p>
                    <p className="font-semibold text-red-700">{report.totals.overDeliveryCount}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-red-700">Wrong Item</p>
                    <p className="font-semibold text-red-700">{report.totals.wrongItemCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <p className="text-sm font-semibold text-[#0f172a]">Live Rows</p>
              <div className="mt-3 max-h-[280px] space-y-2 overflow-auto pr-1">
                {report.rows.map((row) => (
                  <div
                    key={row.sku}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      row.status === 'matched'
                        ? 'border-green-200 bg-green-50'
                        : row.status === 'partial'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-black">{row.name}</p>
                      <p className="text-xs text-gray-600">{row.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Exp {row.expectedQty} • Act {row.actualQty}</p>
                      <p className={`text-xs font-semibold ${row.status === 'matched' ? 'text-green-700' : row.status === 'partial' ? 'text-amber-700' : 'text-red-700'}`}>
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
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Wrong Item Scans</p>
                    <div className="space-y-2">
                      {report.wrongItems.map((wrong) => (
                        <div key={wrong.sku} className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-3 py-2 text-sm">
                          <div>
                            <p className="font-semibold text-black">{wrong.sku}</p>
                            <p className="text-xs text-red-700">Not in expected delivery list</p>
                          </div>
                          <p className="font-bold text-red-700">{wrong.actualQty} scanned</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
        ) : null}
      </div>

      <Card className="bg-[#f8fcfa] border-[#dceae4]">
        <CardHeader className="flex flex-col gap-3 border-b border-[#dceae4] pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle as="h2">History Table</CardTitle>
            <p className="text-sm text-[#64748b]">Last 5 deliveries with a quick jump back into each report.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminOnlyAction title="Only admins can submit delivery discrepancies for approval.">
              <Button className="h-11" onClick={submitForApproval}>Submit For Approval</Button>
            </AdminOnlyAction>
            <Button variant="outline" className="h-11" onClick={() => navigate('/approvals')}>
              Open Approval Queue
            </Button>
          </div>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#dceae4] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Total Performance</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
            Sessions Pending <strong className="text-[#0f172a]">{totalPerformance.pendingCount}</strong>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
            Completed <strong className="text-[#0f172a]">{totalPerformance.completedCount}</strong>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]">
            Total Discrepancies <strong className="text-[#0f172a]">{totalPerformance.discrepancyCount}</strong>
          </span>
        </div>
        <CardContent className="p-0">
          {recentDeliveries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">No delivery history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                    <th className="px-4 py-3 font-medium">Delivery</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.map(({ delivery, statusLabel }) => (
                    <tr key={delivery.id} className="border-t border-[#dceae4] bg-white/70">
                      <td className="px-4 py-4 align-middle">
                        <div className="font-semibold text-[#0f172a]">{delivery.id}</div>
                        <div className="text-xs text-[#64748b]">{delivery.date}</div>
                      </td>
                      <td className="px-4 py-4 align-middle text-sm text-[#334155]">{delivery.supplier}</td>
                      <td className="px-4 py-4 align-middle">
                        <Badge variant={statusLabel === 'Discrepancy' ? 'warning' : 'success'}>{statusLabel}</Badge>
                      </td>
                      <td className="px-4 py-4 align-middle text-right">
                        <Button variant="outline" className="h-10" onClick={() => handleViewReport(delivery.id)}>
                          View Report
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {approvalMessage && <p className="px-4 py-4 text-xs text-gray-600">{approvalMessage}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export default DeliveryPage
