import type { PendingScan } from '@/store/useOfflineQueueStore'
import type { InventoryItem } from '@/store/useInventoryStore'

export interface ComputedInventoryState {
  itemId: string
  sku: string
  name: string
  baseStock: number
  confirmedAvailable: number
  stockQty: number
  displayQty: number
  pendingInbound: number
  pendingOutbound: number
  pendingToDisplay: number
  pendingNet: number
  wastageLocked: number
  adjustmentPendingApproval: number
  projectedAvailable: number
  projectedStockQty: number
  projectedDisplayQty: number
  preventedNegativeConfirmed: number
  preventedNegativePending: number
}

export interface InventoryStateTotals {
  confirmedAvailable: number
  stockQty: number
  displayQty: number
  projectedAvailable: number
  projectedStockQty: number
  projectedDisplayQty: number
  pendingInbound: number
  pendingOutbound: number
  pendingToDisplay: number
  pendingNet: number
  wastageLocked: number
  adjustmentPendingApproval: number
  preventedNegativeConfirmed: number
  preventedNegativePending: number
}

export interface InventoryStateSnapshot {
  items: ComputedInventoryState[]
  totals: InventoryStateTotals
}

const sortByTimestamp = (a: PendingScan, b: PendingScan) => a.timestamp - b.timestamp

const applyConfirmedRecord = (state: ComputedInventoryState, record: PendingScan) => {
  if (record.type === 'delivery') {
    state.confirmedAvailable += record.quantity
    state.stockQty += record.quantity
    return
  }

  if (record.type === 'transfer') {
    const movable = Math.min(record.quantity, state.stockQty)
    if (movable < record.quantity) {
      state.preventedNegativeConfirmed += record.quantity - movable
    }
    state.stockQty -= movable
    state.displayQty += movable
    return
  }

  if (record.type === 'wastage') {
    let remaining = record.quantity

    const fromStock = Math.min(remaining, state.stockQty)
    state.stockQty -= fromStock
    remaining -= fromStock

    if (remaining > 0) {
      const fromDisplay = Math.min(remaining, state.displayQty)
      state.displayQty -= fromDisplay
      remaining -= fromDisplay
    }

    if (remaining > 0) {
      state.preventedNegativeConfirmed += remaining
    }

    state.confirmedAvailable = state.stockQty + state.displayQty
    return
  }

  if (record.type === 'adjust' || record.type === 'audit') {
    const targetTotal = Math.max(record.quantity, 0)
    if (state.displayQty > targetTotal) {
      state.displayQty = targetTotal
      state.stockQty = 0
    } else {
      state.stockQty = targetTotal - state.displayQty
    }
    state.confirmedAvailable = targetTotal
  }
}

const applyPendingRecord = (state: ComputedInventoryState, record: PendingScan) => {
  if (record.type === 'delivery') {
    state.pendingInbound += record.quantity
    return
  }

  if (record.type === 'transfer') {
    state.pendingToDisplay += record.quantity
    return
  }

  if (record.type === 'wastage') {
    state.pendingOutbound += record.quantity
    state.wastageLocked += record.quantity
    return
  }

  if (record.type === 'adjust' || record.type === 'audit') {
    state.adjustmentPendingApproval = record.quantity - state.confirmedAvailable
  }
}

const createDefaultTotals = (): InventoryStateTotals => ({
  confirmedAvailable: 0,
  stockQty: 0,
  displayQty: 0,
  projectedAvailable: 0,
  projectedStockQty: 0,
  projectedDisplayQty: 0,
  pendingInbound: 0,
  pendingOutbound: 0,
  pendingToDisplay: 0,
  pendingNet: 0,
  wastageLocked: 0,
  adjustmentPendingApproval: 0,
  preventedNegativeConfirmed: 0,
  preventedNegativePending: 0,
})

