import { useMemo, useState } from 'react'
import { AdminOnlyAction, Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
import { useActivityLogStore, useAuthStore, type ActivityActionType } from '@/store'

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

  const [actionFilter, setActionFilter] = useState<'all' | ActivityActionType>('all')
  const [itemFilter, setItemFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Activity Logs</h1>
        <p className="text-[#64748b]">Trace scan, adjustment, and approval events for debugging and accountability.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as 'all' | ActivityActionType)}
            className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
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
            className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
          />

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-[#d3e6dd] bg-white px-3 py-2"
          />

          <Button
            variant="outline"
              className="h-11"
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Clearing activity logs is restricted to admins.
            </div>
          )}
          <div className="flex justify-end">
            <AdminOnlyAction title="Only admins can clear activity logs.">
              <Button variant="outline" className="h-10" onClick={clearLogs}>
                Clear All Logs
              </Button>
            </AdminOnlyAction>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-sm text-[#64748b]">No logs match current filters.</p>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-600">
                    {new Date(log.timestamp).toLocaleString()} • user_id: {log.user_id}
                  </p>
                  <p className="text-sm font-semibold text-black mt-1">
                    action_type: {log.action_type}
                  </p>
                  <p className="text-sm text-gray-800">item_id: {log.item_id}</p>
                  {log.details && <p className="text-xs text-gray-600 mt-1">{log.details}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ActivityLogPage
