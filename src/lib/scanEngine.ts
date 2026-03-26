/**
 * Scan Engine - Core business logic for inventory scanning
 * Handles item lookup, validation, record creation, and persistence
 */

import { logScanEvent, upsertPendingSyncItem } from './db'
import type { PendingScan } from '@/store/useOfflineQueueStore'
import { useInventoryStore } from '@/store/useInventoryStore'

// ============================================================================
// ITEM LOOKUP DATA
// ============================================================================

export interface InventoryItemData {
  sku: string
  name: string
  category: string
  unit: string
  minStock: number
  maxStock: number
  location: string
}

// Kept for backward compatibility with example files.
export const MOCK_INVENTORY_DB: Record<string, InventoryItemData> = {}

// ============================================================================
// ITEM LOOKUP
// ============================================================================

export interface ItemLookupResult {
  found: boolean
  item?: InventoryItemData
  error?: string
}

/**
 * Look up an item by SKU from inventory store
 * Returns item details or error
 */
export const lookupItemBySku = (sku: string): ItemLookupResult => {
  const trimmed = sku.trim().toUpperCase()

  if (!trimmed) {
    return {
      found: false,
      error: 'SKU cannot be empty',
    }
  }

  const inventoryItems = useInventoryStore.getState().items
  if (!Array.isArray(inventoryItems) || inventoryItems.length === 0) {
    return {
      found: false,
      error: 'No inventory items found. Add items in Inventory first.',
    }
  }

  const match = inventoryItems.find((item) => item.sku.trim().toUpperCase() === trimmed)
  const item: InventoryItemData | undefined =
    match
      ? {
          sku: match.sku,
          name: match.name,
          category: match.category,
          unit: match.unit,
          minStock: match.safetyBuffer ?? 0,
          maxStock: Math.max(match.quantity * 2, (match.safetyBuffer ?? 0) + 10),
          location: 'Main Storage',
        }
      : undefined

  if (!item) {
    return {
      found: false,
      error: `Item not found: ${trimmed}`,
    }
  }

  return {
    found: true,
    item,
  }
}

// ============================================================================
// SCAN RECORD CREATION
// ============================================================================

export type ScanType = 'transfer' | 'wastage' | 'delivery' | 'audit'

export interface ScanModeMetadata {
  sessionId?: string
  reason?: string
  fromLocation?: string
  toLocation?: string
}

export interface ScanValidationError {
  isValid: false
  error: string
  code: 'INVALID_SKU' | 'ITEM_NOT_FOUND' | 'INVALID_QUANTITY' | 'UNKNOWN'
}

export interface ScanValidationSuccess {
  isValid: true
  item: InventoryItemData
  quantity: number
  timestamp: number
  scanType: ScanType
  metadata?: ScanModeMetadata
}

export type ScanValidationResult = ScanValidationError | ScanValidationSuccess

/**
 * Validate scan input (SKU and quantity)
 */
export const validateScanInput = (
  sku: string,
  quantity: number,
  scanType: ScanType = 'transfer',
  metadata?: ScanModeMetadata
): ScanValidationResult => {
  // Validate SKU
  if (!sku || typeof sku !== 'string') {
    return {
      isValid: false,
      error: 'Invalid SKU format',
      code: 'INVALID_SKU',
    }
  }

  // Look up item
  const lookup = lookupItemBySku(sku)
  if (!lookup.found || !lookup.item) {
    return {
      isValid: false,
      error: lookup.error || 'Item not found',
      code: 'ITEM_NOT_FOUND',
    }
  }

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 9999) {
    return {
      isValid: false,
      error: `Invalid quantity: must be 1-9999`,
      code: 'INVALID_QUANTITY',
    }
  }

  if (scanType === 'wastage' && !metadata?.reason?.trim()) {
    return {
      isValid: false,
      error: 'Wastage reason is required',
      code: 'UNKNOWN',
    }
  }

  if (scanType === 'transfer') {
    const from = metadata?.fromLocation?.trim()
    const to = metadata?.toLocation?.trim()
    if (!from || !to) {
      return {
        isValid: false,
        error: 'From and To locations are required for transfer',
        code: 'UNKNOWN',
      }
    }
  }

  if ((scanType === 'delivery' || scanType === 'audit') && !metadata?.sessionId?.trim()) {
    return {
      isValid: false,
      error: `${scanType === 'delivery' ? 'Delivery' : 'Audit'} session is required`,
      code: 'UNKNOWN',
    }
  }

  return {
    isValid: true,
    item: lookup.item,
    quantity,
    timestamp: Date.now(),
    scanType,
    metadata,
  }
}

