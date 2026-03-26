import type { ComputedInventoryState } from '@/lib/inventoryState'
import type { InventoryItem } from '@/store/useInventoryStore'

export type LowStockSeverity = 'normal' | 'low' | 'critical'

export interface LowStockAlert {
  itemId: string
  sku: string
  name: string
  safetyBuffer: number
  currentStock: number
  severity: LowStockSeverity
  thresholdPercent: number
  urgencyScore: number
}

const DEFAULT_BUFFER = 10

const CATEGORY_BUFFERS: Record<string, number> = {
  produce: 6,
  vegetables: 6,
  meat: 8,
  seafood: 8,
  dry: 12,
  grains: 12,
  sauce: 8,
  condiments: 8,
}

const deriveBufferFromCategory = (category: string): number => {
  const normalized = category.trim().toLowerCase()
  for (const [keyword, buffer] of Object.entries(CATEGORY_BUFFERS)) {
    if (normalized.includes(keyword)) {
      return buffer
    }
  }
  return DEFAULT_BUFFER
}

const getSafetyBuffer = (item: InventoryItem): number => {
  if (typeof item.safetyBuffer === 'number' && item.safetyBuffer > 0) {
    return item.safetyBuffer
  }
  return deriveBufferFromCategory(item.category)
}

export const buildLowStockAlerts = (
  inventoryStateItems: ComputedInventoryState[],
  inventoryItems: InventoryItem[]
): LowStockAlert[] => {
  const baseBySku = new Map(inventoryItems.map((item) => [item.sku, item]))

  return inventoryStateItems
    .map((stateItem) => {
      const baseItem = baseBySku.get(stateItem.sku)
      const safetyBuffer = baseItem ? getSafetyBuffer(baseItem) : DEFAULT_BUFFER
      const currentStock = stateItem.projectedAvailable
      const thresholdPercent = safetyBuffer > 0 ? (currentStock / safetyBuffer) * 100 : 0

      let severity: LowStockSeverity = 'normal'
      if (currentStock <= safetyBuffer * 0.5) {
        severity = 'critical'
      } else if (currentStock <= safetyBuffer) {
        severity = 'low'
      }

      const urgencyScore = Math.max(safetyBuffer - currentStock, 0)

      return {
        itemId: stateItem.itemId,
        sku: stateItem.sku,
        name: stateItem.name,
        safetyBuffer,
        currentStock,
        severity,
        thresholdPercent,
        urgencyScore,
      }
    })
    .filter((item) => item.severity !== 'normal')
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1
      }
      if (a.urgencyScore !== b.urgencyScore) {
        return b.urgencyScore - a.urgencyScore
      }
      return a.thresholdPercent - b.thresholdPercent
    })
}
