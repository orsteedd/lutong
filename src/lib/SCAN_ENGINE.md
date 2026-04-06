# Scan Engine Integration Guide

The scan engine in [src/lib/scanEngine.ts](src/lib/scanEngine.ts) is the core orchestration layer for inventory scanning.

## Core Responsibilities

- Item lookup
  - Inventory store lookup by SKU
  - Item details resolution (name, category, unit, stock hints)
  - Clear error handling for missing items

- Validation
  - SKU format validation
  - Quantity validation (1-9999)
  - Required metadata checks by scan type

- Record creation
  - Structured `PendingScan` records
  - Deterministic timestamps and unique IDs

- Persistence
  - Writes scan logs and pending sync payloads to IndexedDB
  - Uses non-blocking writes to keep scan UX fast

## ScanPage Usage

Import in UI code:

```ts
import { processScanInput, lookupItemBySku } from '@/lib/scanEngine'
```

### Flow A: Barcode includes quantity (`SKU:qty`)

1. Parse input (`sku`, `qty`)
2. Call `processScanInput(sku, qty, mode, metadata)`
3. On success, enqueue the returned record
4. Show success UI feedback

### Flow B: Barcode without quantity (`SKU`)

1. Call `lookupItemBySku(sku)`
2. Show quantity modal with item details
3. Call `processScanInput` after quantity input

## Error Codes

- `INVALID_SKU`
- `ITEM_NOT_FOUND`
- `INVALID_QUANTITY`
- `UNKNOWN`

Each error is logged and can be surfaced in UI feedback.

## Persistence Strategy

`processScanInput` does not block on IndexedDB writes.

```ts
void Promise.all([
  logScanEvent(...),
  upsertPendingSyncItem(...),
])
```

Benefits:

- Fast scan feedback
- Lower UI latency during burst scans
- Persistent audit trail for success and failure paths

## Inventory Data Source

Scan lookup reads from hydrated inventory state.

Recommended flow:

1. Hydrate inventory from API at app startup
2. Persist through Zustand for offline continuity
3. Reconcile via queued sync when online

## Testing Inputs

- `SKU-001:5` -> expected success
- `SKU-001` -> quantity modal flow
- `SKU-999:5` -> item not found
- `SKU-001:0` -> invalid quantity
- empty input -> invalid SKU

## Where to Inspect Data

In browser DevTools:

1. Application
2. IndexedDB
3. `InventoryDB`
4. `scanLogs` and `pendingSyncItems`
