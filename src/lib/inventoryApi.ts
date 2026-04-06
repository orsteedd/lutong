import type { InventoryItem } from '@/store/useInventoryStore'
import { getApiBaseUrl } from './apiBaseUrl'

interface LowStockInventoryRow {
  item_id: number
  item_name: string
  stock: number
  safety_buffer: number
  qr_code?: string
}

interface LowStockResponse {
  data?: {
    aggregated_inventory?: LowStockInventoryRow[]
  }
}

const normalizeSku = (row: LowStockInventoryRow) => {
  const qr = typeof row.qr_code === 'string' ? row.qr_code.trim() : ''
  if (qr.length > 0) return qr.toUpperCase()
  return `SKU-${String(row.item_id).padStart(3, '0')}`
}

export const fetchInventoryFromApi = async (): Promise<InventoryItem[]> => {
  const endpoint = `${getApiBaseUrl()}/api/v1/reports/low-stock`
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Inventory hydration failed with status ${response.status}`)
  }

  const payload = (await response.json()) as LowStockResponse
  const rows = Array.isArray(payload.data?.aggregated_inventory)
    ? payload.data?.aggregated_inventory
    : []

  return rows.map((row) => ({
    id: `item-${row.item_id}`,
    sku: normalizeSku(row),
    name: row.item_name,
    quantity: Math.max(0, Number(row.stock) || 0),
    safetyBuffer: Math.max(0, Number(row.safety_buffer) || 0),
    unit: 'pcs',
    category: 'Uncategorized',
    lastUpdated: Date.now(),
  }))
}
