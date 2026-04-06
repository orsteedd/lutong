import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import { useOfflineQueueStore } from '@/store'
import { useInventoryStore } from '@/store/useInventoryStore'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchInventoryFromApi } from '@/lib/inventoryApi'

function App() {
  const user = useAuthStore((state) => state.user)
  const hydrateScanQueue = useOfflineQueueStore((state) => state.hydrateScanQueue)
  const items = useInventoryStore((state) => state.items)
  const setItems = useInventoryStore((state) => state.setItems)
  const markSynced = useInventoryStore((state) => state.markSynced)
  const setLoading = useInventoryStore((state) => state.setLoading)
  const setError = useInventoryStore((state) => state.setError)
  const isAuthenticated = Boolean(user)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    void hydrateScanQueue()
  }, [hydrateScanQueue])

  useEffect(() => {
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
  }, [items, markSynced, setError, setItems, setLoading])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/forbidden"
          element={isAuthenticated ? <ForbiddenPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Layout>
                <RouteErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/scan" element={<ScanPage />} />
                    <Route path="/delivery" element={<DeliveryPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route
                      path="/approvals"
                      element={isAdmin ? <ApprovalsPage /> : <Navigate to="/forbidden" replace />}
                    />
                    <Route
                      path="/activity"
                      element={isAdmin ? <ActivityLogPage /> : <Navigate to="/forbidden" replace />}
                    />
                    <Route
                      path="/admin"
                      element={isAdmin ? <AdminPage /> : <Navigate to="/forbidden" replace />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
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
