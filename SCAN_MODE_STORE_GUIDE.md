# Scan Mode Store - Zustand Store for Offline-First Inventory

## Overview

The `useScanModeStore` is a specialized Zustand store designed for managing the scanning workflow state in your offline-first inventory PWA. It complements the `useOfflineQueueStore` by tracking **workflow context** rather than queue operations.

---

## Architecture

### Store Responsibilities

| Store | Responsibility |
|-------|-----------------|
| `useOfflineQueueStore` | Manages pending scans, wastage logs, transfers queues |
| `useScanModeStore` | Manages current workflow mode, item, and sync status |
| `useInventoryStore` | Manages master inventory data |
| `useUIFeedbackStore` | Manages global feedback (audio, messages, alerts) |

---

## State Structure

```typescript
interface ScanModeStore {
  // Primary state
  currentMode: ScanMode              // 'delivery' | 'transfer' | 'wastage' | 'audit'
  currentItem: CurrentItem | null    // Last scanned item with context
  syncState: SyncState               // Sync status, error, progress
  isProcessing: boolean              // Prevents double-taps during processing
  
  // Functions (see below)
  setMode(mode)
  setCurrentItem(item)
  setSyncStatus(status, error?)
  // ... and more
}
```

### Type Definitions

```typescript
export type ScanMode = 'delivery' | 'transfer' | 'wastage' | 'audit'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface SyncState {
  status: SyncStatus
  error?: string
  lastSyncAt?: number
  itemsSyncedCount?: number
}

export interface CurrentItem {
  sku: string
  name: string
  quantity: number
  mode: ScanMode
  timestamp: number
}
```

---

## Core Functions

### Mode Management

**`setMode(mode: ScanMode)`**
- Changes the current scanning mode
- Clears current item if mode changes
- Prevents mode-mismatch in workflow

```typescript
const { setMode } = useScanModeStore()
setMode('delivery')    // Start delivery workflow
```

**`clearMode()`**
- Resets mode to 'transfer' (default)
- Clears current item
- Typically called when returning to home

```typescript
const { clearMode } = useScanModeStore()
clearMode()  // Reset to initial state
```

### Item Tracking

**`setCurrentItem(item: CurrentItem | null)`**
- Records the last scanned item
- Captures: SKU, name, quantity, mode, timestamp
- Automatically clears processing flag

```typescript
const { setCurrentItem } = useScanModeStore()
setCurrentItem({
  sku: 'SKU-001',
  name: 'Jasmine Rice',
  quantity: 5,
  mode: 'transfer',
  timestamp: Date.now()
})
```

**`clearCurrentItem()`**
- Clears the current item
- Used between scans or when canceling

```typescript
const { clearCurrentItem } = useScanModeStore()
clearCurrentItem()
```

### Sync Management

**`setSyncStatus(status: SyncStatus, error?: string)`**
- Updates sync status with optional error
- Auto-manages `isProcessing` flag
- Records timestamp on success

```typescript
const { setSyncStatus } = useScanModeStore()

// Start syncing
setSyncStatus('syncing')

// Success
setSyncStatus('success')

// Error
setSyncStatus('error', 'Connection timeout')

// Back to idle
setSyncStatus('idle')
```

**`setSyncProgress(itemsSyncedCount: number)`**
- Updates count of items synced
- Used during long sync operations

```typescript
const { setSyncProgress } = useScanModeStore()
setSyncProgress(5)  // 5 items synced so far
```

**`clearSyncError()`**
- Clears any sync error
- Unsets error status

```typescript
const { clearSyncError } = useScanModeStore()
clearSyncError()
```

### Processing State

**`setProcessing(processing: boolean)`**
- Prevents double-tap during scan processing
- Disables buttons/inputs during operation

```typescript
const { setProcessing } = useScanModeStore()
setProcessing(true)   // Start processing
// ... do work ...
setProcessing(false)  // Done
```

### Batch Operations

**`resetWorkflow()`**
- Resets entire workflow to initial state
- Clears mode, item, sync state, processing flag
- Used on major navigation changes

```typescript
const { resetWorkflow } = useScanModeStore()
resetWorkflow()  // Return to home
```

---

## Optimized Selectors

The store includes granular selectors to minimize re-renders. Use these in components to subscribe only to the state you need.

### Single-Value Selectors

```typescript
// Subscribe to mode only
const mode = useScanMode()

// Subscribe to current item only
const item = useCurrentItem()

// Subscribe to sync status only
const status = useSyncStatus()

// Subscribe to sync error only
const error = useSyncError()

// Subscribe to processing state only
const isProcessing = useIsProcessing()
```

