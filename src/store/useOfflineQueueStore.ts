import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clearScans,
  deleteScan,
  getAllScans,
  logScanEvent,
  saveScan,
  setPendingSyncStatus,
  upsertPendingSyncItem,
} from '@/lib/db'
import {
  detectAndResolveConflicts,
  type ConflictResolutionLog,
  type UnresolvedConflict,
} from '@/lib/conflictResolution'
import { sendPendingScansToApi } from '@/lib/syncApi'
import { useActivityLogStore } from '@/store/useActivityLogStore'
import { useInventoryStore } from '@/store/useInventoryStore'

const logDbError = (context: string, error: unknown) => {
  console.error(`[offline-queue-store] ${context}`, error)
}

const PERSISTENCE_FLUSH_MS = 24
let persistenceTimer: ReturnType<typeof setTimeout> | null = null
let persistenceBuffer: PendingScan[] = []

const flushBufferedScans = () => {
  const scans = persistenceBuffer
  persistenceBuffer = []
  persistenceTimer = null

  if (scans.length === 0) return

  void Promise.all(
    scans.map(async (scan) => {
      await Promise.all([
        saveScan(scan).catch((error) => logDbError('saveScan failed', error)),
        logScanEvent({
          id: scan.id,
          sku: scan.sku,
          quantity: scan.quantity,
          timestamp: scan.timestamp,
          status: 'success',
          message: `Queued ${scan.type} ${scan.sku}`,
        }).catch((error) => logDbError('logScanEvent failed', error)),
        upsertPendingSyncItem({
          id: scan.id,
          type: scan.type,
          payload: JSON.stringify(scan),
          timestamp: scan.timestamp,
          updatedAt: Date.now(),
          status: 'pending',
        }).catch((error) => logDbError('upsertPendingSyncItem(scan) failed', error)),
      ])
    })
  )
}

const enqueueBufferedScanPersistence = (scan: PendingScan) => {
  persistenceBuffer.push(scan)

  if (persistenceTimer) return
  persistenceTimer = setTimeout(flushBufferedScans, PERSISTENCE_FLUSH_MS)
}

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const ensureStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const ensureSyncStatus = (value: unknown): 'pending' | 'synced' | 'error' => {
  if (value === 'pending' || value === 'synced' || value === 'error') return value
  return 'synced'
}

export interface PendingScan {
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

export interface WastageLog {
  id: string
  sku: string
  quantity: number
  reason: string
  note?: string
  timestamp: number
  synced: boolean
  error?: string
}

export interface TransferLog {
  id: string
  sku: string
  quantity: number
  fromLocation: string
  toLocation: string
  note?: string
  timestamp: number
  synced: boolean
  error?: string
}

interface OfflineQueueStore {
  scanQueue: PendingScan[]
  pendingScans: PendingScan[]
  wastageLogs: WastageLog[]
  transferLogs: TransferLog[]
  conflictResolutionLogs: ConflictResolutionLog[]
  unresolvedConflicts: UnresolvedConflict[]
  isSyncing: boolean
  isHydrating: boolean
  syncStatus: 'pending' | 'synced' | 'error'
  syncError: string | null

  enqueueScan: (scan: PendingScan) => void
  enqueueWastage: (log: WastageLog) => void
  enqueueTransfer: (log: TransferLog) => void

  markScanSynced: (id: string) => void
  markWastageSynced: (id: string) => void
  markTransferSynced: (id: string) => void
  setScanError: (id: string, error: string) => void
  setWastageError: (id: string, error: string) => void
  setTransferError: (id: string, error: string) => void

  removeScan: (id: string) => void
  removeWastage: (id: string) => void
  removeTransfer: (id: string) => void

  setSyncing: (syncing: boolean) => void
  clearSynced: () => void
  clearAllQueues: () => void
  clearConflictLogs: () => void
  clearUnresolvedConflicts: () => void
  hydrateScanQueue: () => Promise<void>
  syncPendingScans: () => Promise<void>
  retrySync: () => Promise<void>

