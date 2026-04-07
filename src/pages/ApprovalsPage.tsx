import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, EmptyState } from '@/components'
import { useActivityLogStore, useApprovalStore, useInventoryStore } from '@/store'
import { applyApprovalRecordToInventory } from '@/lib/approvalApplication'

const ApprovalsPage = () => {
  const records = useApprovalStore((state) => state.records)
  const createRecord = useApprovalStore((state) => state.createRecord)
  const approveRecord = useApprovalStore((state) => state.approveRecord)
  const rejectRecord = useApprovalStore((state) => state.rejectRecord)
  const clearResolved = useApprovalStore((state) => state.clearResolved)

  const items = useInventoryStore((state) => state.items)
  const setItems = useInventoryStore((state) => state.setItems)
  const addLogs = useActivityLogStore((state) => state.addLogs)

  const [manualSku, setManualSku] = useState('')
  const [manualDelta, setManualDelta] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [manualRequestOpen, setManualRequestOpen] = useState(false)

  const pendingRecords = useMemo(
    () => records.filter((record) => record.status === 'pending'),
    [records]
  )
  const resolvedRecords = useMemo(
    () => records.filter((record) => record.status !== 'pending').slice(0, 15),
    [records]
  )
  const pendingQueueRows = useMemo(
    () =>
      pendingRecords.flatMap((record) =>
        record.lineItems.map((line, index) => ({
          rowId: `${record.id}-${line.sku}-${index}`,
          recordId: record.id,
          createdAt: record.createdAt,
          line,
        }))
      ),
    [pendingRecords]
  )

  const handleApprove = (recordId: string) => {
    const record = records.find((item) => item.id === recordId)
    if (!record || record.status !== 'pending') return

    const result = applyApprovalRecordToInventory(record, items)
    setItems(result.nextItems)
    addLogs(
      record.lineItems.map((line) => ({
        user_id: 'admin-local',
        action_type: 'adjustment_applied' as const,
        item_id: line.itemId || line.sku,
        timestamp: Date.now(),
        details: `${record.type} ${record.id} delta=${line.delta}`,
      }))
    )
    approveRecord(record.id, `Applied ${result.appliedCount} change(s)`)

    if (result.warnings.length > 0) {
      setMessage(`Approved with warnings: ${result.warnings.join(' ')}`)
      return
    }

    setMessage(`Approved ${record.title}. Applied ${result.appliedCount} change(s).`)
  }

  const handleReject = (recordId: string) => {
    const record = records.find((item) => item.id === recordId)
    if (!record || record.status !== 'pending') return

    rejectRecord(record.id, 'Rejected by admin')
    setMessage(`Rejected ${record.title}. No inventory change applied.`)
  }

  const handleCreateManualAdjustment = (e: React.FormEvent) => {
    e.preventDefault()

    const sku = manualSku.trim().toUpperCase()
    const delta = Number.parseInt(manualDelta.trim(), 10)
    const reason = manualReason.trim()

    if (!sku || !Number.isInteger(delta) || delta === 0 || !reason) {
      setMessage('Manual adjustment requires SKU, non-zero delta, and reason.')
      return
    }

    const existing = items.find((item) => item.sku === sku)

    createRecord({
      type: 'manual_adjustment',
      title: `Manual Adjustment • ${sku}`,
      summary: reason,
      lineItems: [
        {
          itemId: existing?.id,
          sku,
          name: existing?.name || 'Unknown Item',
          delta,
          reason,
        },
      ],
    })

    setManualSku('')
    setManualDelta('')
    setManualReason('')
    setMessage('Manual adjustment request submitted for approval.')
    setManualRequestOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Approval Queue</h1>
          <p className="text-[#64748b]">Review pending discrepancies and manual adjustments before applying inventory changes.</p>
        </div>
        <Button
          type="button"
          className="self-start h-11"
          onClick={() => setManualRequestOpen(true)}
        >
          + Manual Request
        </Button>
      </div>

      <Dialog open={manualRequestOpen} onOpenChange={setManualRequestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual Adjustment Request</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form id="manual-adjustment-request-form" onSubmit={handleCreateManualAdjustment} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
                placeholder="SKU"
                className="rounded-xl border border-[#d3e6dd] bg-white px-3 py-2"
              />
              <input
                value={manualDelta}
                onChange={(e) => setManualDelta(e.target.value)}
                placeholder="Delta (e.g. -3, 5)"
                className="rounded-xl border border-[#d3e6dd] bg-white px-3 py-2"
              />
              <input
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Reason"
                className="rounded-xl border border-[#d3e6dd] bg-white px-3 py-2 md:col-span-3"
              />
            </form>
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-11 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Cancel
            </DialogClose>
            <Button type="submit" form="manual-adjustment-request-form" className="h-11">Submit Pending Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {message && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[#475569]">{message}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRecords.length === 0 ? (
            <div className="rounded-xl border border-[#d9eadf] bg-[#f6fcf8] px-4 py-10 text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#bde1d3] bg-white text-xl text-[#1e8572]">
                ✓
              </div>
              <p className="text-base font-semibold text-[#111827]">All caught up!</p>
              <p className="mt-1 text-sm text-[#64748b]">No pending approvals</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                    <th className="border-b border-[#dceae4] px-3 py-3 font-medium">SKU</th>
                    <th className="border-b border-[#dceae4] px-3 py-3 font-medium">Item Name</th>
                    <th className="border-b border-[#dceae4] px-3 py-3 font-medium">Adjustment Delta</th>
                    <th className="border-b border-[#dceae4] px-3 py-3 font-medium">Reason</th>
                    <th className="border-b border-[#dceae4] px-3 py-3 font-medium">Date</th>
                    <th className="border-b border-[#dceae4] px-3 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingQueueRows.map((row) => (
                    <tr key={row.rowId} className="bg-white/80">
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm font-semibold text-[#111827]">{row.line.sku}</td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#334155]">{row.line.name}</td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm">
                        <span className={`font-semibold ${row.line.delta > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {row.line.delta > 0 ? '+' : ''}{row.line.delta}
                        </span>
                      </td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#475569]">{row.line.reason}</td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#64748b]">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="border-b border-[#edf4f1] px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button className="h-9" onClick={() => handleApprove(row.recordId)}>Approve</Button>
                          <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => handleReject(row.recordId)}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <details className="group rounded-xl border border-[#dceae4] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#111827]">Resolved Records</p>
            <Badge variant="default">{resolvedRecords.length}</Badge>
          </div>
          <span className="text-xs text-[#64748b] transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-[#edf4f1] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">Latest approved/rejected records</p>
            {resolvedRecords.length > 0 && (
              <Button variant="outline" className="h-10" onClick={clearResolved}>
                Clear Resolved
              </Button>
            )}
          </div>
          {resolvedRecords.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="All caught up!"
              message="No resolved approval records yet."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              {resolvedRecords.map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-black">{record.title}</p>
                    <Badge variant={record.status === 'approved' ? 'success' : 'destructive'}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{record.reviewNote || 'No note'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

export default ApprovalsPage
