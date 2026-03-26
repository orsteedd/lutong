import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ActivityActionType =
  | 'scan_recorded'
  | 'adjustment_requested'
  | 'adjustment_applied'
  | 'approval_submitted'
  | 'approval_approved'
  | 'approval_rejected'
  | 'inventory_item_deleted'

export interface ActivityLogEntry {
  id: string
  user_id: string
  action_type: ActivityActionType
  item_id: string
  timestamp: number
  details?: string
}

interface ActivityLogStore {
  logs: ActivityLogEntry[]
  addLog: (entry: Omit<ActivityLogEntry, 'id'>) => void
  addLogs: (entries: Array<Omit<ActivityLogEntry, 'id'>>) => void
  clearLogs: () => void
}

const makeId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const useActivityLogStore = create<ActivityLogStore>()(
  persist(
    (set) => ({
      logs: [],

      addLog: (entry) =>
        set((state) => ({
          logs: [{ ...entry, id: makeId() }, ...state.logs].slice(0, 5000),
        })),

      addLogs: (entries) =>
        set((state) => ({
          logs: [
            ...entries.map((entry) => ({ ...entry, id: makeId() })),
            ...state.logs,
          ].slice(0, 5000),
        })),

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'activity-log-store',
      version: 1,
    }
  )
)
