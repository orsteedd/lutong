import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useOfflineQueueStore } from '@/store'
import { useAuthStore } from '@/store/useAuthStore'

interface LayoutProps {
  children: ReactNode
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/scan', label: 'Scan', icon: '📱' },
  { path: '/delivery', label: 'Delivery', icon: '🚚' },
  { path: '/reports', label: 'Audit', icon: '📈' },
  { path: '/admin', label: 'Admin', icon: '⚙️' },
] as const

const ADMIN_ONLY_PATHS = new Set(['/admin'])

const getPageTitle = (pathname: string) => {
  const match = NAV_ITEMS.find((item) => item.path === pathname)
  return match?.label ?? 'Dashboard'
}

const Layout = ({ children }: LayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [backendHealth, setBackendHealth] = useState<'checking' | 'online' | 'db-error' | 'offline'>('checking')
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const isAdmin = user?.role === 'admin'
  const pendingScans = useOfflineQueueStore((state) => state.pendingScans)
  const wastageLogs = useOfflineQueueStore((state) => state.wastageLogs)
  const transferLogs = useOfflineQueueStore((state) => state.transferLogs)

  const safePendingScans = Array.isArray(pendingScans) ? pendingScans : []
  const safeWastageLogs = Array.isArray(wastageLogs) ? wastageLogs : []
  const safeTransferLogs = Array.isArray(transferLogs) ? transferLogs : []

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
    () => visibleNavItems.filter((item) => ['/', '/inventory', '/scan', '/delivery', '/reports', '/admin'].includes(item.path)),
    [visibleNavItems]
  )
  const pageTitle = getPageTitle(location.pathname)

  const pendingCount = useMemo(
    () =>
      safePendingScans.filter((item) => !item.synced).length +
      safeWastageLogs.filter((item) => !item.synced).length +
      safeTransferLogs.filter((item) => !item.synced).length,
    [safePendingScans, safeTransferLogs, safeWastageLogs]
  )

  const systemStatusTone: 'red' | 'green' = backendHealth === 'online' ? 'green' : 'red'

  const systemStatusText =
    backendHealth === 'online'
      ? 'System Status: Online'
      : backendHealth === 'db-error'
        ? 'System Status: DB Error'
        : 'System Status: Offline'

  const systemStatusDotClass =
    systemStatusTone === 'red'
      ? 'bg-[#B91C1C]'
      : 'bg-green-500'

  const systemStatusDescription =
    backendHealth === 'online'
      ? 'Database connected'
      : backendHealth === 'db-error'
        ? 'Database disconnected'
        : 'Offline'

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
    const endpoint = apiBaseUrl.trim()
      ? `${apiBaseUrl.replace(/\/$/, '')}/api/health-check`
      : '/api/health-check'

    const checkHealth = async () => {
      if (!isOnline) {
        if (!cancelled) setBackendHealth('offline')
        return
      }

      try {
        const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' })
        const payload = (await response.json()) as {
          database?: string
          pdo_connected?: boolean
        }

        if (!cancelled) {
          if (response.status === 200 && payload.database === 'connected' && payload.pdo_connected === true) {
            setBackendHealth('online')
          } else if (response.status === 500 || payload.database === 'disconnected' || payload.pdo_connected === false) {
            setBackendHealth('db-error')
          } else {
            setBackendHealth('offline')
          }
        }
      } catch {
        if (!cancelled) setBackendHealth('offline')
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
  }, [isOnline])

  return (
    <div className="min-h-screen px-2 py-2 md:h-screen md:overflow-hidden md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1900px] overflow-hidden rounded-[30px] border border-[#eadad4] bg-[#f7f3f1] shadow-[0_24px_64px_rgba(15,23,42,0.12)] md:min-h-0 md:h-[calc(100vh-2.5rem)]">
        <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-[#e8e5e2] bg-[#FDFCFB]">
          <div className="px-5 py-6 border-b border-[#ece8e4]">
            <div className="flex items-center gap-3">
              <img
                src="/malatang.svg"
                alt="NO. 1 MALATANG"
                className="h-12 w-12 rounded-xl object-contain"
              />
              <span className="text-xs font-medium uppercase tracking-wide text-[#9ca3af]">Inventory</span>
            </div>
          </div>
          <nav className="px-3 py-4 flex-1 space-y-1">
            {desktopNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive(item.path)
                    ? 'bg-[#FDECEC] text-[#B91C1C] border border-[#F3C4C4]'
                    : 'text-[#111827] hover:bg-[#f7f2f1]'
                }`}
              >
                <span className={`${isActive(item.path) ? 'text-[#B91C1C]' : 'text-[#111827]'} grayscale`}>{item.icon}</span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{item.label}</span>
                </span>
              </Link>
            ))}
          </nav>
          <div className="px-4 pb-5">
            <div className="rounded-xl border border-[#e4dfdc] bg-white px-3 py-3 text-xs text-[#111827]">
              <p className="font-semibold text-[#111827]">System Status</p>
              <div className="mt-2 inline-flex items-center gap-2" title={systemStatusDescription}>
                <span className={`h-2.5 w-2.5 rounded-full ${systemStatusDotClass}`} />
                <span className="font-medium">{systemStatusText}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="border-b border-[#e8d9d4] bg-[#fdf9f8] px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="md:hidden text-2xl p-2 rounded-xl hover:bg-[#f7ece8]"
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
                <div className="hidden md:inline-flex items-center rounded-full border border-[#d6e8e0] bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[#1e8572]">
                  Pending Sync {pendingCount}
                </div>

                <div className="hidden md:flex items-center gap-2 rounded-full border border-[#e5d9d4] bg-white px-2 py-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                    {user?.username || 'unknown'}
                  </span>
                  <button
                    type="button"
                    className="rounded-xl border border-[#e5d9d4] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#334155] hover:bg-[#f8f3f1]"
                    onClick={logout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden mt-3 border border-[#eaded9] rounded-xl bg-white">
                <nav className="flex flex-col">
                  {mobileNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 border-b border-[#f1e7e3] font-medium transition-all ${
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

          <main className="flex-1 overflow-auto bg-[#f8f4f2]">
            <div className="mx-auto w-full max-w-none px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav className="sticky bottom-0 mt-2 md:hidden bg-white/95 border border-[#e7d9d4] rounded-xl flex gap-0 shadow-sm">
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
    </div>
  )
}

export default Layout
