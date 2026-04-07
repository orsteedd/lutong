import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useApprovalStore, useOfflineQueueStore } from '@/store'
import { useAuthStore } from '@/store/useAuthStore'
import { Button, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components'

interface LayoutProps {
  children: ReactNode
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/scan', label: 'Scan', icon: '📱' },
  { path: '/delivery', label: 'Delivery', icon: '🚚' },
  { path: '/audit', label: 'Audit', icon: '✓' },
  { path: '/approvals', label: 'Approvals', icon: '✅' },
  { path: '/activity', label: 'Activity', icon: '🧾' },
  { path: '/reports', label: 'Reports', icon: '📈' },
  { path: '/admin', label: 'Admin', icon: '⚙️' },
] as const

const ADMIN_ONLY_PATHS = new Set(['/approvals', '/activity', '/admin'])

const getPageTitle = (pathname: string) => {
  const match = NAV_ITEMS.find((item) => item.path === pathname)
  return match?.label ?? 'Dashboard'
}

const Layout = ({ children }: LayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [apiHealth, setApiHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [retryTick, setRetryTick] = useState(() => Date.now())
  const hasAutoOpenedConflictRef = useRef(false)
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const approvalRecords = useApprovalStore((state) => state.records)
  const isAdmin = user?.role === 'admin'
  const pendingScans = useOfflineQueueStore((state) => state.pendingScans)
  const wastageLogs = useOfflineQueueStore((state) => state.wastageLogs)
  const transferLogs = useOfflineQueueStore((state) => state.transferLogs)
  const unresolvedConflicts = useOfflineQueueStore((state) => state.unresolvedConflicts)
  const isSyncing = useOfflineQueueStore((state) => state.isSyncing)
  const syncStatus = useOfflineQueueStore((state) => state.syncStatus)
  const syncError = useOfflineQueueStore((state) => state.syncError)
  const nextRetryAt = useOfflineQueueStore((state) => state.nextRetryAt)
  const syncRetryCount = useOfflineQueueStore((state) => state.syncRetryCount)
  const syncPendingScans = useOfflineQueueStore((state) => state.syncPendingScans)
  const retrySync = useOfflineQueueStore((state) => state.retrySync)
  const removeScan = useOfflineQueueStore((state) => state.removeScan)
  const clearUnresolvedConflicts = useOfflineQueueStore((state) => state.clearUnresolvedConflicts)

  const safePendingScans = Array.isArray(pendingScans) ? pendingScans : []
  const safeWastageLogs = Array.isArray(wastageLogs) ? wastageLogs : []
  const safeTransferLogs = Array.isArray(transferLogs) ? transferLogs : []
  const safeUnresolvedConflicts = Array.isArray(unresolvedConflicts) ? unresolvedConflicts : []

  const isActive = (path: string) => location.pathname === path
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => isAdmin || !ADMIN_ONLY_PATHS.has(item.path)),
    [isAdmin]
  )
  const desktopNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.path !== '/scan'),
    [visibleNavItems]
  )
  const mobileNavItems = useMemo(
    () => visibleNavItems.filter((item) => ['/', '/scan', '/delivery', '/audit', '/approvals'].includes(item.path)),
    [visibleNavItems]
  )
  const pageTitle = getPageTitle(location.pathname)
  const pendingApprovalsCount = useMemo(
    () => approvalRecords.filter((record) => record.status === 'pending').length,
    [approvalRecords]
  )

  const pendingCount = useMemo(
    () =>
      safePendingScans.filter((item) => !item.synced).length +
      safeWastageLogs.filter((item) => !item.synced).length +
      safeTransferLogs.filter((item) => !item.synced).length,
    [safePendingScans, safeTransferLogs, safeWastageLogs]
  )

  const activeUnresolvedConflicts = useMemo(
    () =>
      safeUnresolvedConflicts.filter((conflict) =>
        safePendingScans.some((scan) => scan.id === conflict.recordId)
      ),
    [safePendingScans, safeUnresolvedConflicts]
  )

  const syncState: 'synced' | 'pending' | 'error' = useMemo(() => {
    if (syncStatus === 'error') return 'error'
    if (isSyncing || pendingCount > 0 || syncStatus === 'pending') return 'pending'
    return 'synced'
  }, [isSyncing, pendingCount, syncStatus])

  const systemStatusTone =
    syncState === 'error' || apiHealth === 'offline'
      ? 'red'
      : syncState === 'pending' || apiHealth === 'checking'
        ? 'amber'
        : 'green'

  const systemStatusDotClass =
    systemStatusTone === 'red'
      ? 'bg-red-500'
      : systemStatusTone === 'amber'
        ? 'bg-amber-500'
        : 'bg-[#B91C1C]'

  const systemStatusButtonClass =
    systemStatusTone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
      : systemStatusTone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
        : 'border-[#F3C4C4] bg-[#FDECEC] text-[#B91C1C] hover:bg-[#F9DFDF]'

  const systemStatusDescription =
    syncState === 'error'
      ? 'Sync error detected'
      : syncState === 'pending'
        ? `Sync pending for ${pendingCount} record(s)`
        : apiHealth === 'offline'
          ? 'API offline'
          : apiHealth === 'checking'
            ? 'Checking API connectivity'
            : 'System ready'

  const retryCountdownSeconds = useMemo(() => {
    if (!nextRetryAt) return null
    const remaining = Math.max(0, Math.ceil((nextRetryAt - retryTick) / 1000))
    return remaining
  }, [nextRetryAt, retryTick])

  const syncButtonTitle =
    retryCountdownSeconds && retryCountdownSeconds > 0
      ? `Auto retry in ${retryCountdownSeconds}s`
      : syncState === 'error'
        ? 'Retry sync'
        : 'Sync pending records'

  const handleSyncClick = async () => {
    if (syncState === 'error') {
      if (activeUnresolvedConflicts.length > 0) {
        setConflictDialogOpen(true)
        return
      }
      await retrySync()
      return
    }
    await syncPendingScans()
  }

  const handleDropConflictRecord = async (recordId: string) => {
    removeScan(recordId)
    await retrySync()
  }

  const handleClearConflictList = () => {
    clearUnresolvedConflicts()
  }

  useEffect(() => {
    if (activeUnresolvedConflicts.length === 0) {
      hasAutoOpenedConflictRef.current = false
      return
    }

    if (syncStatus === 'error' && !hasAutoOpenedConflictRef.current) {
      setConflictDialogOpen(true)
      hasAutoOpenedConflictRef.current = true
    }

    if (syncStatus !== 'error') {
      hasAutoOpenedConflictRef.current = false
    }
  }, [activeUnresolvedConflicts.length, syncStatus])

  useEffect(() => {
    if (!nextRetryAt) return

    const timer = setInterval(() => {
      setRetryTick(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [nextRetryAt])

  useEffect(() => {
    let cancelled = false
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
    const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/health`

    const checkHealth = async () => {
      if (!endpoint.startsWith('http')) {
        if (!cancelled) setApiHealth('offline')
        return
      }

      try {
        const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' })
        if (!cancelled) {
          setApiHealth(response.ok ? 'online' : 'offline')
        }
      } catch {
        if (!cancelled) setApiHealth('offline')
      }
    }

    void checkHealth()
    const timer = setInterval(() => {
      void checkHealth()
    }, 30000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="min-h-screen px-2 py-2 md:h-screen md:overflow-hidden md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1500px] overflow-hidden rounded-[30px] border border-[#cfe5db] bg-[#edf4f1] shadow-[0_24px_64px_rgba(15,23,42,0.12)] md:min-h-0 md:h-[calc(100vh-2.5rem)]">
        <aside className="hidden md:flex w-[230px] flex-col border-r border-[#e8e5e2] bg-[#FDFCFB]">
          <div className="px-5 py-6 border-b border-[#ece8e4]">
            <div className="flex items-center gap-3">
              <img
                src="/malatang.svg"
                alt="NO. 1 MALATANG"
                className="h-11 w-11 rounded-xl object-contain"
              />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Malatang</h1>
                <p className="text-sm text-[#111827]">Inventory Console</p>
              </div>
            </div>
          </div>
          <nav className="px-3 py-4 flex-1 space-y-1">
            {desktopNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive(item.path)
                    ? 'bg-[#FDECEC] text-[#111827] border border-[#F3C4C4]'
                    : 'text-[#111827] hover:bg-[#f7f2f1]'
                }`}
              >
                <span className="text-[#111827] grayscale">{item.icon}</span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {item.path === '/approvals' && pendingApprovalsCount > 0 && (
                    <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full border border-[#F3C4C4] bg-[#FDECEC] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#B91C1C]">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>
          <div className="px-4 pb-5">
            <div className="rounded-xl border border-[#e4dfdc] bg-white px-3 py-3 text-xs text-[#111827]">
              <p className="font-semibold text-[#111827]">System Status</p>
              <div className="mt-2 inline-flex items-center gap-2" title={systemStatusDescription}>
                <span className={`h-2.5 w-2.5 rounded-full ${systemStatusDotClass}`} />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="border-b border-[#d6e8e0] bg-[#f9fcfb] px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="md:hidden text-2xl p-2 rounded-xl hover:bg-[#e8f3ee]"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  ☰
                </button>
                <div className="min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#111827] truncate">{pageTitle}</h2>
                  <p className="text-xs text-[#64748b]">Operational workspace</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${systemStatusButtonClass} ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                  title={syncButtonTitle}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${systemStatusDotClass}`} aria-hidden="true" />
                  <span>{isSyncing ? 'Syncing...' : 'System Status'}</span>
                </button>

                {syncError && (
                  <button
                    type="button"
                    className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 hover:bg-red-100"
                    title={
                      retryCountdownSeconds && retryCountdownSeconds > 0
                        ? `${syncError} (auto retry in ${retryCountdownSeconds}s)`
                        : syncError
                    }
                    onClick={() => setConflictDialogOpen(true)}
                  >
                    {activeUnresolvedConflicts.length > 0 ? `Review (${activeUnresolvedConflicts.length})` : 'Warning'}
                  </button>
                )}

                {retryCountdownSeconds !== null && retryCountdownSeconds > 0 && (
                  <div
                    className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
                    title="Automatic retry is scheduled"
                  >
                    Retry in {retryCountdownSeconds}s ({syncRetryCount})
                  </div>
                )}

                <div className="hidden md:flex items-center gap-2 rounded-full border border-[#d6e8e0] bg-white px-2 py-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                    {user?.username || 'unknown'}
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-[#d6e8e0] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#334155] hover:bg-[#f3f6f5]"
                    onClick={logout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden mt-3 border border-[#dbe9e3] rounded-xl bg-white">
                <nav className="flex flex-col">
                  {mobileNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 border-b border-[#eef3f1] font-medium transition-all ${
                        isActive(item.path)
                          ? 'bg-[#FDECEC] text-[#B91C1C]'
                          : 'text-[#111827]'
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            )}
          </header>

          <main className="flex-1 overflow-auto bg-[#eff5f2]">
            <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav className="sticky bottom-0 mt-2 md:hidden bg-white/95 border border-[#d7e7df] rounded-xl flex gap-0 shadow-sm">
        {mobileNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all ${
              isActive(item.path)
                ? 'text-[#B91C1C] bg-[#FDECEC]'
                : 'text-[#64748b] hover:text-[#111827]'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync Conflict Review</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {activeUnresolvedConflicts.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                No unresolved conflicts remain. You can retry sync now.
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                {activeUnresolvedConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{conflict.sku}</p>
                        <p className="text-xs text-gray-700">{conflict.reason}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="h-8 border-red-300 text-red-700"
                        onClick={() => {
                          void handleDropConflictRecord(conflict.recordId)
                        }}
                      >
                        Remove Record
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Close
            </DialogClose>
            <button
              type="button"
              className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100"
              onClick={handleClearConflictList}
            >
              Dismiss List
            </button>
            <button
              type="button"
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:opacity-90"
              onClick={() => {
                void retrySync()
              }}
            >
              Retry Sync
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Layout
