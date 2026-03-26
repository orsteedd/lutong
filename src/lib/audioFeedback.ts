/**
 * Audio Feedback System
 * Provides instant haptic and audio feedback for scan events
 */

type FeedbackType = 'success' | 'complete' | 'error' | 'warning'

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

const audioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as WebkitWindow).webkitAudioContext
    : undefined

const audioContext: AudioContext | null = audioContextCtor ? new audioContextCtor() : null

/**
 * Play beep sound for successful scan
 */
export const playSuccessBeep = async () => {
  if (!audioContext) return

  try {
    const now = audioContext.currentTime
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()

    osc.connect(gain)
    gain.connect(audioContext.destination)

    osc.frequency.value = 1000 // Hz
    osc.type = 'sine'

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

    osc.start(now)
    osc.stop(now + 0.1)
  } catch (err) {
    console.error('Audio playback error:', err)
  }
}

/**
 * Play double beep for completed action
 */
export const playCompleteDoubleBeep = async () => {
  if (!audioContext) return

  try {
    const now = audioContext.currentTime
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()

    osc.connect(gain)
    gain.connect(audioContext.destination)

    osc.frequency.value = 1100
    osc.type = 'sine'

    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06)
    gain.gain.setValueAtTime(0.28, now + 0.09)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

    osc.start(now)
    osc.stop(now + 0.16)
  } catch (err) {
    console.error('Audio playback error:', err)
  }
}

/**
 * Play buzz sound for validation error
 */
export const playErrorBuzz = async () => {
  if (!audioContext) return

  try {
    const now = audioContext.currentTime
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()

    osc.connect(gain)
    gain.connect(audioContext.destination)

    osc.frequency.value = 300 // Lower frequency for error
    osc.type = 'sine'

    // Double buzz pattern
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
    gain.gain.setValueAtTime(0.2, now + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18)

    osc.start(now)
    osc.stop(now + 0.2)
  } catch (err) {
    console.error('Audio playback error:', err)
  }
}

/**
 * Play warning sound
 */
export const playWarningBeep = async () => {
  if (!audioContext) return

  try {
    const now = audioContext.currentTime
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()

    osc.connect(gain)
    gain.connect(audioContext.destination)

    osc.frequency.setValueAtTime(800, now)
    osc.frequency.setValueAtTime(600, now + 0.05)
    osc.type = 'sine'

    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

    osc.start(now)
    osc.stop(now + 0.15)
  } catch (err) {
    console.error('Audio playback error:', err)
  }
}

/**
 * Trigger device vibration if available
 */
export const triggerVibration = (pattern: number | number[] = 50) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

/**
 * Provide combined feedback (audio + haptic)
 */
export const provideFeedback = async (type: FeedbackType) => {
  switch (type) {
    case 'success':
      triggerVibration(50)
      await playSuccessBeep()
      break
    case 'complete':
      triggerVibration([35, 35, 35])
      await playCompleteDoubleBeep()
      break
    case 'error':
      triggerVibration([100, 50, 100]) // Buzz pattern
      await playErrorBuzz()
      break
    case 'warning':
      triggerVibration(30)
      await playWarningBeep()
      break
  }
}
