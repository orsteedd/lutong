import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { useOfflineQueueStore } from '@/store'

function App() {
  const hydrateScanQueue = useOfflineQueueStore((state) => state.hydrateScanQueue)

  useEffect(() => {
    void hydrateScanQueue()
  }, [hydrateScanQueue])

  return (
    <BrowserRouter>
      <Layout>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/delivery" element={<DeliveryPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/activity" element={<ActivityLogPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </RouteErrorBoundary>
      </Layout>
    </BrowserRouter>
  )
}

export default App
