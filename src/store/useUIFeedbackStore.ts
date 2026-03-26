import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  playCompleteDoubleBeep,
  playErrorBuzz,
  playSuccessBeep,
  playWarningBeep,
  triggerVibration,
} from '@/lib/audioFeedback'

export type FeedbackLevel = 'success' | 'complete' | 'error' | 'warning' | 'info'

export interface UIAlert {
  id: string
  level: FeedbackLevel
  message: string
  timestamp: number
}

interface UIFeedbackStore {
  alerts: UIAlert[]
  activeMessage: string
  activeLevel: FeedbackLevel | null
  soundEnabled: boolean
  vibrationEnabled: boolean

  setSoundEnabled: (enabled: boolean) => void
  setVibrationEnabled: (enabled: boolean) => void

  showFeedback: (level: FeedbackLevel, message: string) => Promise<void>
  clearActiveFeedback: () => void

  pushAlert: (alert: UIAlert) => void
  dismissAlert: (id: string) => void
  clearAlerts: () => void
}

export const useUIFeedbackStore = create<UIFeedbackStore>()(
  persist(
    (set, get) => ({
      alerts: [],
      activeMessage: '',
      activeLevel: null,
      soundEnabled: true,
      vibrationEnabled: true,

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVibrationEnabled: (vibrationEnabled) => set({ vibrationEnabled }),

      showFeedback: async (level, message) => {
        const now = Date.now()
        const id = `${level}-${now}`
        const state = get()

        // Update UI first so feedback appears instantly during rapid scans.
        set((prev) => ({
          activeLevel: level,
          activeMessage: message,
          alerts: [{ id, level, message, timestamp: now }, ...prev.alerts].slice(0, 20),
        }))

        void Promise.resolve().then(async () => {
          if (state.vibrationEnabled) {
            if (level === 'success') triggerVibration(50)
            if (level === 'complete') triggerVibration([35, 35, 35])
            if (level === 'warning') triggerVibration(30)
            if (level === 'error') triggerVibration([100, 50, 100])
          }

          if (state.soundEnabled) {
            if (level === 'success') await playSuccessBeep()
            if (level === 'complete') await playCompleteDoubleBeep()
            if (level === 'warning') await playWarningBeep()
            if (level === 'error') await playErrorBuzz()
          }
        })
      },

      clearActiveFeedback: () => set({ activeLevel: null, activeMessage: '' }),

      pushAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 20) })),
      dismissAlert: (id) =>
        set((state) => ({ alerts: state.alerts.filter((alert) => alert.id !== id) })),
      clearAlerts: () => set({ alerts: [] }),
    }),
    {
      name: 'ui-feedback-store',
      version: 1,
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        vibrationEnabled: state.vibrationEnabled,
      }),
    }
  )
)