  pendingScansCount: () => number
  pendingWastageCount: () => number
  pendingTransfersCount: () => number
  totalPendingCount: () => number
}

export const useOfflineQueueStore = create<OfflineQueueStore>()(
  persist(
    (set, get) => ({
      scanQueue: [],
      pendingScans: [],
      wastageLogs: [],
      transferLogs: [],
      conflictResolutionLogs: [],
      unresolvedConflicts: [],
      isSyncing: false,
      isHydrating: false,
      syncStatus: 'synced',
      syncError: null,

      enqueueScan: (scan) =>
        set((state) => {
          // Keep foreground scan path minimal and defer persistence/log overhead.
          enqueueBufferedScanPersistence(scan)
          void Promise.resolve().then(() => {
            useActivityLogStore.getState().addLog({
              user_id: 'operator-local',
              action_type: 'scan_recorded',
              item_id: scan.sku,
              timestamp: scan.timestamp,
              details: `${scan.type} quantity=${scan.quantity}`,
            })
          })

          const nextQueue = [scan, ...state.scanQueue]
          return {
            scanQueue: nextQueue,
            pendingScans: nextQueue,
            syncStatus: 'pending',
            syncError: null,
          }
        }),
      enqueueWastage: (log) =>
        set((state) => {
          void upsertPendingSyncItem({
            id: log.id,
            type: 'wastage',
            payload: JSON.stringify(log),
            timestamp: log.timestamp,
            updatedAt: Date.now(),
            status: 'pending',
          }).catch((error) => logDbError('upsertPendingSyncItem(wastage) failed', error))
          return { wastageLogs: [log, ...state.wastageLogs] }
        }),
      enqueueTransfer: (log) =>
        set((state) => {
          void upsertPendingSyncItem({
            id: log.id,
            type: 'transfer',
            payload: JSON.stringify(log),
            timestamp: log.timestamp,
            updatedAt: Date.now(),
            status: 'pending',
          }).catch((error) => logDbError('upsertPendingSyncItem(transfer) failed', error))
          return { transferLogs: [log, ...state.transferLogs] }
        }),

      markScanSynced: (id) =>
        set((state) => {
          void setPendingSyncStatus(id, 'synced').catch((error) =>
            logDbError('setPendingSyncStatus(scan:synced) failed', error)
          )
          const nextQueue = state.scanQueue.map((item) =>
            item.id === id ? { ...item, synced: true, error: undefined } : item
          )
          return {
            scanQueue: nextQueue,
            pendingScans: nextQueue,
          }
        }),
      markWastageSynced: (id) =>
        set((state) => {
          void setPendingSyncStatus(id, 'synced').catch((error) =>
            logDbError('setPendingSyncStatus(wastage:synced) failed', error)
          )
          return {
            wastageLogs: state.wastageLogs.map((item) =>
              item.id === id ? { ...item, synced: true, error: undefined } : item
            ),
          }
        }),
      markTransferSynced: (id) =>
        set((state) => {
          void setPendingSyncStatus(id, 'synced').catch((error) =>
            logDbError('setPendingSyncStatus(transfer:synced) failed', error)
          )
          return {
            transferLogs: state.transferLogs.map((item) =>
              item.id === id ? { ...item, synced: true, error: undefined } : item
            ),
          }
        }),
      setScanError: (id, error) =>
        set((state) => {
          void setPendingSyncStatus(id, 'error', error).catch((err) =>
            logDbError('setPendingSyncStatus(scan:error) failed', err)
          )
          const nextQueue = state.scanQueue.map((item) =>
            item.id === id ? { ...item, synced: false, error } : item
          )
          return {
            scanQueue: nextQueue,
            pendingScans: nextQueue,
          }
        }),
      setWastageError: (id, error) =>
        set((state) => {
          void setPendingSyncStatus(id, 'error', error).catch((err) =>
            logDbError('setPendingSyncStatus(wastage:error) failed', err)
          )
          return {
            wastageLogs: state.wastageLogs.map((item) =>
              item.id === id ? { ...item, synced: false, error } : item
            ),
          }
        }),
      setTransferError: (id, error) =>
        set((state) => {
          void setPendingSyncStatus(id, 'error', error).catch((err) =>
            logDbError('setPendingSyncStatus(transfer:error) failed', err)
          )
          return {
            transferLogs: state.transferLogs.map((item) =>
              item.id === id ? { ...item, synced: false, error } : item
            ),
          }
        }),

      removeScan: (id) =>
        set((state) => {
          void deleteScan(id).catch((error) => logDbError('deleteScan failed', error))
          const nextQueue = state.scanQueue.filter((item) => item.id !== id)
          return {
            scanQueue: nextQueue,
            pendingScans: nextQueue,
          }
        }),
      removeWastage: (id) =>
        set((state) => ({
          wastageLogs: state.wastageLogs.filter((item) => item.id !== id),
        })),
      removeTransfer: (id) =>
        set((state) => ({
          transferLogs: state.transferLogs.filter((item) => item.id !== id),
        })),

      setSyncing: (syncing) => set({ isSyncing: syncing }),
      clearSynced: () =>
        set((state) => {
          const nextQueue = state.scanQueue.filter((item) => !item.synced)
          const syncedIds = state.scanQueue.filter((item) => item.synced).map((item) => item.id)
          for (const id of syncedIds) {
            void deleteScan(id).catch((error) => logDbError('deleteScan(synced) failed', error))
          }
          return {
            scanQueue: nextQueue,
            pendingScans: nextQueue,
            wastageLogs: state.wastageLogs.filter((item) => !item.synced),
            transferLogs: state.transferLogs.filter((item) => !item.synced),
            syncStatus: nextQueue.length > 0 ? 'pending' : 'synced',
          }
        }),
      clearAllQueues: () =>
        set(() => {
          void clearScans().catch((error) => logDbError('clearScans failed', error))
          return {
            scanQueue: [],
            pendingScans: [],
            wastageLogs: [],
            transferLogs: [],
            conflictResolutionLogs: [],
            unresolvedConflicts: [],
            syncStatus: 'synced',
            syncError: null,
          }
        }),

      clearConflictLogs: () => set({ conflictResolutionLogs: [] }),
      clearUnresolvedConflicts: () => set({ unresolvedConflicts: [] }),

      hydrateScanQueue: async () => {
        set({ isHydrating: true })
        try {
          const scans = await getAllScans()
          set({
            scanQueue: scans,
            pendingScans: scans,
            isHydrating: false,
            syncStatus: scans.length > 0 ? 'pending' : 'synced',
          })
        } catch (error) {
          logDbError('hydrateScanQueue failed', error)
          set({ isHydrating: false, syncStatus: 'error', syncError: 'Failed to hydrate queue' })
        }
      },

      syncPendingScans: async () => {
        const state = get()
        if (state.isSyncing) return

        const pending = state.scanQueue.filter((scan) => !scan.synced)
        if (pending.length === 0) {
          set({ syncStatus: 'synced', syncError: null, isSyncing: false })
          return
        }

        set({ isSyncing: true, syncStatus: 'pending', syncError: null })

        const inventoryItems = useInventoryStore.getState().items
        const conflictResult = detectAndResolveConflicts(pending, inventoryItems)
        const recordsToSync = conflictResult.recordsToSync
        const unresolvedById = new Map(
          conflictResult.unresolvedConflicts.map((conflict) => [conflict.recordId, conflict])
        )
        const recordsToSyncIds = new Set(recordsToSync.map((record) => record.id))
        const droppedByResolution = pending.filter(
          (record) =>
            !recordsToSyncIds.has(record.id) && !unresolvedById.has(record.id)
        )

        for (const event of conflictResult.resolvedLogs) {
          console.info('[conflict-resolution]', event)
        }

        for (const conflict of conflictResult.unresolvedConflicts) {
          console.warn('[conflict-resolution][unresolved]', conflict)
          void setPendingSyncStatus(conflict.recordId, 'error', conflict.reason).catch((err) =>
            logDbError('setPendingSyncStatus(unresolved conflict) failed', err)
          )
        }

        for (const dropped of droppedByResolution) {
          void setPendingSyncStatus(dropped.id, 'synced').catch((error) =>
            logDbError('setPendingSyncStatus(conflict-resolved drop) failed', error)
          )
          void deleteScan(dropped.id).catch((error) =>
            logDbError('deleteScan(conflict-resolved drop) failed', error)
          )
        }

        if (recordsToSync.length === 0) {
          set((current) => {
            const droppedIds = new Set(droppedByResolution.map((record) => record.id))
            const unresolvedIds = new Set(conflictResult.unresolvedConflicts.map((conflict) => conflict.recordId))

            const nextQueue = current.scanQueue
              .filter((scan) => !droppedIds.has(scan.id))
              .map((scan) => {
                if (!unresolvedIds.has(scan.id)) return scan
                const unresolved = unresolvedById.get(scan.id)
                return {
                  ...scan,
                  synced: false,
                  error: unresolved?.reason || 'Unresolved conflict',
                }
              })

            return {
              scanQueue: nextQueue,
              pendingScans: nextQueue,
              isSyncing: false,
              syncStatus: unresolvedIds.size > 0 ? 'error' : nextQueue.length > 0 ? 'pending' : 'synced',
              syncError:
                unresolvedIds.size > 0
                  ? 'Unresolved conflicts require admin review'
                  : null,
              conflictResolutionLogs: [
                ...conflictResult.resolvedLogs,
                ...current.conflictResolutionLogs,
              ].slice(0, 200),
              unresolvedConflicts: conflictResult.unresolvedConflicts,
            }
          })
          return
        }

        try {
          const response = await sendPendingScansToApi(recordsToSync)
          const syncedIds = new Set(response.syncedIds)

          for (const id of syncedIds) {
            void setPendingSyncStatus(id, 'synced').catch((error) =>
              logDbError('setPendingSyncStatus(sync success) failed', error)
            )
            void deleteScan(id).catch((error) => logDbError('deleteScan(sync success) failed', error))
          }

          set((current) => {
            const droppedIds = new Set(droppedByResolution.map((record) => record.id))
            const unresolvedIds = new Set(conflictResult.unresolvedConflicts.map((conflict) => conflict.recordId))
            const removableIds = new Set<string>([...syncedIds, ...droppedIds])

            const nextQueue = current.scanQueue
              .filter((scan) => !removableIds.has(scan.id))
              .map((scan) => {
                if (!unresolvedIds.has(scan.id)) return scan
                const unresolved = unresolvedById.get(scan.id)
                return {
                  ...scan,
                  synced: false,
                  error: unresolved?.reason || 'Unresolved conflict',
                }
              })

            return {
              scanQueue: nextQueue,
              pendingScans: nextQueue,
              isSyncing: false,
              syncStatus: unresolvedIds.size > 0 ? 'error' : nextQueue.length > 0 ? 'pending' : 'synced',
              syncError: unresolvedIds.size > 0 ? 'Unresolved conflicts require admin review' : null,
              conflictResolutionLogs: [
                ...conflictResult.resolvedLogs,
                ...current.conflictResolutionLogs,
              ].slice(0, 200),
              unresolvedConflicts: conflictResult.unresolvedConflicts,
            }
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sync failed'

          for (const scan of recordsToSync) {
            void setPendingSyncStatus(scan.id, 'error', message).catch((err) =>
              logDbError('setPendingSyncStatus(sync error) failed', err)
            )
          }

          set((current) => {
            const attemptedIds = new Set(recordsToSync.map((record) => record.id))
            const unresolvedIds = new Set(conflictResult.unresolvedConflicts.map((conflict) => conflict.recordId))
            const erroredQueue = current.scanQueue.map((scan) =>
              attemptedIds.has(scan.id)
                ? { ...scan, error: message, synced: false }
                : unresolvedIds.has(scan.id)
                  ? {
                      ...scan,
                      error: unresolvedById.get(scan.id)?.reason || 'Unresolved conflict',
                      synced: false,
                    }
                  : scan
            )
            return {
              scanQueue: erroredQueue,
              pendingScans: erroredQueue,
              isSyncing: false,
              syncStatus: 'error',
              syncError:
                conflictResult.unresolvedConflicts.length > 0
                  ? `${message}. Unresolved conflicts require admin review.`
                  : message,
              conflictResolutionLogs: [
                ...conflictResult.resolvedLogs,
                ...current.conflictResolutionLogs,
              ].slice(0, 200),
              unresolvedConflicts: conflictResult.unresolvedConflicts,
            }
          })
        }
      },

      retrySync: async () => {
        set({ syncError: null, syncStatus: 'pending' })
        await get().syncPendingScans()
      },

      pendingScansCount: () => get().scanQueue.filter((s) => !s.synced).length,
      pendingWastageCount: () => get().wastageLogs.filter((s) => !s.synced).length,
      pendingTransfersCount: () => get().transferLogs.filter((s) => !s.synced).length,
      totalPendingCount: () => {
        const state = get()
        return (
          state.scanQueue.filter((s) => !s.synced).length +
          state.wastageLogs.filter((s) => !s.synced).length +
          state.transferLogs.filter((s) => !s.synced).length
        )
      },
    }),
    {
      name: 'offline-queue-store',
      version: 2,
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<OfflineQueueStore> | undefined) ?? {}
        const scanQueue = ensureArray<PendingScan>(incoming.scanQueue)
        const pendingScans = ensureArray<PendingScan>(incoming.pendingScans)

        return {
          ...currentState,
          ...incoming,
          scanQueue,
          pendingScans,
          wastageLogs: ensureArray<WastageLog>(incoming.wastageLogs),
          transferLogs: ensureArray<TransferLog>(incoming.transferLogs),
          conflictResolutionLogs: ensureArray<ConflictResolutionLog>(incoming.conflictResolutionLogs),
          unresolvedConflicts: ensureArray<UnresolvedConflict>(incoming.unresolvedConflicts),
          isSyncing: false,
          isHydrating: false,
          syncStatus: ensureSyncStatus(incoming.syncStatus),
          syncError: ensureStringOrNull(incoming.syncError),
        }
      },
    }
  )
)
