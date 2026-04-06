import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components'
import { useAuthStore, useOfflineQueueStore, useApprovalStore, useInventoryStore, useScanModeStore } from '@/store'
import { useActivityLogStore } from '@/store/useActivityLogStore'
import { clearAllLocalDatabase } from '@/lib/db'

const DELIVERY_GROUND_TRUTH_KEY = 'malatang.deliveryGroundTruthSessions.v1'

const AdminPage = () => {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const conflictResolutionLogs = useOfflineQueueStore((state) => state.conflictResolutionLogs)
  const clearConflictLogs = useOfflineQueueStore((state) => state.clearConflictLogs)
  const clearAllQueues = useOfflineQueueStore((state) => state.clearAllQueues)
  const clearItems = useInventoryStore((state) => state.clearItems)
  const clearResolvedApprovals = useApprovalStore((state) => state.clearResolved)
  const clearActivityLogs = useActivityLogStore((state) => state.clearLogs)
  const resetWorkflow = useScanModeStore((state) => state.resetWorkflow)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const handleClearLocalCache = async () => {
    if (!isAdmin) return

    const confirmed = window.confirm('Clear local queue/cache data only? This keeps inventory and approvals.')
    if (!confirmed) return

    clearAllQueues()
    clearConflictLogs()

    try {
      await clearAllLocalDatabase()
      setResetMessage('Local cache cleared. You can now run clean sync/error tests.')
    } catch {
      setResetMessage('Cache clear partially completed. Please refresh and retry if needed.')
    }
  }

  const handleResetApplication = async () => {
    if (!isAdmin) return

    const confirmed = window.confirm(
      'Reset application to fresh start? This removes inventory, queues, approvals, logs, and delivery sessions.'
    )
    if (!confirmed) return

    clearAllQueues()
    clearItems()
    clearResolvedApprovals()
    useApprovalStore.setState({ records: [] })
    clearActivityLogs()
    resetWorkflow()
    window.localStorage.removeItem(DELIVERY_GROUND_TRUTH_KEY)

    try {
      await clearAllLocalDatabase()
      setResetMessage('Application reset complete. Fresh local state is ready for testing.')
    } catch {
      setResetMessage('Reset partially completed. Please refresh and retry reset if needed.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Admin Panel</h1>
        <p className="text-[#64748b]">System controls.</p>
      </div>

      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="py-4">
            <p className="text-sm text-amber-900">
              This section is limited to admin users. Current session: {user?.username || 'unknown'} ({user?.role || 'unknown'}).
            </p>
          </CardContent>
        </Card>
      )}

      <Button variant="default" className="w-full h-12" disabled={!isAdmin}>
        Open Settings
      </Button>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Conflict Resolution Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">Recent automatic conflict handling decisions.</p>
            {conflictResolutionLogs.length > 0 && (
              <Button variant="outline" className="h-10" onClick={clearConflictLogs} disabled={!isAdmin}>
                Clear Logs
              </Button>
            )}
          </div>

          {conflictResolutionLogs.length === 0 ? (
            <p className="text-xs text-gray-600">No conflict events logged yet.</p>
          ) : (
            <div className="space-y-2">
              {conflictResolutionLogs.slice(0, 20).map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                    {event.conflictType.replaceAll('_', ' ')}
                  </p>
                  <p className="text-sm text-black">{event.message}</p>
                  <p className="text-xs text-gray-600 mt-1">SKU: {event.sku}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">👥 Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#64748b] text-sm">Manage user access</p>
            <Button variant="outline" className="w-full h-12" disabled={!isAdmin}>
              Manage Users
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">⚙️ Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-600 text-sm">Adjust app settings</p>
            <Button variant="secondary" className="w-full h-12" disabled={!isAdmin}>
              More Settings
            </Button>
          </CardContent>
        </Card>

        {/* Sync */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">🔄 Data Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#64748b] text-sm">Review offline sync</p>
            <Button variant="outline" className="w-full h-12" disabled={!isAdmin}>
              Sync Options
            </Button>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">💾 Database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#64748b] text-sm">Manage local data</p>
            <Button variant="outline" className="w-full h-12" disabled={!isAdmin}>
              Database Tools
            </Button>
          </CardContent>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">📦 Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#64748b] text-sm">Create or restore backup</p>
            <Button variant="outline" className="w-full h-12" disabled={!isAdmin}>
              Backup Tools
            </Button>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle as="h3">ℹ️ System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#64748b] text-sm">Version and diagnostics</p>
            <Button variant="outline" className="w-full h-12" disabled={!isAdmin}>
              View Details
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Stats */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Local Storage Used</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">2.4</span>
                <span className="text-gray-600">MB / 50 MB</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Offline Cache</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">1,234</span>
                <span className="text-gray-600">items cached</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Sync</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">12</span>
                <span className="text-gray-600">changes</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dangerous Zone */}
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle as="h3" className="text-red-900">⚠️ Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3">
            <Button variant="secondary" className="w-full h-12" onClick={() => void handleClearLocalCache()} disabled={!isAdmin}>
              Clear Local Cache
            </Button>
            <Button variant="destructive" className="w-full h-12" onClick={() => void handleResetApplication()} disabled={!isAdmin}>
              Reset Application
            </Button>
          </div>
          <p className="text-xs text-red-800">These actions cannot be undone. Use with caution.</p>
          {resetMessage && <p className="text-xs text-red-900">{resetMessage}</p>}
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-[#f8fcfa] border-[#dceae4]">
        <CardHeader>
          <CardTitle as="h3">About Malatang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#64748b]">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Built with:</strong> React + Vite + TypeScript + Tailwind</p>
          <p><strong>Storage:</strong> IndexedDB (Dexie)</p>
          <p><strong>State:</strong> Zustand</p>
          <p><strong>Offline First:</strong> Yes ✓</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminPage
