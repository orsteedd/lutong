import type { PendingScan } from '@/store/useOfflineQueueStore'
import type { InventoryItem } from '@/store/useInventoryStore'

export type AuditDifferenceType = 'missing' | 'excess'

export interface AuditDiscrepancy {
  item_id: string
  sku: string
  name: string
  system_qty: number
  actual_qty: number
  difference: number
  difference_type: AuditDifferenceType
  approval_status: 'pending_approval'
}

export interface AuditDiscrepancyReport {
  sessionId: string
  generatedAt: number
  discrepancies: AuditDiscrepancy[]
  totals: {
    systemQty: number
    actualQty: number
    missingCount: number
    excessCount: number
    discrepancyCount: number
  }
}

export const buildAuditDiscrepancyReport = (
  inventoryItems: InventoryItem[],
  pendingScans: PendingScan[],
  sessionId: string
): AuditDiscrepancyReport => {
  const auditScans = pendingScans.filter(
    (scan) => scan.type === 'audit' && scan.metadata?.sessionId === sessionId
  )

  // In audit mode, the latest scan for a SKU is the authoritative physical count.
  const orderedAuditScans = [...auditScans].sort((a, b) => a.timestamp - b.timestamp)
  const actualBySku = new Map<string, number>()
  for (const scan of orderedAuditScans) {
    actualBySku.set(scan.sku, scan.quantity)
  }

  const knownSkuSet = new Set(inventoryItems.map((item) => item.sku))

  const discrepancies: AuditDiscrepancy[] = []

  for (const item of inventoryItems) {
    const actualQty = actualBySku.get(item.sku) ?? 0
    const difference = actualQty - item.quantity

    if (difference === 0) continue

    discrepancies.push({
      item_id: item.id,
      sku: item.sku,
      name: item.name,
      system_qty: item.quantity,
      actual_qty: actualQty,
      difference,
      difference_type: difference < 0 ? 'missing' : 'excess',
      approval_status: 'pending_approval',
    })
  }

  for (const [sku, actualQty] of actualBySku.entries()) {
    if (knownSkuSet.has(sku)) continue

    discrepancies.push({
      item_id: `UNREGISTERED-${sku}`,
      sku,
      name: 'Unknown Item',
      system_qty: 0,
      actual_qty: actualQty,
      difference: actualQty,
      difference_type: 'excess',
      approval_status: 'pending_approval',
    })
  }

  discrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))

  const inventoryBySku = new Map(inventoryItems.map((item) => [item.sku, item]))
  const allSkus = new Set<string>([
    ...inventoryItems.map((item) => item.sku),
    ...actualBySku.keys(),
  ])

  let totalSystemQty = 0
  let totalActualQty = 0
  for (const sku of allSkus) {
    totalSystemQty += inventoryBySku.get(sku)?.quantity ?? 0
    totalActualQty += actualBySku.get(sku) ?? 0
  }

  const missingCount = discrepancies.filter((row) => row.difference_type === 'missing').length
  const excessCount = discrepancies.filter((row) => row.difference_type === 'excess').length

  const totals = {
    systemQty: totalSystemQty,
    actualQty: totalActualQty,
    missingCount,
    excessCount,
    discrepancyCount: discrepancies.length,
  }

  return {
    sessionId,
    generatedAt: Date.now(),
    discrepancies,
    totals,
  }
}
