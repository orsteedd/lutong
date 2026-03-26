import type { ComputedInventoryState } from '@/lib/inventoryState'
import type { PendingScan } from '@/store/useOfflineQueueStore'

export type ForecastConfidence = 'low' | 'medium' | 'high'

export interface StockForecastRow {
  itemId: string
  sku: string
  name: string
  currentStock: number
  averageDailyUsage: number
  estimatedDaysRemaining: number
  confidence: ForecastConfidence
  lowDataWarning: boolean
  dataPoints: number
  activeDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const toDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const getConfidence = (dataPoints: number, activeDays: number): ForecastConfidence => {
  if (dataPoints < 3 || activeDays < 2) return 'low'
  if (dataPoints < 8 || activeDays < 4) return 'medium'
  return 'high'
}

export const buildStockForecast = (
  inventoryStateItems: ComputedInventoryState[],
  scanRecords: PendingScan[],
  lookbackDays: number = 7,
  now: number = Date.now()
): StockForecastRow[] => {
  const windowStart = now - lookbackDays * DAY_MS

  const usageBySkuByDay = new Map<string, Map<number, number>>()
  const usageEventCountBySku = new Map<string, number>()

  const usageRecords = scanRecords.filter(
    (record) =>
      record.timestamp >= windowStart &&
      (record.type === 'transfer' || record.type === 'wastage')
  )

  for (const record of usageRecords) {
    const day = toDayStart(record.timestamp)
    const skuMap = usageBySkuByDay.get(record.sku) || new Map<number, number>()
    skuMap.set(day, (skuMap.get(day) ?? 0) + record.quantity)
    usageBySkuByDay.set(record.sku, skuMap)

    usageEventCountBySku.set(record.sku, (usageEventCountBySku.get(record.sku) ?? 0) + 1)
  }

  return inventoryStateItems
    .map((item) => {
      const usageByDay = usageBySkuByDay.get(item.sku) || new Map<number, number>()
      const totalUsage = Array.from(usageByDay.values()).reduce((sum, qty) => sum + qty, 0)
      const averageDailyUsage = totalUsage / Math.max(lookbackDays, 1)
      const estimatedDaysRemaining =
        averageDailyUsage > 0 ? item.projectedAvailable / averageDailyUsage : Number.POSITIVE_INFINITY

      const dataPoints = usageEventCountBySku.get(item.sku) ?? 0
      const activeDays = usageByDay.size
      const confidence = getConfidence(dataPoints, activeDays)

      return {
        itemId: item.itemId,
        sku: item.sku,
        name: item.name,
        currentStock: item.projectedAvailable,
        averageDailyUsage,
        estimatedDaysRemaining,
        confidence,
        lowDataWarning: confidence === 'low',
        dataPoints,
        activeDays,
      }
    })
    .sort((a, b) => {
      const aFinite = Number.isFinite(a.estimatedDaysRemaining)
      const bFinite = Number.isFinite(b.estimatedDaysRemaining)

      if (aFinite && !bFinite) return -1
      if (!aFinite && bFinite) return 1
      if (!aFinite && !bFinite) return a.sku.localeCompare(b.sku)

      return a.estimatedDaysRemaining - b.estimatedDaysRemaining
    })
}
