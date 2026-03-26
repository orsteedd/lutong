import type { PendingScan } from '@/store/useOfflineQueueStore'
import type { InventoryItem } from '@/store/useInventoryStore'

export type ConflictCategory =
  | 'duplicate_record'
  | 'wastage_overrides_transfer'
  | 'same_type_latest_wins'
  | 'negative_inventory_blocked'

export interface ConflictResolutionLog {
  id: string
  conflictType: ConflictCategory
  sku: string
  keptRecordId?: string
  droppedRecordId?: string
  message: string
  timestamp: number
}

export interface UnresolvedConflict {
  id: string
  sku: string
  recordId: string
  reason: string
  timestamp: number
}

interface NormalizedRecord {
  raw: PendingScan
  index: number
}

interface ResolutionResult {
  recordsToSync: PendingScan[]
  resolvedLogs: ConflictResolutionLog[]
  unresolvedConflicts: UnresolvedConflict[]
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const buildDuplicateKey = (record: PendingScan) => {
  const modeMeta = record.metadata
  return [
    record.type,
    record.sku,
    record.quantity,
    record.timestamp,
    modeMeta?.sessionId || '',
    modeMeta?.reason || '',
    modeMeta?.fromLocation || '',
    modeMeta?.toLocation || '',
  ].join('|')
}

const sortByTimestampThenIndex = (a: NormalizedRecord, b: NormalizedRecord) => {
  if (a.raw.timestamp === b.raw.timestamp) {
    return a.index - b.index
  }
  return a.raw.timestamp - b.raw.timestamp
}

const signedDelta = (record: PendingScan): number => {
  if (record.type === 'delivery') return record.quantity
  if (record.type === 'audit') return 0
  return -record.quantity
}

export const detectAndResolveConflicts = (
  records: PendingScan[],
  inventoryItems: InventoryItem[]
): ResolutionResult => {
  const now = Date.now()
  const resolvedLogs: ConflictResolutionLog[] = []
  const unresolvedConflicts: UnresolvedConflict[] = []

  if (records.length === 0) {
    return { recordsToSync: [], resolvedLogs, unresolvedConflicts }
  }

  const bySku = new Map<string, NormalizedRecord[]>()
  records.forEach((record, index) => {
    const bucket = bySku.get(record.sku) || []
    bucket.push({ raw: record, index })
    bySku.set(record.sku, bucket)
  })

  const recordsToSync: PendingScan[] = []
  const dedupeKeysSeen = new Map<string, PendingScan>()

  const inventoryBySku = new Map<string, number>()
  for (const item of inventoryItems) {
    inventoryBySku.set(item.sku, item.quantity)
  }

  for (const [sku, skuRecordsRaw] of bySku.entries()) {
    const skuRecords = [...skuRecordsRaw].sort(sortByTimestampThenIndex)

    const deduped: PendingScan[] = []
    for (const wrapped of skuRecords) {
      const duplicateKey = buildDuplicateKey(wrapped.raw)
      const existing = dedupeKeysSeen.get(duplicateKey)
      if (existing) {
        resolvedLogs.push({
          id: makeId('conflict-dup'),
          conflictType: 'duplicate_record',
          sku,
          keptRecordId: existing.id,
          droppedRecordId: wrapped.raw.id,
          message: `Duplicate ${wrapped.raw.type} record dropped for ${sku}`,
          timestamp: now,
        })
        continue
      }
      dedupeKeysSeen.set(duplicateKey, wrapped.raw)
      deduped.push(wrapped.raw)
    }

    const latestByType = new Map<PendingScan['type'], PendingScan>()
    for (const record of deduped) {
      const prev = latestByType.get(record.type)
      if (!prev) {
        latestByType.set(record.type, record)
        continue
      }
      if (record.timestamp >= prev.timestamp) {
        latestByType.set(record.type, record)
      }
    }

    for (const type of ['delivery', 'transfer', 'wastage', 'audit'] as const) {
      const sameTypeRecords = deduped.filter((record) => record.type === type)
      if (sameTypeRecords.length <= 1) continue

      const kept = latestByType.get(type)
      for (const dropped of sameTypeRecords) {
        if (!kept || dropped.id === kept.id) continue
        resolvedLogs.push({
          id: makeId('conflict-latest'),
          conflictType: 'same_type_latest_wins',
          sku,
          keptRecordId: kept.id,
          droppedRecordId: dropped.id,
          message: `Latest ${type} kept for ${sku}`,
          timestamp: now,
        })
      }
    }

    let perSkuCandidates = Array.from(latestByType.values())

    const latestWastage = latestByType.get('wastage')
    if (latestWastage) {
      const transfers = perSkuCandidates.filter((record) => record.type === 'transfer')
      if (transfers.length > 0) {
        perSkuCandidates = perSkuCandidates.filter((record) => record.type !== 'transfer')
        for (const transfer of transfers) {
          resolvedLogs.push({
            id: makeId('conflict-wot'),
            conflictType: 'wastage_overrides_transfer',
            sku,
            keptRecordId: latestWastage.id,
            droppedRecordId: transfer.id,
            message: `Wastage overrides transfer for ${sku}`,
            timestamp: now,
          })
        }
      }
    }

    const startQuantity = inventoryBySku.get(sku) ?? 0
    let projectedQuantity = startQuantity
    const orderedCandidates = [...perSkuCandidates].sort((a, b) => a.timestamp - b.timestamp)

    for (const record of orderedCandidates) {
      const delta = signedDelta(record)
      const nextQuantity = projectedQuantity + delta

      if (nextQuantity < 0) {
        unresolvedConflicts.push({
          id: makeId('conflict-unresolved'),
          sku,
          recordId: record.id,
          reason: `Applying ${record.type} (${record.quantity}) would make inventory negative.`,
          timestamp: now,
        })
        resolvedLogs.push({
          id: makeId('conflict-negative'),
          conflictType: 'negative_inventory_blocked',
          sku,
          droppedRecordId: record.id,
          message: `Blocked ${record.type} for ${sku} to prevent negative inventory`,
          timestamp: now,
        })
        continue
      }

      projectedQuantity = nextQuantity
      recordsToSync.push(record)
    }
  }

  return {
    recordsToSync,
    resolvedLogs,
    unresolvedConflicts,
  }
}
