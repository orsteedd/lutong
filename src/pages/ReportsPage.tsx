import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components'
import { useInventoryStore, useOfflineQueueStore } from '@/store'
import { computeInventoryStateSnapshot } from '@/lib/inventoryState'

const ReportsPage = () => {
  const items = useInventoryStore((state) => state.items)
  const scanQueue = useOfflineQueueStore((state) => state.scanQueue)
  const snapshot = useMemo(() => computeInventoryStateSnapshot(items, scanQueue), [items, scanQueue])

  const reportTypes = [
    { name: 'Inventory Summary', description: 'Current stock levels by category', icon: '📦' },
    { name: 'Movement Report', description: 'Inbound and outbound activity', icon: '🔄' },
    { name: 'Audit Report', description: 'Physical count discrepancies', icon: '🔍' },
    { name: 'Delivery Report', description: 'Received items and status', icon: '🚚' },
    { name: 'Expiration Report', description: 'Items nearing expiration', icon: '⏰' },
    { name: 'Variance Report', description: 'Actual vs. expected counts', icon: '📊' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] mb-1">Reports</h1>
        <p className="text-[#64748b]">Generate and export reports.</p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0f172a] mb-2">Start Date</label>
              <input type="date" className="w-full px-3 py-2 border border-[#d3e6dd] rounded-lg bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0f172a] mb-2">End Date</label>
              <input type="date" className="w-full px-3 py-2 border border-[#d3e6dd] rounded-lg bg-white" />
            </div>
            <div className="flex items-end">
              <Button variant="default" className="w-full h-12">
                Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <div>
        <h2 className="text-xl font-semibold text-[#0f172a] mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportTypes.map((report) => (
            <Card key={report.name} className="hover:shadow-md transition-all cursor-pointer bg-[#fbfefd]">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{report.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#0f172a] mb-1">{report.name}</h3>
                    <p className="text-sm text-[#64748b] mb-4">{report.description}</p>
                    <Button variant="outline" className="h-11" size="sm">
                      Generate Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle as="h3">Stock Split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Stock (Total)</span>
              <span className="font-bold text-lg">{snapshot.totals.stockQty}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Display (Transferred In)</span>
              <span className="font-bold text-lg text-sky-700">{snapshot.totals.displayQty}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Pending To Display</span>
              <span className="font-bold text-lg">{snapshot.totals.pendingToDisplay}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h3">This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Total Scans</span>
              <span className="font-bold text-lg">245</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Items Received</span>
              <span className="font-bold text-lg">128</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Audits Performed</span>
              <span className="font-bold text-lg">3</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h3">Accuracy Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Audit Accuracy</span>
              <Badge variant="success">98%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Data Integrity</span>
              <Badge variant="success">100%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Discrepancies</span>
              <Badge variant="warning">2</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h3">Per-Item Stock Split</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot.items.length === 0 ? (
            <p className="text-sm text-[#64748b]">No inventory items available for split reporting.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#dceae4] text-left">
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">Item</th>
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">SKU</th>
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">Stock</th>
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">Display</th>
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">Total</th>
                    <th className="px-3 py-2 font-semibold text-[#0f172a]">Pending To Display</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshot.items]
                    .sort((a, b) => b.confirmedAvailable - a.confirmedAvailable)
                    .map((item) => (
                      <tr key={item.itemId} className="border-b border-[#eef5f1] last:border-b-0">
                        <td className="px-3 py-2 text-[#0f172a] font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-[#64748b]">{item.sku}</td>
                        <td className="px-3 py-2 text-[#0f172a]">{item.stockQty}</td>
                        <td className="px-3 py-2 text-sky-700">{item.displayQty}</td>
                        <td className="px-3 py-2 text-[#0f172a] font-semibold">{item.confirmedAvailable}</td>
                        <td className="px-3 py-2 text-[#64748b]">{item.pendingToDisplay}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#dceae4] bg-[#f7fcfa]">
                    <td className="px-3 py-2 font-semibold text-[#0f172a]" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#0f172a]">{snapshot.totals.stockQty}</td>
                    <td className="px-3 py-2 font-semibold text-sky-700">{snapshot.totals.displayQty}</td>
                    <td className="px-3 py-2 font-semibold text-[#0f172a]">{snapshot.totals.confirmedAvailable}</td>
                    <td className="px-3 py-2 font-semibold text-[#0f172a]">{snapshot.totals.pendingToDisplay}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card className="bg-[#f8fcfa] border-[#dceae4]">
        <CardHeader>
          <CardTitle as="h3">Export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="secondary" className="h-11">📄 Export PDF</Button>
          <Button variant="outline" className="h-11">📊 Export CSV</Button>
          <Button variant="outline" className="h-11">📧 Email</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default ReportsPage
