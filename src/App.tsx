import { useEffect } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import Layout from '@/components/Layout'
import { RouteErrorBoundary } from '@/components'
import DashboardPage from '@/pages/DashboardPage'
import InventoryPage from '@/pages/InventoryPage'
import ScanPage from '@/pages/ScanPage'
import DeliveryPage from '@/pages/DeliveryPage'
import AuditPage from '@/pages/AuditPage'
import ReportsPage from '@/pages/ReportsPage'
import AdminPage from '@/pages/AdminPage'
import ApprovalsPage from '@/pages/ApprovalsPage'
import ActivityLogPage from '@/pages/ActivityLogPage'
import LoginPage from '@/pages/LoginPage'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { useAuthStore, useOfflineQueueStore } from '@/store'
import { useInventoryStore } from '@/store/useInventoryStore'
import { fetchInventoryFromApi } from '@/lib/inventoryApi'

const RoleGuard = ({
  role,
  userRole,
  children,
}: {
  role: 'admin' | 'staff'
  userRole: 'admin' | 'staff' | null
  children: ReactNode
}) => {
  if (userRole !== role) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isInitializing = useAuthStore((state) => state.isInitializing)
  const initializeAuth = useAuthStore((state) => state.initializeAuth)
  const userRole = useAuthStore((state) => state.user?.role ?? null)

  const hydrateScanQueue = useOfflineQueueStore((state) => state.hydrateScanQueue)
  const items = useInventoryStore((state) => state.items)
  const setItems = useInventoryStore((state) => state.setItems)
  const markSynced = useInventoryStore((state) => state.markSynced)
  const setLoading = useInventoryStore((state) => state.setLoading)
  const setError = useInventoryStore((state) => state.setError)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (!isAuthenticated) return
    void hydrateScanQueue()
  }, [hydrateScanQueue, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    const hasLocalItems = Array.isArray(items) && items.length > 0
    if (hasLocalItems) {
      return
    }

    let cancelled = false

    const hydrateInventory = async () => {
      setLoading(true)
      setError(null)

      try {
        const apiItems = await fetchInventoryFromApi()
        if (cancelled) return

        if (apiItems.length > 0) {
          setItems(apiItems)
          markSynced()
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to hydrate inventory from API'
          setError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void hydrateInventory()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, items, markSynced, setError, setItems, setLoading])

  if (isInitializing) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#edf4f1] text-[#334155]">
        Initializing session...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Layout>
                <RouteErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/forbidden" element={<ForbiddenPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/scan" element={<ScanPage />} />
                    <Route path="/delivery" element={<DeliveryPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route
                      path="/approvals"
                      element={
                        <RoleGuard role="admin" userRole={userRole}>
                          <ApprovalsPage />
                        </RoleGuard>
                      }
                    />
                    <Route path="/activity" element={<ActivityLogPage />} />
                    <Route
                      path="/admin"
                      element={
                        <RoleGuard role="admin" userRole={userRole}>
                          <AdminPage />
                        </RoleGuard>
                      }
                    />
                  </Routes>
                </RouteErrorBoundary>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
