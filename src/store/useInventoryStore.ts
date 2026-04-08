import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface InventoryItem {
  id: string
  sku: string
  name: string
  quantity: number
  safetyBuffer?: number
  unit: string
  zone?: string | null
  locationType?: string | null
  category: string
  lastUpdated: number
}

interface InventoryStore {
  // Inventory state
  items: InventoryItem[]
  lastSyncAt: number | null
  isLoading: boolean
  error: string | null

  // CRUD
  addItem: (item: InventoryItem) => void
  updateItem: (id: string, updates: Partial<InventoryItem>) => void
  removeItem: (id: string) => void
  clearItems: () => void

  // Sync + metadata
  setItems: (items: InventoryItem[]) => void
  markSynced: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const normalizeInventoryItem = (value: unknown): InventoryItem | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<InventoryItem>

  const sku = typeof raw.sku === 'string' ? raw.sku.trim() : ''
  if (!sku) return null

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `item-${sku}`
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : sku
  const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category : 'Uncategorized'
  const unit = typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit : 'pcs'
  const quantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) ? raw.quantity : 0
  const safetyBuffer = typeof raw.safetyBuffer === 'number' && Number.isFinite(raw.safetyBuffer)
    ? raw.safetyBuffer
    : 0
  const lastUpdated = typeof raw.lastUpdated === 'number' && Number.isFinite(raw.lastUpdated)
    ? raw.lastUpdated
    : Date.now()

  return {
    id,
    sku,
    name,
    quantity,
    safetyBuffer,
    unit,
    zone: raw.zone ?? null,
    locationType: raw.locationType ?? null,
    category,
    lastUpdated,
  }
}

const ensureItems = (value: unknown): InventoryItem[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeInventoryItem(item))
    .filter((item): item is InventoryItem => item !== null)
}
const ensureNumberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null)
const ensureStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      items: [],
      lastSyncAt: null,
      isLoading: false,
      error: null,
      
      addItem: (item) => set((state) => {
        const normalized = normalizeInventoryItem(item)
        if (!normalized) return state
        return { items: [...state.items, normalized] }
      }),
      
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map((item) =>
          item.id === id
            ? (normalizeInventoryItem({ ...item, ...updates, lastUpdated: Date.now() }) ?? item)
            : item
        ),
      })),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
      
      clearItems: () => set({ items: [] }),
      
      setItems: (items) => set({ items: ensureItems(items) }),
      markSynced: () => set({ lastSyncAt: Date.now(), error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'inventory-store',
      version: 3,
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<InventoryStore> | undefined) ?? {}
        return {
          ...currentState,
          ...incoming,
          items: ensureItems(incoming.items),
          lastSyncAt: ensureNumberOrNull(incoming.lastSyncAt),
          isLoading: false,
          error: ensureStringOrNull(incoming.error),
        }
      },
    }
  )
)
