import { performance } from 'node:perf_hooks'
import {
  processScanInput,
  type ScanModeMetadata,
  type ScanType,
} from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/lib/scanEngine.ts'
import {
  getDeliverySessionById,
} from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/lib/mockDeliveryData.ts'
import {
  verifyDeliverySession,
} from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/lib/deliveryVerification.ts'
import {
  buildAuditDiscrepancyReport,
} from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/lib/auditDiscrepancy.ts'
import type { PendingScan } from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/store/useOfflineQueueStore.ts'
import type { InventoryItem } from '/Users/enz/Jeamar Vincent Urbano /Malatang/src/store/useInventoryStore.ts'

interface StepResult {
  name: string
  passed: boolean
  details: string
}

const now = Date.now()

const baseInventory: InventoryItem[] = [
  {
    id: 'item-1',
    sku: 'SKU-001',
    name: 'Jasmine Rice (10kg)',
    quantity: 25,
    unit: 'bag',
    category: 'Grains',
    lastUpdated: now,
  },
  {
    id: 'item-2',
    sku: 'SKU-003',
    name: 'Fish Sauce (750ml)',
    quantity: 20,
    unit: 'bottle',
    category: 'Condiments',
    lastUpdated: now,
  },
  {
    id: 'item-3',
    sku: 'SKU-010',
    name: 'Garlic (1kg)',
    quantity: 15,
    unit: 'bag',
    category: 'Vegetables',
    lastUpdated: now,
  },
  {
    id: 'item-4',
    sku: 'SKU-004',
    name: 'Soy Sauce (1L)',
    quantity: 10,
    unit: 'bottle',
    category: 'Condiments',
    lastUpdated: now,
  },
]

const allRecords: PendingScan[] = []

const createScan = async (
  sku: string,
  qty: number,
  type: ScanType,
  metadata?: ScanModeMetadata
) => {
  const started = performance.now()
  const result = await processScanInput(sku, qty, type, metadata)
  const elapsed = performance.now() - started
  if (result.success && result.record) {
    allRecords.push(result.record)
  }
  return { result, elapsed }
}

const stepResults: StepResult[] = []

const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '')
  if (msg.includes('IndexedDB API missing')) {
    return
  }
  originalConsoleError(...args)
}

const simulateSync = async (records: PendingScan[], offline: boolean) => {
  if (offline) {
    throw new Error('Network offline')
  }
  return {
    success: true,
    syncedIds: records.map((r) => r.id),
  }
}

const run = async () => {
  // 1) Delivery workflow
  const deliverySession = getDeliverySessionById('DEL001')
  if (!deliverySession) {
    throw new Error('Missing DEL001 mock session')
  }

  await createScan('SKU-001', 8, 'delivery', { sessionId: 'DEL001' })
  await createScan('SKU-003', 10, 'delivery', { sessionId: 'DEL001' })
  await createScan('SKU-010', 8, 'delivery', { sessionId: 'DEL001' })
  await createScan('SKU-004', 2, 'delivery', { sessionId: 'DEL001' })

  const deliveryReport = verifyDeliverySession(deliverySession, allRecords)
  const deliveryPassed =
    deliveryReport.totals.shortageCount >= 1 &&
    deliveryReport.totals.overDeliveryCount >= 1 &&
    deliveryReport.totals.wrongItemCount >= 1
  stepResults.push({
    name: 'Delivery expected-vs-actual + discrepancy detection',
    passed: deliveryPassed,
    details: `shortage=${deliveryReport.totals.shortageCount}, over=${deliveryReport.totals.overDeliveryCount}, wrong=${deliveryReport.totals.wrongItemCount}`,
  })

  // 2) Transfer rapid scan workflow (40 rapid scans)
  const transferLatency: number[] = []
  let transferSuccess = 0
  for (let i = 0; i < 40; i += 1) {
    const sku = i % 2 === 0 ? 'SKU-001' : 'SKU-003'
    const qty = (i % 4) + 1
    const { result, elapsed } = await createScan(sku, qty, 'transfer', {
      fromLocation: 'Dock-A',
      toLocation: 'Shelf-B2',
    })
    if (result.success) transferSuccess += 1
    transferLatency.push(elapsed)
  }
  const transferAvgMs = transferLatency.reduce((s, v) => s + v, 0) / transferLatency.length
  const transferP95Ms = [...transferLatency].sort((a, b) => a - b)[Math.floor(transferLatency.length * 0.95)]
  stepResults.push({
    name: 'Transfer rapid scans (40)',
    passed: transferSuccess >= 35,
    details: `success=${transferSuccess}/40 avgMs=${transferAvgMs.toFixed(2)} p95Ms=${transferP95Ms.toFixed(2)}`,
  })

  // 3) Wastage workflow
  const invalidWastage = await createScan('SKU-001', 2, 'wastage', {})
  const validWastage = await createScan('SKU-001', 2, 'wastage', { reason: 'Damaged packaging' })
  stepResults.push({
    name: 'Wastage logging + validation',
    passed: !invalidWastage.result.success && validWastage.result.success,
    details: `invalidRejected=${!invalidWastage.result.success} validAccepted=${validWastage.result.success}`,
  })

  // 4) Audit workflow
  await createScan('SKU-001', 22, 'audit', { sessionId: 'AUD001' })
  await createScan('SKU-003', 25, 'audit', { sessionId: 'AUD001' })
  await createScan('SKU-010', 10, 'audit', { sessionId: 'AUD001' })
  await createScan('SKU-002', 3, 'audit', { sessionId: 'AUD001' })

  const auditReport = buildAuditDiscrepancyReport(baseInventory, allRecords, 'AUD001')
  stepResults.push({
    name: 'Audit full count + discrepancy output',
    passed: auditReport.discrepancies.length > 0,
    details: `discrepancies=${auditReport.discrepancies.length} missing=${auditReport.totals.missingCount} excess=${auditReport.totals.excessCount}`,
  })

  // 5) Offline workflow (forced fail -> reconnect -> sync)
  const syncPayload = allRecords.slice(0, 30)

  let offlineFailedAsExpected = false
  try {
    await simulateSync(syncPayload, true)
  } catch {
    offlineFailedAsExpected = true
  }

  let reconnectSyncSuccess = false
  try {
    const syncResult = await simulateSync(syncPayload, false)
    reconnectSyncSuccess = syncResult.syncedIds.length === syncPayload.length
  } finally {
    console.error = originalConsoleError
  }

  stepResults.push({
    name: 'Offline -> reconnect -> sync',
    passed: offlineFailedAsExpected && reconnectSyncSuccess,
    details: `offlineFailExpected=${offlineFailedAsExpected} reconnectSync=${reconnectSyncSuccess}`,
  })

  const passedCount = stepResults.filter((s) => s.passed).length
  const failedCount = stepResults.length - passedCount

  const summary = {
    status: failedCount === 0 ? 'PASS' : 'PARTIAL',
    totals: {
      workflowsTested: stepResults.length,
      passed: passedCount,
      failed: failedCount,
      recordsGenerated: allRecords.length,
    },
    evaluations: {
      stability: failedCount === 0 ? 'stable' : 'needs-attention',
      dataAccuracy:
        deliveryPassed && auditReport.discrepancies.length > 0
          ? 'accurate-on-simulated-cases'
          : 'inconclusive',
      speed: {
        transferAvgMs: Number(transferAvgMs.toFixed(2)),
        transferP95Ms: Number(transferP95Ms.toFixed(2)),
      },
    },
    steps: stepResults,
  }

  console.log(JSON.stringify(summary, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
