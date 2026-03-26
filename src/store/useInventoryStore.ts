import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface InventoryItem {
  id: string
  sku: string
  name: string
  quantity: number
  safetyBuffer?: number
  unit: string
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

const ensureItems = (value: unknown): InventoryItem[] => (Array.isArray(value) ? (value as InventoryItem[]) : [])
const ensureNumberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null)
const ensureStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      items: [],
      lastSyncAt: null,
      isLoading: false,
      error: null,
      
      addItem: (item) => set((state) => ({
        items: [...state.items, item],
      })),
      
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, ...updates, lastUpdated: Date.now() } : item
        ),
      })),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),
      
      clearItems: () => set({ items: [] }),
      
      setItems: (items) => set({ items }),
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