/**
 * Create a pending scan record
 * This is the structured record that gets stored
 */
export const createScanRecord = (
  validation: ScanValidationSuccess
): PendingScan => {
  const id = `${validation.item.sku}-${validation.timestamp}-${Math.random().toString(36).slice(2, 9)}`

  return {
    id,
    type: validation.scanType,
    sku: validation.item.sku,
    name: validation.item.name,
    quantity: validation.quantity,
    timestamp: validation.timestamp,
    synced: false,
    metadata: validation.metadata,
  }
}

// ============================================================================
// PERSISTENCE & ORCHESTRATION
// ============================================================================

export interface ScanEngineResult {
  success: boolean
  record?: PendingScan
  error?: string
  errorCode?: string
}

/**
 * Complete scan processing pipeline:
 * 1. Validate input
 * 2. Create record
 * 3. Persist to IndexedDB
 * 4. Return record for store enqueue
 *
 * This is non-blocking - fires off IndexedDB writes without awaiting
 */
export const processScanInput = async (
  sku: string,
  quantity: number,
  scanType: ScanType = 'transfer',
  metadata?: ScanModeMetadata
): Promise<ScanEngineResult> => {
  // Step 1: Validate
  const validation = validateScanInput(sku, quantity, scanType, metadata)
  if (!validation.isValid) {
    // Log error to IndexedDB (fire-and-forget)
    void logScanEvent({
      id: `scan-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sku: sku || 'UNKNOWN',
      quantity,
      timestamp: Date.now(),
      status: 'error',
      message: validation.error,
    }).catch((err) => {
      console.error('[ScanEngine] Failed to log error scan event:', err)
    })

    return {
      success: false,
      error: validation.error,
      errorCode: validation.code,
    }
  }

  // Step 2: Create record
  const record = createScanRecord(validation)

  // Step 3: Persist (fire-and-forget, but with error handling)
  void Promise.all([
    // Log to scanLogs table
    logScanEvent({
      id: record.id,
      sku: record.sku,
      quantity: record.quantity,
      timestamp: record.timestamp,
      status: 'success',
      message: `${scanType} ${record.quantity}x ${record.sku}`,
    }).catch((err) => {
      console.error('[ScanEngine] Failed to log scan event:', err)
    }),

    // Upsert to pendingSyncItems table
    upsertPendingSyncItem({
      id: record.id,
      type: scanType,
      payload: JSON.stringify({
        sku: record.sku,
        name: record.name,
        quantity: record.quantity,
        scanType,
        metadata,
      }),
      timestamp: record.timestamp,
      updatedAt: Date.now(),
      status: 'pending',
    }).catch((err) => {
      console.error('[ScanEngine] Failed to upsert pending sync item:', err)
    }),
  ])

  return {
    success: true,
    record,
  }
}

// ============================================================================
// UTILITY: Item Details Formatter
// ============================================================================

export interface FormattedItemDetails {
  sku: string
  name: string
  category: string
  location: string
  stock: {
    min: number
    max: number
  }
}

/**
 * Format item details for display in UI
 */
export const formatItemDetails = (item: InventoryItemData): FormattedItemDetails => ({
  sku: item.sku,
  name: item.name,
  category: item.category,
  location: item.location,
  stock: {
    min: item.minStock,
    max: item.maxStock,
  },
})

// ============================================================================
// UTILITY: Create mock scan for testing
// ============================================================================

export const createMockScan = (sku: string = 'SKU-001', quantity: number = 5): PendingScan => {
  const now = Date.now()
  return {
    id: `${sku}-${now}-mock`,
    type: 'transfer',
    sku,
    name: `Item ${sku}`,
    quantity,
    timestamp: now,
    synced: false,
  }
}
