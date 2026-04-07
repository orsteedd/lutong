import type { InventoryItem } from '@/store/useInventoryStore'
import { notifyError } from './toastNotify'

interface InventoryApiRow {
  id: number
  sku: string
  name: string
  quantity: number
  unit: string
  category?: string
  zone?: string | null
  location_type?: string | null
  safety_buffer?: number
  qr_code?: string
}

interface LowStockResponse {
  data?: {
    items?: InventoryApiRow[]
  }
}

export const fetchInventoryFromApi = async (): Promise<InventoryItem[]> => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
  if (apiBaseUrl.trim() === '') {
    throw new Error('VITE_API_BASE_URL is not set. Laravel backend URL is required for inventory hydration.')
  }

  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/inventory`
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    notifyError('Backend error', `Inventory hydration failed with status ${response.status}`)
    throw new Error(`Inventory hydration failed with status ${response.status}`)
  }

  const payload = (await response.json()) as LowStockResponse
  const rows = Array.isArray(payload.data?.items)
    ? payload.data?.items
    : []

  return rows.map((row) => ({
    id: `item-${row.id}`,
    sku: row.sku,
    name: row.name,
    quantity: Math.max(0, Number(row.quantity) || 0),
    safetyBuffer: Math.max(0, Number(row.safety_buffer) || 0),
    unit: row.unit || 'pcs',
    zone: row.zone ?? null,
    locationType: row.location_type ?? null,
    category: row.category || 'Uncategorized',
    lastUpdated: Date.now(),
  }))
}
