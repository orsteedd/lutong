import Dexie, { type Table } from 'dexie'

export interface InventoryItem {
  id?: number
  sku: string
  name: string
  quantity: number
  unit: string
  category: string
  location?: string
  createdAt: number
  updatedAt: number
}

export interface SyncLog {
  id?: number
  action: 'add' | 'update' | 'delete'
  itemId: string
  timestamp: number
  synced: boolean
}

export interface ScanLog {
  id: string
  sku: string
  quantity: number
  timestamp: number
  status: 'success' | 'error'
  message?: string
}

export interface PendingSyncItem {
  id: string
  type: 'scan' | 'wastage' | 'transfer' | 'delivery' | 'audit'
  payload: string
  timestamp: number
  updatedAt: number
  status: 'pending' | 'synced' | 'error'
  error?: string
}

export interface ScanQueueRecord {
  id: string
  type: 'delivery' | 'transfer' | 'wastage' | 'audit'
  sku: string
  name: string
  quantity: number
  timestamp: number
  synced: boolean
  metadata?: {
    sessionId?: string
    reason?: string
    fromLocation?: string
    toLocation?: string
  }
  error?: string
}

export class InventoryDB extends Dexie {
  items!: Table<InventoryItem>
  syncLog!: Table<SyncLog>
  scanLogs!: Table<ScanLog>
  pendingSyncItems!: Table<PendingSyncItem>
  scanQueue!: Table<ScanQueueRecord>

  constructor() {
    super('InventoryDB')
    this.version(1).stores({
      items: '++id, sku, category',
      syncLog: '++id, itemId, synced',
    })

    this.version(2).stores({
      items: '++id, sku, category',
      syncLog: '++id, itemId, synced',
      scanLogs: '&id, sku, timestamp, status',
      pendingSyncItems: '&id, type, status, timestamp',
    })

    this.version(3).stores({
      items: '++id, sku, category',
      syncLog: '++id, itemId, synced',
      scanLogs: '&id, sku, timestamp, status',
      pendingSyncItems: '&id, type, status, timestamp',
      scanQueue: '&id, type, timestamp, synced, sku',
    })
  }
}

export const db = new InventoryDB()

export const logScanEvent = async (entry: ScanLog) => {
  await db.scanLogs.put(entry)
}

export const upsertPendingSyncItem = async (item: PendingSyncItem) => {
  await db.pendingSyncItems.put(item)
}

export const setPendingSyncStatus = async (
  id: string,
  status: PendingSyncItem['status'],
  error?: string
) => {
  const existing = await db.pendingSyncItems.get(id)
  if (!existing) return

  await db.pendingSyncItems.update(id, {
    status,
    error,
    updatedAt: Date.now(),
  })
}

export const saveScan = async (record: ScanQueueRecord) => {
  await db.scanQueue.put(record)
}

export const getAllScans = async () => {
  return db.scanQueue.orderBy('timestamp').reverse().toArray()
}

export const getPendingSyncItems = async (statuses: PendingSyncItem['status'][] = ['pending', 'error']) => {
  return db.pendingSyncItems
    .where('status')
    .anyOf(statuses)
    .toArray()
}

export const deleteScan = async (id: string) => {
  await db.scanQueue.delete(id)
}

export const clearScans = async () => {
  await db.scanQueue.clear()
}

export const clearAllLocalDatabase = async () => {
  await db.items.clear()
  await db.syncLog.clear()
  await db.scanLogs.clear()
  await db.pendingSyncItems.clear()
  await db.scanQueue.clear()
}