export const computeInventoryStateSnapshot = (
  baseItems: InventoryItem[],
  scanRecords: PendingScan[]
): InventoryStateSnapshot => {
  const itemMap = new Map<string, ComputedInventoryState>()

  for (const item of baseItems) {
    itemMap.set(item.sku, {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      baseStock: item.quantity,
      confirmedAvailable: item.quantity,
      stockQty: item.quantity,
      displayQty: 0,
      pendingInbound: 0,
      pendingOutbound: 0,
      pendingToDisplay: 0,
      pendingNet: 0,
      wastageLocked: 0,
      adjustmentPendingApproval: 0,
      projectedAvailable: item.quantity,
      projectedStockQty: item.quantity,
      projectedDisplayQty: 0,
      preventedNegativeConfirmed: 0,
      preventedNegativePending: 0,
    })
  }

  const getOrCreateState = (sku: string) => {
    const existing = itemMap.get(sku)
    if (existing) return existing

    const fallback: ComputedInventoryState = {
      itemId: `UNREGISTERED-${sku}`,
      sku,
      name: 'Unknown Item',
      baseStock: 0,
      confirmedAvailable: 0,
      stockQty: 0,
      displayQty: 0,
      pendingInbound: 0,
      pendingOutbound: 0,
      pendingToDisplay: 0,
      pendingNet: 0,
      wastageLocked: 0,
      adjustmentPendingApproval: 0,
      projectedAvailable: 0,
      projectedStockQty: 0,
      projectedDisplayQty: 0,
      preventedNegativeConfirmed: 0,
      preventedNegativePending: 0,
    }
    itemMap.set(sku, fallback)
    return fallback
  }

  const confirmedRecords = scanRecords.filter((record) => record.synced).sort(sortByTimestamp)
  const pendingRecords = scanRecords.filter((record) => !record.synced).sort(sortByTimestamp)

  for (const record of confirmedRecords) {
    const state = getOrCreateState(record.sku)
    applyConfirmedRecord(state, record)
  }

  for (const record of pendingRecords) {
    const state = getOrCreateState(record.sku)
    applyPendingRecord(state, record)
  }

  const items = Array.from(itemMap.values()).map((state) => {
    const pendingNet = state.pendingInbound - state.pendingOutbound
    const stockBeforeTransfer = state.stockQty + state.pendingInbound - state.pendingOutbound
    const sanitizedStockBeforeTransfer = Math.max(stockBeforeTransfer, 0)
    const effectivePendingToDisplay = Math.min(state.pendingToDisplay, sanitizedStockBeforeTransfer)
    const projectedStockQty = sanitizedStockBeforeTransfer - effectivePendingToDisplay
    const projectedDisplayQty = state.displayQty + effectivePendingToDisplay
    const projectedAvailable = projectedStockQty + projectedDisplayQty
    const preventedNegativePending =
      (stockBeforeTransfer < 0 ? Math.abs(stockBeforeTransfer) : 0) +
      (state.pendingToDisplay - effectivePendingToDisplay)

    return {
      ...state,
      confirmedAvailable: state.stockQty + state.displayQty,
      pendingNet,
      projectedAvailable,
      projectedStockQty,
      projectedDisplayQty,
      preventedNegativePending,
    }
  })

  const totals = items.reduce((acc, item) => {
    acc.confirmedAvailable += item.confirmedAvailable
    acc.stockQty += item.stockQty
    acc.displayQty += item.displayQty
    acc.projectedAvailable += item.projectedAvailable
    acc.projectedStockQty += item.projectedStockQty
    acc.projectedDisplayQty += item.projectedDisplayQty
    acc.pendingInbound += item.pendingInbound
    acc.pendingOutbound += item.pendingOutbound
    acc.pendingToDisplay += item.pendingToDisplay
    acc.pendingNet += item.pendingNet
    acc.wastageLocked += item.wastageLocked
    acc.adjustmentPendingApproval += item.adjustmentPendingApproval
    acc.preventedNegativeConfirmed += item.preventedNegativeConfirmed
    acc.preventedNegativePending += item.preventedNegativePending
    return acc
  }, createDefaultTotals())

  return {
    items,
    totals,
  }
}
