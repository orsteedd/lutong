import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, AdminOnlyAction } from '@/components'
import { useAuthStore, useApprovalStore, useInventoryStore, useModeActions, useOfflineQueueStore } from '@/store'
import { buildAuditDiscrepancyReport } from '@/lib/auditDiscrepancy'

interface AuditSessionSummary {
  id: string
  lastScannedAt: number
  scanCount: number
  discrepancyCount: number
  status: 'pending' | 'completed'
}

const EMPTY_AUDIT_REPORT = {
  sessionId: '',
  generatedAt: 0,
  discrepancies: [],
  totals: {
    systemQty: 0,
    actualQty: 0,
    missingCount: 0,
    excessCount: 0,
    discrepancyCount: 0,
  },
}

const AuditPage = () => {
  const navigate = useNavigate()
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768)
  const user = useAuthStore((state) => state.user)
  const { setMode } = useModeActions()
  const pendingScansState = useOfflineQueueStore((state) => state.pendingScans)
  const inventoryItemsState = useInventoryStore((state) => state.items)
  const createApprovalRecord = useApprovalStore((state) => state.createRecord)
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [activeDiscrepancyIndex, setActiveDiscrepancyIndex] = useState(0)
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'

  const auditSections = ['Freezer', 'Dry Storage', 'Cooler', 'Pantry', 'Back Dock', 'Under Counter'] as const

  const getSectionIcon = (section: string) => {
    const icons: Record<string, string> = {
      'Freezer': '🧊',
      'Dry Storage': '📦',
      'Cooler': '❄️',
      'Pantry': '🗃️',
      'Back Dock': '🚪',
      'Under Counter': '📋',
    }
    return icons[section] || '📍'
  }

  const pendingScans = Array.isArray(pendingScansState) ? pendingScansState : []
  const inventoryItems = Array.isArray(inventoryItemsState) ? inventoryItemsState : []

  const auditSessions = useMemo<AuditSessionSummary[]>(() => {
    const grouped = new Map<string, { lastScannedAt: number; scanCount: number }>()

    for (const scan of pendingScans) {
      if (scan.type !== 'audit') continue
      const sessionId = scan.metadata?.sessionId?.trim()
      if (!sessionId) continue

      const current = grouped.get(sessionId)
      if (!current) {
        grouped.set(sessionId, {
          lastScannedAt: scan.timestamp,
          scanCount: 1,
        })
        continue
      }

      grouped.set(sessionId, {
        lastScannedAt: Math.max(current.lastScannedAt, scan.timestamp),
        scanCount: current.scanCount + 1,
      })
    }

    return Array.from(grouped.entries())
      .map(([id, meta]) => {
        const reportForSession = buildAuditDiscrepancyReport(inventoryItems, pendingScans, id)
        const discrepancyCount = reportForSession.discrepancies.length
        return {
          id,
          lastScannedAt: meta.lastScannedAt,
          scanCount: meta.scanCount,
          discrepancyCount,
          status: discrepancyCount > 0 ? ('pending' as const) : ('completed' as const),
        }
      })
      .sort((a, b) => b.lastScannedAt - a.lastScannedAt)
  }, [inventoryItems, pendingScans])

  const selectedAudit = auditSessions.find((audit) => audit.id === selectedAuditId) ?? auditSessions[0]
  const hasStartedAudit = selectedSection || selectedAudit
  const report = useMemo(
    () =>
      selectedAudit
        ? buildAuditDiscrepancyReport(inventoryItems, pendingScans, selectedAudit.id)
        : EMPTY_AUDIT_REPORT,
    [inventoryItems, pendingScans, selectedAudit]
  )
  const safeActiveIndex = Math.min(
    activeDiscrepancyIndex,
    Math.max(report.discrepancies.length - 1, 0)
  )

  const activeDiscrepancy = report.discrepancies[safeActiveIndex]
  const canGoPrev = safeActiveIndex > 0
  const canGoNext = safeActiveIndex < report.discrepancies.length - 1

  const movePrev = () => {
    if (!canGoPrev) return
    setActiveDiscrepancyIndex(safeActiveIndex - 1)
  }

  const moveNext = () => {
    if (!canGoNext) return
    setActiveDiscrepancyIndex(safeActiveIndex + 1)
  }

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (selectedAuditId && auditSessions.some((session) => session.id === selectedAuditId)) {
      return
    }

    setSelectedAuditId(auditSessions[0]?.id ?? '')
    setActiveDiscrepancyIndex(0)
  }, [auditSessions, selectedAuditId])

  const nextAuditSessionId = useMemo(() => {
    const used = new Set(auditSessions.map((session) => session.id.toUpperCase()))
    const maxSeed = auditSessions.reduce((max, session) => {
      const match = session.id.toUpperCase().match(/^AUD(\d+)$/)
      if (!match) return max
      const value = Number.parseInt(match[1], 10)
      return Number.isInteger(value) && value > max ? value : max
    }, 0)

    let candidate = maxSeed + 1
    while (used.has(`AUD${String(candidate).padStart(3, '0')}`)) {
      candidate += 1
    }

    return `AUD${String(candidate).padStart(3, '0')}`
  }, [auditSessions])

  const startAuditScan = () => {
    const targetSessionId = selectedAudit?.id || nextAuditSessionId
    setMode('audit')
    setSelectedAuditId(targetSessionId)
    navigate(`/scan?mode=audit&session=${targetSessionId}`)
  }

  const submitForApproval = () => {
    if (report.discrepancies.length === 0) {
      setApprovalMessage('No discrepancies to submit for approval.')
      return
    }

    createApprovalRecord({
      type: 'audit_discrepancy',
      title: `Audit Discrepancy • ${selectedAudit?.id || 'N/A'}`,
      summary: `${report.discrepancies.length} discrepancy line(s) pending admin approval`,
      lineItems: report.discrepancies.map((row) => ({
        itemId: inventoryItems.find((item) => item.sku === row.sku)?.id,
        sku: row.sku,
        name: row.name,
        delta: row.difference,
        reason: row.difference_type,
      })),
    })

    setApprovalMessage('Audit discrepancy record queued for approval.')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a]">Audit</h1>
          <span
            title="Discrepancies are determined by comparing physical counts against system inventory. Audits help verify stock accuracy across all warehouse sections."
            className="inline-flex items-center justify-center w-6 h-6 text-sm font-bold text-[#64748b] border border-[#dceae4] rounded-full hover:bg-[#f7fcfa] cursor-help transition-colors"
          >
            ?
          </span>
        </div>
        <p className="text-[#64748b]">Select a section to audit, count items, and compare with system.</p>
      </div>

      {/* Hero Section: Sections to Audit */}
      <Card className="border-[#bde1d3] bg-[#ebf7f2]">
        <CardHeader>
          <CardTitle as="h2">Start Audit</CardTitle>
          <p className="text-sm text-[#64748b] mt-2">Choose a section to begin the physical count verification.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditSections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setSelectedSection(section)}
                className={`rounded-xl border-2 p-5 text-left transition-all ${
                  selectedSection === section
                    ? 'border-[#1e8572] bg-white shadow-lg'
                    : 'border-[#dceae4] bg-white hover:border-[#1e8572] hover:shadow-md'
                }`}
              >
                <div className="text-3xl mb-3">{getSectionIcon(section)}</div>
                <p className="font-semibold text-[#0f172a] text-lg">{section}</p>
                <p className="text-xs text-[#64748b] mt-1">Start new audit</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {isMobileView && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="default" className="h-12" onClick={startAuditScan}>
            🔍 Scan {selectedAudit?.id || nextAuditSessionId}
          </Button>
          <Button variant="secondary" className="h-12" onClick={startAuditScan}>
            📊 Open Audit Scanner
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">{auditSessions.length}</div>
              <p className="text-gray-600">Audits This Month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-700 mb-2">{report.totals.missingCount}</div>
              <p className="text-gray-600">Missing Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-700 mb-2">{report.totals.excessCount}</div>
              <p className="text-gray-600">Excess Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit History Table */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Audit History</CardTitle>
          <p className="text-sm text-[#64748b] mt-2">All audits with status and action tracking.</p>
        </CardHeader>
        <CardContent>
          {auditSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No audits yet. Start a scan to create {nextAuditSessionId}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dceae4]">
                    <th className="text-left py-3 px-3 font-semibold text-[#0f172a]">Session ID</th>
                    <th className="text-left py-3 px-3 font-semibold text-[#0f172a]">Last Scanned</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#0f172a]">Scans</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#0f172a]">Discrepancies</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#0f172a]">Status</th>
                    <th className="text-right py-3 px-3 font-semibold text-[#0f172a]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dceae4]">
                  {auditSessions.map((audit) => (
                    <tr key={audit.id} className="hover:bg-[#f7fcfa] transition-colors">
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAuditId(audit.id)
                            setActiveDiscrepancyIndex(0)
                          }}
                          className="font-semibold text-primary hover:underline text-left"
                        >
                          {audit.id}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {new Date(audit.lastScannedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-700">
                        {audit.scanCount}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-semibold ${
                          audit.discrepancyCount > 0 ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {audit.discrepancyCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={audit.status === 'pending' ? 'warning' : 'success'}>
                          {audit.status === 'pending' ? '⏳ In Progress' : '✓ Completed'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="outline"
                          className="h-9 text-xs"
                          onClick={() => {
                            setSelectedAuditId(audit.id)
                            setActiveDiscrepancyIndex(0)
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {hasStartedAudit && (
      <>
      <Card className={report.discrepancies.length > 0 ? 'border-red-200' : 'border-green-200'}>
        <CardHeader>
          <CardTitle as="h2">Audit Discrepancy Engine • {selectedAudit?.id || 'No Session Selected'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Approval submission is restricted to admins.
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-red-100 text-red-800 px-2 py-1">Red = Missing Stock</span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-1">Yellow = Excess Stock</span>
            <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-1">All discrepancies are pending approval</span>
          </div>

          {!selectedAudit && (
            <div className="rounded-lg border border-[#dceae4] bg-[#f7fcfa] p-4 mb-3">
              <p className="font-semibold text-[#334155]">No audit session selected.</p>
              <p className="text-sm text-[#64748b]">Run an audit scan first to generate a session and comparison report.</p>
            </div>
          )}

          {report.discrepancies.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-800">No discrepancies found.</p>
              <p className="text-sm text-green-700">System quantity and physical count are currently aligned.</p>
              <p className="text-xs text-green-700 mt-1">
                System total: {report.totals.systemQty} • Actual total: {report.totals.actualQty}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-sm text-gray-700">
                  Discrepancies: <span className="font-semibold text-black">{report.discrepancies.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Pending Approval</Badge>
                  <AdminOnlyAction title="Only admins can submit approval requests.">
                    <Button className="h-9" onClick={submitForApproval}>Submit</Button>
                  </AdminOnlyAction>
                  <Button
                    variant="outline"
                    className="h-9 border-gray-300 text-black"
                    onClick={() => navigate('/approvals')}
                  >
                    Queue
                  </Button>
                </div>
              </div>
              {approvalMessage && <p className="text-xs text-gray-600">{approvalMessage}</p>}

              {activeDiscrepancy && (
                <div
                  className={`rounded-lg border p-3 ${
                    activeDiscrepancy.difference_type === 'missing'
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-gray-600">
                    Focus Item {safeActiveIndex + 1} of {report.discrepancies.length}
                  </p>
                  <p className="font-semibold text-black">{activeDiscrepancy.name}</p>
                  <p className="text-xs text-gray-600">{activeDiscrepancy.sku} • Item ID: {activeDiscrepancy.item_id}</p>
                  <p className="text-sm mt-1 text-black">
                    System {activeDiscrepancy.system_qty} • Actual {activeDiscrepancy.actual_qty} • Difference {activeDiscrepancy.difference > 0 ? '+' : ''}{activeDiscrepancy.difference}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-10" onClick={movePrev} disabled={!canGoPrev}>
                  Prev
                </Button>
                <Button variant="outline" className="h-10" onClick={moveNext} disabled={!canGoNext}>
                  Next
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {report.discrepancies.map((item, index) => (
                  <button
                    key={`${item.item_id}-${item.sku}`}
                    type="button"
                    onClick={() => setActiveDiscrepancyIndex(index)}
                    className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                      index === activeDiscrepancyIndex
                        ? 'border-primary bg-primary/10 text-primary'
                        : item.difference_type === 'missing'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.sku}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {report.discrepancies.map((row, index) => (
                  <div
                    key={`${row.item_id}-${row.sku}-row`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      row.difference_type === 'missing'
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    } ${index === safeActiveIndex ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    <div>
                      <p className="font-medium text-black text-sm">{row.name}</p>
                      <p className="text-xs text-gray-600">item_id: {row.item_id}</p>
                      <p className="text-xs text-gray-600">status: pending approval</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-black">system_qty {row.system_qty} • actual_qty {row.actual_qty}</p>
                      <p
                        className={`font-semibold ${
                          row.difference_type === 'missing' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        difference {row.difference > 0 ? '+' : ''}{row.difference}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Discrepancy Output</CardTitle>
        </CardHeader>
        <CardContent>
          {report.discrepancies.length === 0 ? (
            <p className="text-sm text-gray-600">No discrepancy output for this audit session.</p>
          ) : (
            <div className="space-y-2">
              {report.discrepancies.map((row) => (
                <div key={`${row.item_id}-${row.sku}-output`} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-mono text-xs text-gray-700">
                    item_id: {row.item_id} | system_qty: {row.system_qty} | actual_qty: {row.actual_qty} | difference: {row.difference > 0 ? '+' : ''}{row.difference}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">status: pending approval</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {!hasStartedAudit && (
      <Card className="border-[#dceae4] bg-[#f7fcfa]">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-[#334155] mb-2">Ready to Audit?</p>
            <p className="text-xs text-[#64748b]">Select a section above or open an existing audit session to begin verification.</p>
          </div>
        </CardContent>
      </Card>
      )}

    </div>
  )
}

export default AuditPage
