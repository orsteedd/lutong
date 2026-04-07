import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components'
import { useInventoryStore, useOfflineQueueStore } from '@/store'
import { computeInventoryStateSnapshot } from '@/lib/inventoryState'

const ReportsPage = () => {
  const items = useInventoryStore((state) => state.items)
  const scanQueue = useOfflineQueueStore((state) => state.scanQueue)
  const snapshot = useMemo(() => computeInventoryStateSnapshot(items, scanQueue), [items, scanQueue])
  const stockMain = snapshot.totals.stockQty
  const stockDisplay = snapshot.totals.displayQty
  const stockSplitTotal = stockMain + stockDisplay
  const stockMainPercent = stockSplitTotal > 0 ? (stockMain / stockSplitTotal) * 100 : 0
  const stockDisplayPercent = stockSplitTotal > 0 ? (stockDisplay / stockSplitTotal) * 100 : 0

  const reportTypes = [
    'Inventory Summary',
    'Movement Report',
    'Audit Report',
    'Delivery Report',
    'Expiration Report',
    'Variance Report',
  ]
  const [selectedReportType, setSelectedReportType] = useState(reportTypes[0])
  const [reportGenerated, setReportGenerated] = useState(false)

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Reports</h1>
        <p className="text-[#64748b]">Generate and export reports.</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">This Month</p>
                <p className="mt-1 text-sm text-[#64748b]">Operational activity at a glance</p>
              </div>
              <div className="rounded-full border border-[#d6e8e0] bg-white px-3 py-1 text-xs font-semibold text-[#1e8572]">
                3 Audits
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="default">245 Scans</Badge>
              <Badge variant="outline">128 Items Received</Badge>
              <Badge variant="secondary">3 Audits Performed</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Accuracy Metrics</p>
                <p className="mt-1 text-sm text-[#64748b]">Audit health and data quality</p>
              </div>
              <div className="h-12 w-12 rounded-full border-2 border-[#bde1d3] bg-[#eef7f3] flex items-center justify-center text-xs font-bold text-[#1e8572]">
                98%
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="success">Audit Accuracy 98%</Badge>
              <Badge variant="success">Data Integrity 100%</Badge>
              <Badge variant="warning">Discrepancies 2</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Inventory Overview</p>
                <p className="mt-1 text-sm text-[#64748b]">Current stock vs display balance</p>
              </div>
              <div className="rounded-full border border-[#d6e8e0] bg-white px-3 py-1 text-xs font-semibold text-[#1e8572]">
                {snapshot.items.length} Items
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">Stock {stockMain}</Badge>
              <Badge variant="secondary">Display {stockDisplay}</Badge>
              <Badge variant="default">Pending {snapshot.totals.pendingToDisplay}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Report Toolbar */}
      <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap">
            <label className="min-w-[150px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Start Date</span>
              <input
                type="date"
                className="h-9 w-full rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
              />
            </label>
            <label className="min-w-[150px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">End Date</span>
              <input
                type="date"
                className="h-9 w-full rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
              />
            </label>
            <label className="min-w-[220px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Report Type</span>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#d3e6dd] bg-white px-3 text-sm"
              >
                {reportTypes.map((reportType) => (
                  <option key={reportType} value={reportType}>
                    {reportType}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button variant="default" className="h-9 shrink-0 px-4 text-sm" onClick={() => setReportGenerated(true)}>
            Generate {selectedReportType}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-[#dceae4] bg-[#fbfefd] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <CardHeader>
            <CardTitle as="h3">Stock Split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stockSplitTotal === 0 ? (
              <p className="text-sm text-[#64748b]">No stock data available for split visualization.</p>
            ) : (
              <>
                <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                  <div
                    className="relative h-full w-full rounded-full"
                    style={{
                      background: `conic-gradient(#1e8572 0 ${stockMainPercent}%, #0ea5e9 ${stockMainPercent}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-white text-center shadow-sm">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Total Stock</p>
                        <p className="text-2xl font-extrabold text-[#111827]">{stockSplitTotal}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-[#dceae4] bg-white px-3 py-2">
                    <span className="flex items-center gap-2 text-[#334155]"><span className="h-2.5 w-2.5 rounded-full bg-[#1e8572]" />Main Stock</span>
                    <span className="font-semibold text-[#111827]">{stockMain} ({stockMainPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#dceae4] bg-white px-3 py-2">
                    <span className="flex items-center gap-2 text-[#334155]"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Display Stock</span>
                    <span className="font-semibold text-[#111827]">{stockDisplay} ({stockDisplayPercent.toFixed(0)}%)</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                      <th className="px-3 py-2 font-semibold text-[#111827]">Item</th>
                      <th className="px-3 py-2 font-semibold text-[#111827]">SKU</th>
                      <th className="px-3 py-2 font-semibold text-[#111827]">Stock</th>
                      <th className="px-3 py-2 font-semibold text-[#111827]">Display</th>
                      <th className="px-3 py-2 font-semibold text-[#111827]">Total</th>
                      <th className="px-3 py-2 font-semibold text-[#111827]">Pending To Display</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshot.items]
                      .sort((a, b) => b.confirmedAvailable - a.confirmedAvailable)
                      .map((item) => (
                        <tr key={item.itemId} className="border-b border-[#eef5f1] last:border-b-0">
                          <td className="px-3 py-2 text-[#111827] font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-[#64748b]">{item.sku}</td>
                          <td className="px-3 py-2 text-[#111827]">{item.stockQty}</td>
                          <td className="px-3 py-2 text-sky-700">{item.displayQty}</td>
                          <td className="px-3 py-2 text-[#111827] font-semibold">{item.confirmedAvailable}</td>
                          <td className="px-3 py-2 text-[#64748b]">{item.pendingToDisplay}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#dceae4] bg-[#f7fcfa]">
                      <td className="px-3 py-2 font-semibold text-[#111827]" colSpan={2}>
                        Totals
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#111827]">{snapshot.totals.stockQty}</td>
                      <td className="px-3 py-2 font-semibold text-sky-700">{snapshot.totals.displayQty}</td>
                      <td className="px-3 py-2 font-semibold text-[#111827]">{snapshot.totals.confirmedAvailable}</td>
                      <td className="px-3 py-2 font-semibold text-[#111827]">{snapshot.totals.pendingToDisplay}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {reportGenerated && (
        <div className="fixed bottom-4 left-4 right-4 z-20 mx-auto max-w-[1200px]">
          <Card className="border-[#dceae4] bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Export Ready</p>
                <p className="text-sm text-[#334155]">{selectedReportType} is generated and ready to share.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" className="h-10">📄 Export PDF</Button>
                <Button variant="outline" className="h-10">📊 Export CSV</Button>
                <Button variant="outline" className="h-10">📧 Email</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