**Benefits:**
- Component re-renders only when its specific selector changes
- No unnecessary re-renders from unrelated state changes
- Fine-grained control over performance

### Composite Selectors

```typescript
// Subscribe to complete sync state
const syncState = useSyncState()
// Returns: { status, error, lastSyncAt, itemsSyncedCount }

// Subscribe to workflow context
const { mode, item, syncStatus, isProcessing } = useWorkflowContext()

// Subscribe to sync actions only
const { setSyncStatus, isSyncing, hasSyncError } = useSyncActions()

// Subscribe to mode actions only
const { setMode, clearMode, resetWorkflow } = useModeActions()

// Subscribe to item actions only
const { setCurrentItem, clearCurrentItem } = useItemActions()
```

---

## Helper Functions

Zustand also exports convenient helper functions for common patterns:

**`handleScanSuccess(item)`**
- Wraps typical scan completion flow
- Sets current item and clears processing

```typescript
import { handleScanSuccess } from '@/store'

// After successful scan validation
handleScanSuccess({
  sku: 'SKU-001',
  name: 'Jasmine Rice',
  quantity: 5,
})
```

**`handleSyncError(message)`**
- Convenience for setting sync error

```typescript
import { handleSyncError } from '@/store'

try {
  await syncQueue()
} catch (err) {
  handleSyncError(err.message)
}
```

**`startSync()`**
- Sets status to 'syncing', clears previous errors

```typescript
import { startSync } from '@/store'

startSync()
// ... perform sync operations ...
```

**`completeSync(itemsSynced?)`**
- Sets status to 'success'
- Optionally updates items synced count
- Auto-resets to 'idle' after 2 seconds

```typescript
import { completeSync } from '@/store'

completeSync(10)  // 10 items synced
```

---

## Persistence

The store automatically persists state to **localStorage** with the following configuration:

- **Storage key:** `scan-mode-store`
- **Version:** 1
- **Persisted state:**
  - `currentMode`
  - `currentItem`
  - `syncState`
- **Non-persisted state:**
  - `isProcessing` (runtime-only)

This means:
- User's last scanning mode restored on reload ✓
- Current item context preserved ✓
- Sync status/error restored ✓
- Processing flag never persisted (always starts fresh) ✓

---

## Integration Patterns

### Pattern 1: Switch Scanning Mode

```typescript
// DashboardPage or mode selector component
export function ModeSelector() {
  const { setMode } = useModeActions()
  
  return (
    <div className="flex gap-2">
      <button onClick={() => setMode('transfer')}>Transfer</button>
      <button onClick={() => setMode('delivery')}>Delivery</button>
      <button onClick={() => setMode('wastage')}>Wastage</button>
      <button onClick={() => setMode('audit')}>Audit</button>
    </div>
  )
}
```

### Pattern 2: Display Current Mode with Item

```typescript
// ScanPage header component
export function ScanHeader() {
  const mode = useScanMode()
  const item = useCurrentItem()
  
  return (
    <header>
      <h1>Mode: {mode}</h1>
      {item && (
        <div>
          <p>Last: {item.name}</p>
          <p>Qty: {item.quantity}x</p>
        </div>
      )}
    </header>
  )
}
```

### Pattern 3: Handle Scan and Update Store

```typescript
// Inside ScanPage component
const { setCurrentItem, setProcessing } = useItemActions()
const { setSyncStatus } = useSyncActions()

async function handleScan(sku: string, qty: number) {
  setProcessing(true)
  
  try {
    // Validate and create record
    const result = await processScanInput(sku, qty)
    
    if (result.success && result.record) {
      // Update current item
      setCurrentItem({
        sku: result.record.sku,
        name: result.record.name,
        quantity: result.record.quantity,
        mode: currentMode,
        timestamp: Date.now(),
      })
      
      // Enqueue scan
      enqueueScan(result.record)
    } else {
      setSyncStatus('error', result.error)
    }
  } finally {
    setProcessing(false)
  }
}
```

### Pattern 4: Sync Queue with Progress

```typescript
// Sync service component
import { startSync, completeSync, handleSyncError } from '@/store'
import { useSyncActions } from '@/store'

export async function syncQueueWithProgress() {
  const { setSyncProgress } = useSyncActions()
  const queue = useOfflineQueueStore((s) => s.pendingScans)
  
  startSync()
  
  try {
    let synced = 0
    for (const item of queue) {
      await uploadToServer(item)
      synced++
      setSyncProgress(synced)
    }
    completeSync(synced)
  } catch (err) {
    handleSyncError(err.message)
  }
}
```

