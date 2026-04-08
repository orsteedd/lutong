/**
 * Scan Mode Store - Offline-first inventory workflow management
 * 
 * Tracks:
 * - Current scanning mode (delivery, transfer, wastage, adjust)
 * - Current item being processed
 * - Sync status and error state
 * - Queue operations
 * 
 * Designed for minimal re-renders through granular selectors
 * and efficient state updates.
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ScanMode = 'delivery' | 'transfer' | 'wastage' | 'adjust'
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

export interface ScanModeStore {
  // State
  currentMode: ScanMode
  currentItem: CurrentItem | null
  syncState: SyncState
  isProcessing: boolean

  // Mode management
  setMode: (mode: ScanMode) => void
  clearMode: () => void

  // Item tracking
  setCurrentItem: (item: CurrentItem | null) => void
  clearCurrentItem: () => void

  // Sync management
  setSyncStatus: (status: SyncStatus, error?: string) => void
  setSyncProgress: (itemsSyncedCount: number) => void
  clearSyncError: () => void

  // Processing state
  setProcessing: (processing: boolean) => void

  // Batch operations
  resetWorkflow: () => void

  // Derived state functions (selectors)
  isSyncing: () => boolean
  hasSyncError: () => boolean
  getSyncErrorMessage: () => string | null
}

// ============================================================================
// STORE DEFINITION
// ============================================================================

const initialSyncState: SyncState = {
  status: 'idle',
  error: undefined,
  lastSyncAt: undefined,
  itemsSyncedCount: 0,
}

export const useScanModeStore = create<ScanModeStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        currentMode: 'transfer',
        currentItem: null,
        syncState: initialSyncState,
        isProcessing: false,

        // ================================================================
        // MODE MANAGEMENT
        // ================================================================

        /**
         * Set the current scanning mode
         * Clears current item when mode changes
         */
        setMode: (mode: ScanMode) =>
          set((state) => {
            if (state.currentMode === mode) return state
            return {
              currentMode: mode,
              currentItem: state.currentItem?.mode !== mode ? null : state.currentItem,
            }
          }),

        /**
         * Clear the current mode (reset to default)
         */
        clearMode: () =>
          set({
            currentMode: 'transfer',
            currentItem: null,
          }),

        // ================================================================
        // ITEM TRACKING
        // ================================================================

        /**
         * Set the current item being scanned
         * Typically called after successful scan
         */
        setCurrentItem: (item: CurrentItem | null) =>
          set((state) => ({
            currentItem: item,
            isProcessing: item ? false : state.isProcessing,
          })),

        /**
         * Clear the current item
         */
        clearCurrentItem: () =>
          set({
            currentItem: null,
          }),

        // ================================================================
        // SYNC MANAGEMENT
        // ================================================================

        /**
         * Set sync status with optional error message
         * 
         * @param status - 'idle' | 'syncing' | 'error' | 'success'
         * @param error - Optional error message
         */
        setSyncStatus: (status: SyncStatus, error?: string) =>
          set((state) => ({
            syncState: {
              ...state.syncState,
              status,
              error,
              lastSyncAt: status === 'success' ? Date.now() : state.syncState.lastSyncAt,
            },
            isProcessing:
              status === 'syncing'
                ? true
                : status === 'success' || status === 'error' || status === 'idle'
                  ? false
                  : state.isProcessing,
          })),

        /**
         * Update sync progress (items synced count)
         */
        setSyncProgress: (itemsSyncedCount: number) =>
          set((state) => ({
            syncState: {
              ...state.syncState,
              itemsSyncedCount,
            },
          })),

        /**
         * Clear any sync error
         */
        clearSyncError: () =>
          set((state) => ({
            syncState: {
              ...state.syncState,
              error: undefined,
              status: state.syncState.status === 'error' ? 'idle' : state.syncState.status,
            },
          })),

        // ================================================================
        // PROCESSING STATE
        // ================================================================

        /**
         * Set whether a scan is currently being processed
         * Prevents double-taps during processing
         */
        setProcessing: (processing: boolean) =>
          set({
            isProcessing: processing,
          }),

        // ================================================================
        // BATCH OPERATIONS
        // ================================================================

        /**
         * Reset entire workflow to initial state
         * Used when clearing mode or returning to home
         */
        resetWorkflow: () =>
          set({
            currentMode: 'transfer',
            currentItem: null,
            syncState: { ...initialSyncState },
            isProcessing: false,
          }),

        // ================================================================
        // DERIVED STATE (SELECTORS)
        // ================================================================

        /**
         * Check if currently syncing
         */
        isSyncing: () => get().syncState.status === 'syncing',

        /**
         * Check if sync has error
         */
        hasSyncError: () => get().syncState.status === 'error',

        /**
         * Get sync error message or null
         */
        getSyncErrorMessage: () => get().syncState.error || null,
      }),
      {
        name: 'scan-mode-store',
        version: 1,
        // Persist all state except isProcessing (runtime-only)
        partialize: (state) => ({
          currentMode: state.currentMode,
          currentItem: state.currentItem,
          syncState: state.syncState,
        } as ScanModeStore),
      }
    )
  )
)

