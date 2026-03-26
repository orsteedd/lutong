import type { ApprovalRecord } from '@/store/useApprovalStore'
import type { InventoryItem } from '@/store/useInventoryStore'

export interface ApprovalApplyResult {
  nextItems: InventoryItem[]
  appliedCount: number
  warnings: string[]
}

export const applyApprovalRecordToInventory = (
  record: ApprovalRecord,
  items: InventoryItem[]
): ApprovalApplyResult => {
  const warnings: string[] = []
  const nextItems = [...items]
  let appliedCount = 0

  for (const line of record.lineItems) {
    const index = nextItems.findIndex(
      (item) => (line.itemId ? item.id === line.itemId : false) || item.sku === line.sku
    )

    if (index === -1) {
      warnings.push(`Skipped ${line.sku}: item not found in inventory.`)
      continue
    }

    const target = nextItems[index]
    const rawNextQty = target.quantity + line.delta
    const clampedNextQty = Math.max(rawNextQty, 0)

    if (rawNextQty < 0) {
      warnings.push(`Clamped ${line.sku} to 0 to prevent negative stock.`)
    }

    nextItems[index] = {
      ...target,
      quantity: clampedNextQty,
      lastUpdated: Date.now(),
    }
    appliedCount += 1
  }

  return { nextItems, appliedCount, warnings }
}
