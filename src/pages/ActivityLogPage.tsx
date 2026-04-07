import { useMemo, useState } from 'react'
import { AdminOnlyAction, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components'
import { useActivityLogStore, useAuthStore, useOfflineQueueStore, type ActivityActionType } from '@/store'

const ACTION_OPTIONS: Array<{ value: 'all' | ActivityActionType; label: string }> = [
  { value: 'all', label: 'All Actions' },
  { value: 'scan_recorded', label: 'Scans' },
  { value: 'adjustment_requested', label: 'Adjustment Requested' },
  { value: 'adjustment_applied', label: 'Adjustment Applied' },
  { value: 'approval_submitted', label: 'Approval Submitted' },
  { value: 'approval_approved', label: 'Approval Approved' },
  { value: 'approval_rejected', label: 'Approval Rejected' },
  { value: 'inventory_item_deleted', label: 'Inventory Item Deleted' },
]

const ActivityLogPage = () => {
  const user = useAuthStore((state) => state.user)
  const logs = useActivityLogStore((state) => state.logs)
  const clearLogs = useActivityLogStore((state) => state.clearLogs)
  const isAdmin = user?.role === 'admin'
  const pendingScans = useOfflineQueueStore((state) => state.pendingScans)
  const wastageLogs = useOfflineQueueStore((state) => state.wastageLogs)
  const transferLogs = useOfflineQueueStore((state) => state.transferLogs)
  const isSyncing = useOfflineQueueStore((state) => state.isSyncing)
  const syncStatus = useOfflineQueueStore((state) => state.syncStatus)

  const [actionFilter, setActionFilter] = useState<'all' | ActivityActionType>('all')
  const [itemFilter, setItemFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const safePendingScans = Array.isArray(pendingScans) ? pendingScans : []
  const safeWastageLogs = Array.isArray(wastageLogs) ? wastageLogs : []
  const safeTransferLogs = Array.isArray(transferLogs) ? transferLogs : []

  const pendingSyncCount = useMemo(
    () =>
      safePendingScans.filter((item) => !item.synced).length +
      safeWastageLogs.filter((item) => !item.synced).length +
      safeTransferLogs.filter((item) => !item.synced).length,
    [safePendingScans, safeTransferLogs, safeWastageLogs]
  )

  const syncState: 'synced' | 'pending' | 'error' = useMemo(() => {
    if (syncStatus === 'error') return 'error'
    if (isSyncing || pendingSyncCount > 0 || syncStatus === 'pending') return 'pending'
    return 'synced'
  }, [isSyncing, pendingSyncCount, syncStatus])

  const statusDotClass =
    syncState === 'error'
      ? 'bg-red-500'
      : syncState === 'pending'
        ? 'bg-amber-500'
        : 'bg-[#B91C1C]'

  const statusButtonClass =
    syncState === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : syncState === 'pending'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-[#F3C4C4] bg-[#FDECEC] text-[#B91C1C]'

  const filteredLogs = useMemo(() => {
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null
    const normalizedItem = itemFilter.trim().toLowerCase()

    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action_type !== actionFilter) return false
      if (normalizedItem && !log.item_id.toLowerCase().includes(normalizedItem)) return false
      if (fromTs !== null && log.timestamp < fromTs) return false
      if (toTs !== null && log.timestamp > toTs) return false
      return true
    })
  }, [actionFilter, fromDate, itemFilter, logs, toDate])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Activity</h1>
          <p className="text-[#64748b]">Trace scan, adjustment, and approval events for debugging and accountability.</p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${statusButtonClass}`}
          title={syncState === 'synced' ? 'System ready' : `Sync pending for ${pendingSyncCount} record(s)`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} aria-hidden="true" />
          <span>System Status</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as 'all' | ActivityActionType)}
            className="h-9 min-w-[170px] rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            placeholder="Filter by item_id"
            className="h-9 min-w-[190px] rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
          />

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
          />

          <Button
            variant="default"
            size="sm"
            className="h-9"
            onClick={() => {
              setActionFilter('all')
              setItemFilter('')
              setFromDate('')
              setToDate('')
            }}
          >
            Reset Filters
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Log Viewer ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isAdmin && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Clearing activity logs is restricted to admins.
            </div>
          )}

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon="🗂"
              title="All caught up!"
              message="No matching activity entries. Try adjusting filters or date range."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#dceae4] bg-white">
              <table className="w-full min-w-[980px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                    <th className="border-b border-[#dceae4] bg-[#f8fcfa] px-3 py-3 font-medium">Timestamp</th>
                    <th className="border-b border-[#dceae4] bg-[#f8fcfa] px-3 py-3 font-medium">User/Device</th>
                    <th className="border-b border-[#dceae4] bg-[#f8fcfa] px-3 py-3 font-medium">Action Type</th>
                    <th className="border-b border-[#dceae4] bg-[#f8fcfa] px-3 py-3 font-medium">Item/SKU</th>
                    <th className="border-b border-[#dceae4] bg-[#f8fcfa] px-3 py-3 font-medium">Details/Change</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#334155]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#334155]">
                        {log.user_id}
                      </td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm font-medium text-[#111827]">
                        {log.action_type.replaceAll('_', ' ')}
                      </td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#334155]">
                        {log.item_id}
                      </td>
                      <td className="border-b border-[#edf4f1] px-3 py-3 text-sm text-[#475569]">
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50/40">
        <CardHeader>
          <CardTitle as="h2" className="text-[#111827]">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-red-800">Clearing logs permanently removes local activity history.</p>
            <AdminOnlyAction title="Only admins can clear activity logs.">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-red-300 text-red-700 hover:bg-red-100"
                onClick={clearLogs}
                disabled={logs.length === 0}
              >
                Clear All Logs
              </Button>
            </AdminOnlyAction>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ActivityLogPage