// ============================================================================
// OPTIMIZED SELECTORS (for granular subscriptions and minimal re-renders)
// ============================================================================

/**
 * Subscribe to mode changes only
 * Use in components that only care about the current mode
 */
export const useScanMode = () => useScanModeStore((state) => state.currentMode)

/**
 * Subscribe to current item only
 * Use in item detail displays
 */
export const useCurrentItem = () => useScanModeStore((state) => state.currentItem)

/**
 * Subscribe to sync status only
 * Use in sync status indicators
 */
export const useSyncStatus = () => useScanModeStore((state) => state.syncState.status)

/**
 * Subscribe to sync error only
 * Use in error alert components
 */
export const useSyncError = () => useScanModeStore((state) => state.syncState.error)

/**
 * Subscribe to processing state only
 * Use for loading spinners or disable buttons during scan
 */
export const useIsProcessing = () => useScanModeStore((state) => state.isProcessing)

/**
 * Subscribe to complete sync state
 * Use for detailed sync status displays
 */
export const useSyncState = () => useScanModeStore((state) => state.syncState)

/**
 * Subscribe to workflow context (mode + item + sync)
 * Use in main scan workflow components
 */
export const useWorkflowContext = () =>
  useScanModeStore(
    useShallow((state) => ({
      mode: state.currentMode,
      item: state.currentItem,
      syncStatus: state.syncState.status,
      isProcessing: state.isProcessing,
    } as const))
  )

/**
 * Subscribe to sync actions
 * Use to access sync functions without watching state
 */
export const useSyncActions = () =>
  useScanModeStore(
    useShallow((state) => ({
      setSyncStatus: state.setSyncStatus,
      setSyncProgress: state.setSyncProgress,
      clearSyncError: state.clearSyncError,
      hasSyncError: state.syncState.status === 'error',
      isSyncing: state.syncState.status === 'syncing',
    }))
  )

/**
 * Subscribe to mode actions
 * Use to change modes and reset workflows
 */
export const useModeActions = () =>
  useScanModeStore(
    useShallow((state) => ({
      setMode: state.setMode,
      clearMode: state.clearMode,
      resetWorkflow: state.resetWorkflow,
    }))
  )

/**
 * Subscribe to item actions
 * Use to set and clear current item
 */
export const useItemActions = () =>
  useScanModeStore(
    useShallow((state) => ({
      setCurrentItem: state.setCurrentItem,
      clearCurrentItem: state.clearCurrentItem,
    }))
  )

// ============================================================================
// HELPER FUNCTIONS (for common patterns)
// ============================================================================

/**
 * Process a successful scan
 * Wraps the typical scan completion flow
 */
export const handleScanSuccess = (item: {
  sku: string
  name: string
  quantity: number
}) => {
  const { currentMode, setCurrentItem, setProcessing } = useScanModeStore.getState()
  
  setCurrentItem({
    ...item,
    mode: currentMode,
    timestamp: Date.now(),
  })
  setProcessing(false)
}

/**
 * Process a sync error
 * Sets error status with message
 */
export const handleSyncError = (message: string) => {
  const { setSyncStatus } = useScanModeStore.getState()
  setSyncStatus('error', message)
}

/**
 * Start sync operation
 * Sets status to syncing and clears previous errors
 */
export const startSync = () => {
  const { setSyncStatus } = useScanModeStore.getState()
  setSyncStatus('syncing')
}

/**
 * Complete sync operation
 * Sets status to success with timestamp
 */
export const completeSync = (itemsSynced: number = 0) => {
  const { setSyncStatus, setSyncProgress } = useScanModeStore.getState()
  if (itemsSynced > 0) {
    setSyncProgress(itemsSynced)
  }
  setSyncStatus('success')
  // Auto-reset to idle after 2 seconds
  setTimeout(() => {
    const state = useScanModeStore.getState()
    if (state.syncState.status === 'success') {
      state.setSyncStatus('idle')
    }
  }, 2000)
}

