import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
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

  const pendingRecords = useMemo(
    () => records.filter((record) => record.status === 'pending'),
    [records]
  )
  const resolvedRecords = useMemo(
    () => records.filter((record) => record.status !== 'pending').slice(0, 15),
    [records]
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Approval Queue</h1>
        <p className="text-[#64748b]">Review pending discrepancies and manual adjustments before applying inventory changes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Manual Adjustment Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateManualAdjustment} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              placeholder="SKU"
              className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
            />
            <input
              value={manualDelta}
              onChange={(e) => setManualDelta(e.target.value)}
              placeholder="Delta (e.g. -3, 5)"
              className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
            />
            <input
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Reason"
              className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
            />
            <Button type="submit" className="h-11">Submit Pending Request</Button>
          </form>
        </CardContent>
      </Card>

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
            <p className="text-sm text-[#64748b]">No pending records.</p>
          ) : (
            <div className="space-y-3">
              {pendingRecords.map((record) => (
                <div key={record.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-black">{record.title}</p>
                      <p className="text-xs text-gray-600">{record.summary}</p>
                    </div>
                    <Badge variant="warning">pending</Badge>
                  </div>

                  <div className="mt-2 space-y-1">
                    {record.lineItems.map((line, idx) => (
                      <p key={`${record.id}-${line.sku}-${idx}`} className="text-xs text-gray-700">
                        {line.sku} • {line.name} • delta {line.delta > 0 ? '+' : ''}{line.delta} • {line.reason}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button className="h-10" onClick={() => handleApprove(record.id)}>Approve</Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => handleReject(record.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Resolved Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Latest approved/rejected records</p>
            <Button variant="outline" className="h-10" onClick={clearResolved}>
              Clear Resolved
            </Button>
          </div>
          {resolvedRecords.length === 0 ? (
            <p className="text-sm text-gray-600">No resolved records.</p>
          ) : (
            <div className="space-y-2">
              {resolvedRecords.map((record) => (
                <div key={record.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-black">{record.title}</p>
                    <Badge variant={record.status === 'approved' ? 'success' : 'destructive'}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{record.reviewNote || 'No note'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ApprovalsPage
