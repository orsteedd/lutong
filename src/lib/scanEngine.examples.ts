/**
 * Scan Engine - Examples & Testing Guide
 * 
 * This file demonstrates how to use the scan engine in various scenarios.
 * Copy these patterns into your components.
 */

import {
  processScanInput,
  lookupItemBySku,
  validateScanInput,
  createScanRecord,
  type ScanType,
} from './scanEngine'

// ============================================================================
// EXAMPLE 1: Complete scan flow (what ScanPage does)
// ============================================================================

export async function exampleCompleteScan() {
  const sku = 'SKU-001'
  const quantity = 5

  // Single call handles: validation, record creation, persistence
  const result = await processScanInput(sku, quantity, 'transfer')

  if (!result.success) {
    console.error('Scan failed:', result.error, result.errorCode)
    return
  }

  // Record is ready to enqueue immediately (non-blocking)
  if (result.record) {
    console.log('Scanned record:', result.record)
    // In React: enqueueScan(result.record)
  }
}

// ============================================================================
// EXAMPLE 2: Item lookup before quantity modal
// ============================================================================

export function exampleItemLookup() {
  const sku = 'SKU-001'

  const lookup = lookupItemBySku(sku)

  if (!lookup.found) {
    console.error('Item not found:', lookup.error)
    return
  }

  const item = lookup.item!
  console.log(`Item: ${item.name}`)
  console.log(`Location: ${item.location}`)
  console.log(`Category: ${item.category}`)
  console.log(`Stock range: ${item.minStock}–${item.maxStock} ${item.unit}`)

  // Display in modal with these details
}

// ============================================================================
// EXAMPLE 3: Isolated validation (for advanced use cases)
// ============================================================================

export function exampleValidation() {
  // Just validate without persistence
  const validation = validateScanInput('SKU-001', 5, 'transfer')

  if (!validation.isValid) {
    console.error('Validation failed:', validation.error, validation.code)
    console.error('Error code for UI:', validation.code)
    // INVALID_SKU, ITEM_NOT_FOUND, INVALID_QUANTITY, UNKNOWN
    return
  }

  // Validation passed, now you could:
  // 1. Create record manually
  const record = createScanRecord(validation)
  console.log('Record created:', record)

  // 2. Do something else with the validated data
  console.log('Validated item:', validation.item.name)
  console.log('Validated quantity:', validation.quantity)
}

// ============================================================================
// EXAMPLE 4: Error codes for UI feedback
// ============================================================================

export async function exampleErrorHandling() {
  // Test invalid SKU
  const result1 = await processScanInput('', 5)
  console.log('Empty SKU result:', result1)
  // { success: false, error: "...", errorCode: "INVALID_SKU" }

  // Test missing item
  const result2 = await processScanInput('SKU-999', 5)
  console.log('Missing item result:', result2)
  // { success: false, error: "Item not found: SKU-999", errorCode: "ITEM_NOT_FOUND" }

  // Test invalid quantity
  const result3 = await processScanInput('SKU-001', 0)
  console.log('Invalid qty result:', result3)
  // { success: false, error: "Invalid quantity: must be 1-9999", errorCode: "INVALID_QUANTITY" }
}

// ============================================================================
// EXAMPLE 5: Scan types (different workflows)
// ============================================================================

export async function exampleScanTypes() {
  const scanTypes: ScanType[] = ['transfer', 'wastage', 'delivery', 'audit']

  for (const type of scanTypes) {
    const result = await processScanInput('SKU-001', 5, type)
    console.log(`Scan as ${type}:`, result.success ? 'OK' : result.error)
  }
}

// ============================================================================
// EXAMPLE 6: Rapid consecutive scans (warehouse scenario)
// ============================================================================

export async function exampleRapidScans() {
  const scans = [
    { sku: 'SKU-001', qty: 5 },
    { sku: 'SKU-002', qty: 10 },
    { sku: 'SKU-003', qty: 3 },
    { sku: 'SKU-001', qty: 2 }, // Duplicate SKU is OK
  ]

  // Non-blocking: all fire simultaneously
  const promises = scans.map((s) => processScanInput(s.sku, s.qty))
  const results = await Promise.all(promises)

  const successful = results.filter((r) => r.success).length
  console.log(`${successful}/${scans.length} scans succeeded`)

  // IndexedDB writes happen in parallel without blocking UI
}

// ============================================================================
// EXAMPLE 7: Inventory lookup state
// ============================================================================

export function exampleInventoryLookupState() {
  const lookup = lookupItemBySku('SKU-001')
  if (!lookup.found) {
    console.log('Inventory is empty or SKU does not exist yet.')
    return
  }

  console.log('Inventory lookup is ready for scanning.')
  console.log(`Found: ${lookup.item?.sku} -> ${lookup.item?.name}`)
}

// ============================================================================
// EXAMPLE 8: Barcode format examples
// ============================================================================

export async function exampleBarcodeFormats() {
  // Format 1: Just SKU (triggers quantity modal in ScanPage)
  // Input: "SKU-001"
  const lookup1 = lookupItemBySku('SKU-001')
  console.log('Format 1 lookup:', lookup1.found)

  // Format 2: SKU with quantity (direct processing)
  // Input: "SKU-001:5"
  const scan2 = await processScanInput('SKU-001', 5)
  console.log('Format 2 scan:', scan2.success)

  // Format 3: Real barcode → lookup → modal → quantity
  // Input: "1234567890" (numeric barcode)
  // Need mapping: barcode → SKU (not implemented yet)
  // Future: const sku = barcodeToSkuMap['1234567890']
}

// ============================================================================
// TESTING CHECKLIST
// ============================================================================
/*

□ Test valid scan: "SKU-001:5"
  ✓ Should return success record
  ✓ Record should be saved to IndexedDB
  ✓ UI should show success feedback + audio
  
□ Test invalid item: "SKU-999:5"
  ✓ Should return error
  ✓ Error code should be ITEM_NOT_FOUND
  ✓ UI should show error message + buzz
  
□ Test invalid quantity: "SKU-001:0"
  ✓ Should return error
  ✓ Error code should be INVALID_QUANTITY
  
□ Test rapid scans (5+ consecutive)
  ✓ Should handle all without blocking
  ✓ IndexedDB should have all entries
  ✓ No UI lag or stuttering
  
□ Test offline persistence
  ✓ Disable network
  ✓ Scan multiple items
  ✓ Check IndexedDB: all should be 'pending'
  ✓ Enable network
  ✓ Items should sync and mark 'synced'
  
□ Test modal flow
  ✓ Scan: "SKU-001" (no quantity)
  ✓ Modal should show with item details
  ✓ Location, category, min/max stock visible
  ✓ Quick qty buttons (1, 5, 10, 25) work
  ✓ Custom qty input works
  ✓ Confirm button auto-closes modal + continues scan

*/