### Pattern 5: Workflow State Machine

```typescript
// Complex workflow component
export function WorkflowManager() {
  const { mode, item, syncStatus, isProcessing } = useWorkflowContext()
  
  const canScan = !isProcessing && syncStatus !== 'error'
  const showError = syncStatus === 'error'
  const showSuccess = syncStatus === 'success'
  
  return (
    <div>
      <h2>Mode: {mode}</h2>
      {!canScan && <p>Processing...</p>}
      {showError && <div className="alert-error">Sync failed</div>}
      {showSuccess && <div className="alert-success">Sync complete</div>}
      {item && <ItemCard item={item} />}
    </div>
  )
}
```

---

## Performance Characteristics

### State Updates

| Operation | Time | Notes |
|-----------|------|-------|
| `setMode()` | <1ms | Conditional item clear |
| `setCurrentItem()` | <1ms | Immutable update |
| `setSyncStatus()` | <1ms | Multi-field update |
| `setSyncProgress()` | <1ms | Single value update |
| `resetWorkflow()` | <1ms | Full state reset |

### Re-render Behavior

**With Granular Selectors:**
```typescript
const mode = useScanMode()  // Only re-renders if mode changes
const item = useCurrentItem()  // Only re-renders if item changes
```
Result: Component-level re-render isolation ✓

**Without Selectors (full store):**
```typescript
const store = useScanModeStore()  // Re-renders on ANY state change
```
Result: Potential unnecessary re-renders ✗

---

## Testing

### Unit Test Example

```typescript
import { useScanModeStore } from '@/store'

describe('useScanModeStore', () => {
  beforeEach(() => {
    // Reset store state
    useScanModeStore.setState({
      currentMode: 'transfer',
      currentItem: null,
      syncState: { status: 'idle' },
      isProcessing: false,
    })
  })

  it('should change mode and clear item', () => {
    const store = useScanModeStore.getState()
    
    store.setCurrentItem({
      sku: 'SKU-001',
      name: 'Item',
      quantity: 5,
      mode: 'transfer',
      timestamp: Date.now(),
    })
    
    store.setMode('delivery')
    
    expect(store.currentMode).toBe('delivery')
    expect(store.currentItem).toBeNull()
  })

  it('should handle sync status and error', () => {
    const store = useScanModeStore.getState()
    
    store.setSyncStatus('syncing')
    expect(store.isProcessing).toBe(true)
    
    store.setSyncStatus('error', 'Network error')
    expect(store.syncState.error).toBe('Network error')
    expect(store.isProcessing).toBe(false)
  })
})
```

---

## DevTools Integration

In development, the store logs state updates to console:

```
[ScanModeStore] State Update
New State: {...}
Previous State: {...}
```

To disable in production:
```typescript
// Already handled: logging only in `import.meta.env.DEV`
```

---

## Files & Exports

### Main Store
- **File:** `src/store/useScanModeStore.ts`
- **Default export:** `useScanModeStore`
- **Helper functions:** `handleScanSuccess`, `handleSyncError`, `startSync`, `completeSync`

### Selectors
- **Exports:** `useScanMode`, `useCurrentItem`, `useSyncStatus`, `useSyncError`, `useIsProcessing`, `useSyncState`, `useWorkflowContext`, `useSyncActions`, `useModeActions`, `useItemActions`

### Re-exports
- **File:** `src/store/index.ts`
- Barrel export for all stores and selectors

---

## Best Practices

✅ **DO:**
- Use granular selectors to minimize re-renders
- Call helper functions (`startSync`, `completeSync`) for common patterns
- Persist current mode/item for UX continuity
- Use `setProcessing()` to prevent double-scans
- Reset workflow on major navigation changes

❌ **DON'T:**
- Access full store in components (use selectors)
- Persist `isProcessing` (it's runtime-only anyway)
- Mix this store with `useOfflineQueueStore` directly in components (use abstractions)
- Call multiple setters in sequence (use batch operations)

---

## Future Enhancements

Possible additions:
- Hardware scanner integration (barcode device)
- Voice mode indication while scanning
- Workflow history/undo
- Mode shortcuts (hotkeys)
- Custom sync strategies per mode

---

## See Also

- `useOfflineQueueStore` - Queue management
- `useInventoryStore` - Master inventory
- `useUIFeedbackStore` - Audio/visual feedback
- `SCAN_ENGINE_GUIDE.md` - Scan validation logic
