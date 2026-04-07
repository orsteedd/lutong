import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components'
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false)
  const [showRecentEvents, setShowRecentEvents] = useState(false)
  const scanQueue = useOfflineQueueStore((state) => state.scanQueue)
  const wastageLogs = useOfflineQueueStore((state) => state.wastageLogs)
  const transferLogs = useOfflineQueueStore((state) => state.transferLogs)
  const pendingSyncCount = useOfflineQueueStore((state) => state.totalPendingCount())

  const localStorageLimitMb = 50
  const localStorageUsage = useMemo(() => {
    if (typeof window === 'undefined') return { usedMb: 0, usedPercent: 0 }

    let usedBytes = 0
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      const value = window.localStorage.getItem(key) || ''
      usedBytes += new Blob([key, value]).size
    }

    const usedMb = usedBytes / (1024 * 1024)
    return {
      usedMb,
      usedPercent: Math.min((usedMb / localStorageLimitMb) * 100, 100),
    }
  }, [])

  const offlineCacheCount = scanQueue.length + wastageLogs.length + transferLogs.length

  useEffect(() => {
    if (conflictResolutionLogs.length === 0) {
      setShowRecentEvents(false)
    }
  }, [conflictResolutionLogs.length])

  const executeClearLocalCache = async () => {
    if (!isAdmin) return

    clearAllQueues()
    clearConflictLogs()

    try {
      await clearAllLocalDatabase()
      setResetMessage('Local cache cleared. You can now run clean sync/error tests.')
    } catch {
      setResetMessage('Cache clear partially completed. Please refresh and retry if needed.')
    }
  }

  const executeResetApplication = async () => {
    if (!isAdmin) return

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
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Admin Panel</h1>
        <p className="text-[#64748b]">System controls.</p>
      </div>

      <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">At a Glance</p>
              <p className="text-sm text-[#64748b]">System status at a glance for admins.</p>
            </div>
            <div className="rounded-full border border-[#d6e8e0] bg-white px-3 py-1 text-xs font-semibold text-[#1e8572]">
              Admin Dashboard
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Local Storage Used</p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {localStorageUsage.usedMb.toFixed(1)} MB / {localStorageLimitMb} MB
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full border-2 border-[#bde1d3] bg-[#eef7f3] flex items-center justify-center text-xs font-bold text-[#1e8572]">
                  {Math.round(localStorageUsage.usedPercent)}%
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#edf4f1]">
                <div
                  className="h-2 rounded-full bg-[#1e8572] transition-all"
                  style={{ width: `${localStorageUsage.usedPercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Offline Cache</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-[#111827]">{offlineCacheCount}</p>
                  <p className="text-xs text-[#64748b]">queued records cached locally</p>
                </div>
                <div className="inline-flex rounded-full border border-[#d6e8e0] bg-[#f7fcfa] px-3 py-1 text-xs font-semibold text-[#1e8572]">
                  Live
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Pending Sync</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-[#111827]">{pendingSyncCount}</p>
                  <p className="text-xs text-[#64748b]">records waiting to sync</p>
                </div>
                <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Queue
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs"
          onClick={() => setShowRecentEvents((prev) => !prev)}
          disabled={!isAdmin}
        >
          {showRecentEvents ? 'Hide Logs' : 'View Logs'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          {/* Admin Modules */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
              <CardHeader>
                <CardTitle as="h3">People & Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#edf4f1] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">👥 Manage Users</p>
                    <p className="text-xs text-[#64748b]">Access, roles, and account controls</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!isAdmin}>
                    Open
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#edf4f1] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">⚙️ App Settings</p>
                    <p className="text-xs text-[#64748b]">Preferences, configuration, and behavior</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!isAdmin}>
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
              <CardHeader>
                <CardTitle as="h3">Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#edf4f1] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">💾 Database Tools</p>
                    <p className="text-xs text-[#64748b]">Inspect and manage local data</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!isAdmin}>
                    Open
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#edf4f1] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">🔄 Sync Options</p>
                    <p className="text-xs text-[#64748b]">Offline sync, retry, and queue controls</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!isAdmin}>
                    Open
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[#edf4f1] bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">📦 Backup Tools</p>
                    <p className="text-xs text-[#64748b]">Create or restore backups</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!isAdmin}>
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          </div>

          {showRecentEvents && (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
              <CardHeader>
                <CardTitle as="h2">Recent Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-700">Recent automatic conflict handling decisions.</p>
                  {conflictResolutionLogs.length > 0 && (
                    <Button variant="outline" className="h-9" onClick={clearConflictLogs} disabled={!isAdmin}>
                      Clear Logs
                    </Button>
                  )}
                </div>

                {conflictResolutionLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dceae4] bg-white px-3 py-6 text-center">
                    <p className="text-sm font-semibold text-[#111827]">No recent events</p>
                    <p className="mt-1 text-xs text-gray-600">Conflict resolution events will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-auto pr-1">
                    {conflictResolutionLogs.slice(0, 20).map((event) => (
                      <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-3">
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
          </aside>
        )}
      </div>

      <div className="rounded-2xl border-2 border-red-200 bg-red-50/60 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Danger Zone</p>
            <p className="text-sm text-red-900">Absolute bottom section for destructive admin actions.</p>
          </div>
          <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700">
            Restricted
          </span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-900">Clear Local Cache</p>
            <p className="text-xs text-red-800">Removes queue/cache data only and preserves inventory and approvals.</p>
          </div>
          <Button variant="secondary" className="h-11 md:w-auto" onClick={() => setClearCacheDialogOpen(true)} disabled={!isAdmin}>
            Clear Local Cache
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-900">Reset Application</p>
            <p className="text-xs text-red-800">Requires typing RESET before the reset can run.</p>
          </div>
          <Button variant="destructive" className="h-11 md:w-auto" onClick={() => setResetDialogOpen(true)} disabled={!isAdmin}>
            Reset Application
          </Button>
        </div>
        {resetMessage && (
          <p className="mt-3 text-xs font-medium text-red-900">{resetMessage}</p>
        )}
      </div>

      <footer className="rounded-xl border border-[#dceae4] bg-[#f8fcfa] px-4 py-3 text-xs text-[#64748b]">
        <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-1">
          <span className="font-semibold text-[#334155]">About Malatang v1.0.0</span>
          <span>React + Vite + TypeScript + Tailwind</span>
          <span>Storage: IndexedDB (Dexie)</span>
          <span>State: Zustand</span>
          <span>Offline-first enabled</span>
        </div>
      </footer>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          setResetDialogOpen(open)
          if (!open) setResetConfirmationText('')
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Application Reset</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[#475569]">
              This will remove inventory, queues, approvals, logs, and delivery sessions. Type RESET to continue.
            </p>
            <input
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="Type RESET"
              className="h-10 w-full rounded-xl border border-red-200 bg-white px-3 text-sm"
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              className="h-10"
              disabled={resetConfirmationText.trim() !== 'RESET'}
              onClick={async () => {
                await executeResetApplication()
                setResetDialogOpen(false)
                setResetConfirmationText('')
              }}
            >
              Reset Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Clear Local Cache</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-[#475569]">
              This clears local queue and cache data only. Inventory records and approvals remain intact.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Cancel
            </DialogClose>
            <Button
              variant="secondary"
              className="h-10"
              onClick={async () => {
                await executeClearLocalCache()
                setClearCacheDialogOpen(false)
              }}
            >
              Clear Local Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPage
