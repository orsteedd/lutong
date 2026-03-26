import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
import { useInventoryStore } from '@/store/useInventoryStore'
import { useOfflineQueueStore } from '@/store/useOfflineQueueStore'
import { computeInventoryStateSnapshot } from '@/lib/inventoryState'
import { buildLowStockAlerts } from '@/lib/lowStockAlerts'
import { buildStockForecast } from '@/lib/stockForecast'

const isToday = (timestamp: number) => {
  const now = new Date()
  const value = new Date(timestamp)
  return (
    now.getFullYear() === value.getFullYear() &&
    now.getMonth() === value.getMonth() &&
    now.getDate() === value.getDate()
  )
}

const FORECAST_LOOKBACK_DAYS = 7

const DashboardPage = () => {
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768)
  const items = useInventoryStore((state) => state.items)
  const pendingScans = useOfflineQueueStore((state) => state.pendingScans)
  const wastageLogs = useOfflineQueueStore((state) => state.wastageLogs)
  const transferLogs = useOfflineQueueStore((state) => state.transferLogs)
  const scanQueue = useOfflineQueueStore((state) => state.scanQueue)

  const inventoryStateSnapshot = useMemo(
    () => computeInventoryStateSnapshot(items, scanQueue),
    [items, scanQueue]
  )
  const lowStockAlerts = useMemo(
    () => buildLowStockAlerts(inventoryStateSnapshot.items, items),
    [inventoryStateSnapshot.items, items]
  )
  const stockForecast = useMemo(
    () =>
      buildStockForecast(
        inventoryStateSnapshot.items,
        scanQueue,
        FORECAST_LOOKBACK_DAYS
      ),
    [inventoryStateSnapshot.items, scanQueue]
  )
  const forecastTopRisk = useMemo(
    () => stockForecast.filter((row) => Number.isFinite(row.estimatedDaysRemaining)).slice(0, 6),
    [stockForecast]
  )
  const criticalItems = useMemo(
    () => lowStockAlerts.filter((item) => item.severity === 'critical'),
    [lowStockAlerts]
  )
  const warningItems = useMemo(
    () => lowStockAlerts.filter((item) => item.severity === 'low'),
    [lowStockAlerts]
  )

  const todaysScans = useMemo(
    () => pendingScans.filter((scan) => isToday(scan.timestamp)).length,
    [pendingScans]
  )

  const todaysWastage = useMemo(
    () =>
      wastageLogs
        .filter((log) => isToday(log.timestamp))
        .reduce((sum, log) => sum + log.quantity, 0),
    [wastageLogs]
  )

  const todaysTransfers = useMemo(
    () => transferLogs.filter((log) => isToday(log.timestamp)).length,
    [transferLogs]
  )

  const totalPending = useMemo(
    () =>
      pendingScans.filter((item) => !item.synced).length +
      wastageLogs.filter((item) => !item.synced).length +
      transferLogs.filter((item) => !item.synced).length,
    [pendingScans, transferLogs, wastageLogs]
  )

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Dashboard</h1>
        <p className="text-[#64748b]">Inventory status and actions.</p>
      </div>

      {/* Visual Hierarchy Key */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">Red = Critical</Badge>
        <Badge variant="warning">Yellow = Warning</Badge>
        <Badge variant="outline">Neutral = Normal</Badge>
      </div>

      {/* Key Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[#dc2626]">
          <CardHeader>
            <CardTitle as="h2" className="text-[#b91c1c]">
              Red Line Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalItems.length === 0 && warningItems.length === 0 ? (
              <p className="text-sm text-gray-600">No low stock items.</p>
            ) : (
              <>
                {criticalItems.slice(0, 4).map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.sku} • Stock {item.currentStock} / Buffer {item.safetyBuffer}
                      </p>
                    </div>
                    <Badge variant="destructive">Critical</Badge>
                  </div>
                ))}

                {warningItems.slice(0, 3).map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.sku} • Stock {item.currentStock} / Buffer {item.safetyBuffer}
                      </p>
                    </div>
                    <Badge variant="warning">Low</Badge>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#fbfefd]">
          <CardHeader>
            <CardTitle as="h2">Daily Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="text-sm text-gray-700">Scans Today</span>
              <span className="text-lg font-bold text-black">{todaysScans}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm text-gray-700">Wastage Today</span>
              <span className="text-lg font-bold text-amber-700">{todaysWastage}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="text-sm text-gray-700">Transfers Today</span>
              <span className="text-lg font-bold text-black">{todaysTransfers}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#bde1d3] bg-[#ebf7f2] px-3 py-2">
              <span className="text-sm text-[#475569]">Pending Sync</span>
              <span className="text-lg font-bold text-[#1e8572]">{totalPending}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isMobileView ? (
              <>
                <Link to="/scan" className="block">
                  <Button variant="default" className="w-full h-12">
                    Start Scan
                  </Button>
                </Link>
                <Link to="/scan?mode=transfer" className="block">
                  <Button variant="outline" className="w-full h-12">
                    Quick Transfer
                  </Button>
                </Link>
                <Link to="/scan?mode=wastage" className="block">
                  <Button variant="outline" className="w-full h-12">
                    Log Wastage
                  </Button>
                </Link>
              </>
            ) : (
              <div className="rounded-xl border border-[#dceae4] bg-[#f7fcfa] px-3 py-3 text-sm text-[#475569]">
                Scanner actions are available on mobile only.
              </div>
            )}
            <Link to="/delivery" className="block">
              <Button variant="secondary" className="w-full h-12">
                New Delivery Check
              </Button>
            </Link>
            <Link to="/audit" className="block">
              <Button variant="outline" className="w-full h-12">
                Open Audit
              </Button>
            </Link>
            <Link to="/reports" className="block">
              <Button variant="ghost" className="w-full h-12 border border-[#dceae4]">
                Daily Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Inventory Health</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-red-700">Critical</p>
            <p className="text-3xl font-bold text-red-700">{criticalItems.length}</p>
            <p className="text-xs text-gray-600">Requires immediate restock</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-700">Warning</p>
            <p className="text-3xl font-bold text-amber-700">{warningItems.length}</p>
            <p className="text-xs text-gray-600">Monitor stock closely</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-700">Normal</p>
            <p className="text-3xl font-bold text-black">
              {Math.max(
                inventoryStateSnapshot.items.length - criticalItems.length - warningItems.length,
                0
              )}
            </p>
            <p className="text-xs text-gray-600">Healthy inventory level</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Inventory State (Offline-First)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-700">Stock</p>
            <p className="text-2xl font-bold text-black">{inventoryStateSnapshot.totals.stockQty}</p>
            <p className="text-xs text-gray-600">Main stock total</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-sky-800">Display</p>
            <p className="text-2xl font-bold text-sky-700">{inventoryStateSnapshot.totals.displayQty}</p>
            <p className="text-xs text-gray-600">Transferred in</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-700">Pending</p>
            <p className="text-2xl font-bold text-secondary">
              {inventoryStateSnapshot.totals.pendingNet > 0 ? '+' : ''}
              {inventoryStateSnapshot.totals.pendingNet}
            </p>
            <p className="text-xs text-gray-600">Unsynced scan impact</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-700">To Display (Pending)</p>
            <p className="text-2xl font-bold text-black">{inventoryStateSnapshot.totals.pendingToDisplay}</p>
            <p className="text-xs text-gray-600">Queued transfers</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-amber-800">Wastage (Locked)</p>
            <p className="text-2xl font-bold text-amber-700">{inventoryStateSnapshot.totals.wastageLocked}</p>
            <p className="text-xs text-gray-600">Reserved reduction</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-700">Adjustment</p>
            <p className="text-2xl font-bold text-black">
              {inventoryStateSnapshot.totals.adjustmentPendingApproval > 0 ? '+' : ''}
              {inventoryStateSnapshot.totals.adjustmentPendingApproval}
            </p>
            <p className="text-xs text-gray-600">Pending approval</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Stock Forecast ({FORECAST_LOOKBACK_DAYS}d usage)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {forecastTopRisk.length === 0 ? (
            <p className="text-sm text-gray-600">Not enough recent usage activity to forecast days remaining.</p>
          ) : (
            <>
              {forecastTopRisk.map((row) => (
                <div
                  key={row.itemId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">{row.name}</p>
                    <p className="text-xs text-gray-600">{row.sku} • Stock {row.currentStock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-black">
                      {row.estimatedDaysRemaining.toFixed(1)} days remaining
                    </p>
                    <p className="text-xs text-gray-600">
                      Avg usage/day: {row.averageDailyUsage.toFixed(2)}
                    </p>
                    <div className="mt-1">
                      <Badge
                        variant={
                          row.confidence === 'high'
                            ? 'success'
                            : row.confidence === 'medium'
                              ? 'warning'
                              : 'destructive'
                        }
                      >
                        {row.confidence === 'low' ? 'Low confidence' : `${row.confidence} confidence`}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              {forecastTopRisk.some((row) => row.lowDataWarning) && (
                <p className="text-xs text-amber-700">
                  Low data warning: some forecasts are based on limited recent activity.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
