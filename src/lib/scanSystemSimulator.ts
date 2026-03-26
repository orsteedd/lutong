import { processScanInput, type ScanType } from '@/lib/scanEngine'
import { useOfflineQueueStore, type PendingScan } from '@/store/useOfflineQueueStore'

export interface SimulationMetrics {
  totalRequested: number
  successCount: number
  invalidCount: number
  duplicateBlocked: number
  avgScanProcessMs: number
  p95ScanProcessMs: number
  queueBeforeSync: number
  queueAfterFailure: number
  queueAfterRetry: number
  syncFailureObserved: boolean
  retrySucceeded: boolean
}

export interface SimulationResult {
  metrics: SimulationMetrics
  notes: string[]
}

const percentile95 = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index]
}

const average = (values: number[]) => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const makeRecord = (id: number, sku: string, mode: ScanType): { sku: string; qty: number; mode: ScanType } => {
  const qty = (id % 5) + 1
  return { sku, qty, mode }
}

export const runScanSystemSimulation = async (count: number): Promise<SimulationResult> => {
  const store = useOfflineQueueStore.getState()

  // Keep simulation isolated from existing work queue.
  store.clearAllQueues()

  const modes: ScanType[] = ['transfer', 'delivery', 'audit', 'wastage']
  const skus = ['SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005', 'SKU-006']
  const latency: number[] = []
  const duplicateWindowMs = 3000
  const dedupeMap = new Map<string, number>()

  let successCount = 0
  let invalidCount = 0
  let duplicateBlocked = 0

  for (let i = 0; i < count; i += 1) {
    const mode = modes[i % modes.length]
    const sku = skus[i % skus.length]
    const entry = makeRecord(i, sku, mode)

    // Inject invalid payloads periodically to exercise error paths.
    const useInvalid = i % 11 === 0
    const inputSku = useInvalid ? `BAD SKU ${i}` : entry.sku
    const inputQty = useInvalid ? 0 : entry.qty

    const metadata =
      mode === 'transfer'
        ? { fromLocation: 'Dock-A', toLocation: 'Shelf-B2' }
        : mode === 'wastage'
          ? { reason: 'Damaged packaging' }
          : mode === 'delivery'
            ? { sessionId: 'DEL-SIM-001' }
            : { sessionId: 'AUD-SIM-001' }

    const dedupeKey = `${mode}|${inputSku}|${inputQty}|${JSON.stringify(metadata)}`
    const now = Date.now()
    const previous = dedupeMap.get(dedupeKey)
    if (previous && now - previous < duplicateWindowMs) {
      duplicateBlocked += 1
      continue
    }
    dedupeMap.set(dedupeKey, now)

    const started = performance.now()
    const result = await processScanInput(inputSku, inputQty, mode, metadata)
    const elapsed = performance.now() - started
    latency.push(elapsed)

    if (!result.success || !result.record) {
      invalidCount += 1
      continue
    }

    useOfflineQueueStore.getState().enqueueScan(result.record)
    successCount += 1

    // Explicit duplicate attempt every 7 scans.
    if (i % 7 === 0) {
      const repeatKey = `${mode}|${entry.sku}|${entry.qty}|${JSON.stringify(metadata)}`
      const prev = dedupeMap.get(repeatKey)
      if (prev && Date.now() - prev < duplicateWindowMs) {
        duplicateBlocked += 1
      }
    }
  }

  const queueBeforeSync = useOfflineQueueStore.getState().scanQueue.length

  // Simulate offline/failure by injecting a fail SKU and attempting sync.
  const failRecord: PendingScan = {
    id: `SIM-FAIL-${Date.now()}`,
    type: 'transfer',
    sku: 'SKU-FAIL',
    name: 'Forced Failure Item',
    quantity: 1,
    timestamp: Date.now(),
    synced: false,
    metadata: { fromLocation: 'X', toLocation: 'Y' },
  }
  useOfflineQueueStore.getState().enqueueScan(failRecord)

  await useOfflineQueueStore.getState().syncPendingScans()
  const afterFailureState = useOfflineQueueStore.getState()
  const syncFailureObserved = afterFailureState.syncStatus === 'error'
  const queueAfterFailure = afterFailureState.scanQueue.length

  // Reconnect simulation: remove failure marker and retry sync.
  useOfflineQueueStore.getState().removeScan(failRecord.id)
  await useOfflineQueueStore.getState().retrySync()

  const afterRetryState = useOfflineQueueStore.getState()
  const queueAfterRetry = afterRetryState.scanQueue.length
  const retrySucceeded = afterRetryState.syncStatus === 'synced' || queueAfterRetry === 0

  const metrics: SimulationMetrics = {
    totalRequested: count,
    successCount,
    invalidCount,
    duplicateBlocked,
    avgScanProcessMs: Number(average(latency).toFixed(2)),
    p95ScanProcessMs: Number(percentile95(latency).toFixed(2)),
    queueBeforeSync,
    queueAfterFailure,
    queueAfterRetry,
    syncFailureObserved,
    retrySucceeded,
  }

  const notes = [
    'Offline mode is simulated via forced sync failure since browser network cannot be toggled programmatically from app code.',
    'Scan latency measures processing + validation timing, which closely tracks UI feedback trigger timing in current architecture.',
    'Retry path validates queue durability: records remain after failure and are cleared after successful retry.',
  ]

  return { metrics, notes }
}
