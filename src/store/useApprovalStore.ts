import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useActivityLogStore } from './useActivityLogStore'

export type ApprovalRecordType =
  | 'audit_discrepancy'
  | 'delivery_discrepancy'
  | 'manual_adjustment'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalLineItem {
  itemId?: string
  sku: string
  name: string
  delta: number
  reason: string
}

export interface ApprovalRecord {
  id: string
  type: ApprovalRecordType
  status: ApprovalStatus
  title: string
  summary: string
  createdAt: number
  updatedAt: number
  reviewedAt?: number
  reviewNote?: string
  lineItems: ApprovalLineItem[]
}

interface ApprovalStore {
  records: ApprovalRecord[]
  createRecord: (input: {
    type: ApprovalRecordType
    title: string
    summary: string
    lineItems: ApprovalLineItem[]
  }) => ApprovalRecord
  approveRecord: (id: string, note?: string) => void
  rejectRecord: (id: string, note?: string) => void
  clearResolved: () => void
  pendingCount: () => number
}

const ensureRecords = (value: unknown): ApprovalRecord[] => (Array.isArray(value) ? (value as ApprovalRecord[]) : [])

const makeId = () => `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useApprovalStore = create<ApprovalStore>()(
  persist(
    (set, get) => ({
      records: [],

      createRecord: (input) => {
        const now = Date.now()
        const record: ApprovalRecord = {
          id: makeId(),
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          ...input,
        }

        set((state) => ({
          records: [record, ...state.records],
        }))

        const logger = useActivityLogStore.getState()
        for (const line of record.lineItems) {
          logger.addLog({
            user_id: 'operator-local',
            action_type:
              record.type === 'manual_adjustment'
                ? 'adjustment_requested'
                : 'approval_submitted',
            item_id: line.itemId || line.sku,
            timestamp: now,
            details: `${record.type} ${record.id}`,
          })
        }

        return record
      },

      approveRecord: (id, note) => {
        const target = get().records.find((record) => record.id === id)
        const now = Date.now()

        if (target) {
          const logger = useActivityLogStore.getState()
          for (const line of target.lineItems) {
            logger.addLog({
              user_id: 'admin-local',
              action_type: 'approval_approved',
              item_id: line.itemId || line.sku,
              timestamp: now,
              details: `${target.type} ${target.id}`,
            })
          }
        }

        set((state) => ({
          records: state.records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  status: 'approved',
                  updatedAt: now,
                  reviewedAt: now,
                  reviewNote: note,
                }
              : record
          ),
        }))
      },

      rejectRecord: (id, note) => {
        const target = get().records.find((record) => record.id === id)
        const now = Date.now()

        if (target) {
          const logger = useActivityLogStore.getState()
          for (const line of target.lineItems) {
            logger.addLog({
              user_id: 'admin-local',
              action_type: 'approval_rejected',
              item_id: line.itemId || line.sku,
              timestamp: now,
              details: `${target.type} ${target.id}`,
            })
          }
        }

        set((state) => ({
          records: state.records.map((record) =>
            record.id === id
              ? {
                  ...record,
                  status: 'rejected',
                  updatedAt: now,
                  reviewedAt: now,
                  reviewNote: note,
                }
              : record
          ),
        }))
      },

      clearResolved: () =>
        set((state) => ({
          records: state.records.filter((record) => record.status === 'pending'),
        })),

      pendingCount: () => get().records.filter((record) => record.status === 'pending').length,
    }),
    {
      name: 'approval-store',
      version: 1,
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<ApprovalStore> | undefined) ?? {}
        return {
          ...currentState,
          ...incoming,
          records: ensureRecords(incoming.records),
        }
      },
    }
  )
)
