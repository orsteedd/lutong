import type { PendingScan } from '@/store/useOfflineQueueStore'

export interface DeliverySessionData {
  id: string
  supplier: string
  date: string
  status: 'pending' | 'completed'
  expected: Array<{
    sku: string
    name: string
    expectedQty: number
  }>
}

export type DeliveryRowStatus = 'matched' | 'partial' | 'discrepancy'

export interface DeliveryVerificationRow {
  sku: string
  name: string
  expectedQty: number
  actualQty: number
  variance: number
  status: DeliveryRowStatus
  flags: Array<'shortage' | 'over_delivery'>
}

export interface WrongDeliveryItem {
  sku: string
  actualQty: number
  lastScannedAt: number
}

export interface DeliveryVerificationReport {
  sessionId: string
  generatedAt: number
  status: 'pending_approval'
  rows: DeliveryVerificationRow[]
  wrongItems: WrongDeliveryItem[]
  totals: {
    totalExpectedQty: number
    totalActualQty: number
    matchedCount: number
    partialCount: number
    discrepancyCount: number
    shortageCount: number
    overDeliveryCount: number
    wrongItemCount: number
  }
}

export const verifyDeliverySession = (
  session: DeliverySessionData,
  pendingScans: PendingScan[]
): DeliveryVerificationReport => {
  const deliveryScansForSession = pendingScans.filter(
    (scan) => scan.type === 'delivery' && scan.metadata?.sessionId === session.id
  )

  const actualBySku = new Map<string, number>()
  const lastScannedAtBySku = new Map<string, number>()

  for (const scan of deliveryScansForSession) {
    actualBySku.set(scan.sku, (actualBySku.get(scan.sku) ?? 0) + scan.quantity)
    lastScannedAtBySku.set(
      scan.sku,
      Math.max(lastScannedAtBySku.get(scan.sku) ?? 0, scan.timestamp)
    )
  }

  const expectedSkus = new Set(session.expected.map((item) => item.sku))

  const wrongItems: WrongDeliveryItem[] = Array.from(actualBySku.entries())
    .filter(([sku]) => !expectedSkus.has(sku))
    .map(([sku, actualQty]) => ({
      sku,
      actualQty,
      lastScannedAt: lastScannedAtBySku.get(sku) ?? Date.now(),
    }))
    .sort((a, b) => b.lastScannedAt - a.lastScannedAt)

  const rows = session.expected.map((item) => {
    const actualQty = actualBySku.get(item.sku) ?? 0
    const variance = actualQty - item.expectedQty

    if (actualQty === item.expectedQty) {
      return {
        sku: item.sku,
        name: item.name,
        expectedQty: item.expectedQty,
        actualQty,
        variance,
        status: 'matched' as const,
        flags: [] as Array<'shortage' | 'over_delivery'>,
      }
    }

    if (actualQty > item.expectedQty) {
      return {
        sku: item.sku,
        name: item.name,
        expectedQty: item.expectedQty,
        actualQty,
        variance,
        status: 'discrepancy' as const,
        flags: ['over_delivery'] as Array<'shortage' | 'over_delivery'>,
      }
    }

    return {
      sku: item.sku,
      name: item.name,
      expectedQty: item.expectedQty,
      actualQty,
      variance,
      status: 'partial' as const,
      flags: ['shortage'] as Array<'shortage' | 'over_delivery'>,
    }
  })

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalExpectedQty += row.expectedQty
      acc.totalActualQty += row.actualQty

      if (row.status === 'matched') acc.matchedCount += 1
      if (row.status === 'partial') {
        acc.partialCount += 1
        acc.shortageCount += 1
      }
      if (row.status === 'discrepancy') {
        acc.discrepancyCount += 1
        acc.overDeliveryCount += 1
      }

      return acc
    },
    {
      totalExpectedQty: 0,
      totalActualQty: 0,
      matchedCount: 0,
      partialCount: 0,
      discrepancyCount: 0,
      shortageCount: 0,
      overDeliveryCount: 0,
      wrongItemCount: wrongItems.length,
    }
  )

  totals.discrepancyCount += wrongItems.length

  return {
    sessionId: session.id,
    generatedAt: Date.now(),
    status: 'pending_approval',
    rows,
    wrongItems,
    totals,
  }
}
