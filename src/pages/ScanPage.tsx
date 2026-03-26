import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import jsQR from 'jsqr'
import { Button } from '@/components'
import { useModeActions, useOfflineQueueStore, useScanMode, useUIFeedbackStore } from '@/store'
import {
  processScanInput,
  lookupItemBySku,
  type ScanModeMetadata,
  type ScanType,
  type InventoryItemData,
} from '@/lib/scanEngine'
import './ScanPage.css'

interface ScanFeedback {
  type: 'success' | 'complete' | 'error' | 'idle'
  message: string
}

interface ScanResultSnapshot {
  sku: string
  name: string
  quantity: number
  mode: ScanType
  context: string
}

interface ScanDraft {
  sku: string
  item: InventoryItemData
  quantity: number
}

interface ParsedQrPayload {
  sku: string
  quantity?: number
  encodedMode?: ScanType
}

const DUPLICATE_WINDOW_MS = 3000
const TRANSFER_FROM_LOCATION = 'Stock'
const TRANSFER_TO_LOCATION = 'Display'

const MODE_CONFIG: Record<
  ScanType,
  { label: string; actionLabel: string; feedbackVerb: string; helper: string }
> = {
  delivery: {
    label: 'Delivery',
    actionLabel: 'Receive',
    feedbackVerb: 'received',
    helper: 'Record incoming stock',
  },
  transfer: {
    label: 'Transfer',
    actionLabel: 'Move',
    feedbackVerb: 'moved',
    helper: 'Move stock between locations',
  },
  wastage: {
    label: 'Wastage',
    actionLabel: 'Discard',
    feedbackVerb: 'discarded',
    helper: 'Log damaged or expired stock',
  },
  audit: {
    label: 'Audit',
    actionLabel: 'Count',
    feedbackVerb: 'counted',
    helper: 'Verify physical stock count',
  },
}

const ScanPage = () => {
  const pendingScansState = useOfflineQueueStore((state) => state.pendingScans)
  const enqueueScan = useOfflineQueueStore((state) => state.enqueueScan)
  const isSyncing = useOfflineQueueStore((state) => state.isSyncing)
  const currentMode = useScanMode() as ScanType
  const { setMode } = useModeActions()
  const activeLevel = useUIFeedbackStore((state) => state.activeLevel)
  const activeMessage = useUIFeedbackStore((state) => state.activeMessage)
  const showFeedback = useUIFeedbackStore((state) => state.showFeedback)
  const clearActiveFeedback = useUIFeedbackStore((state) => state.clearActiveFeedback)
  const [barcodeInput, setBarcode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<ScanFeedback>({ type: 'idle', message: '' })
  const [scanDraft, setScanDraft] = useState<ScanDraft | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [draftQuantity, setDraftQuantity] = useState('1')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isMobileCameraView, setIsMobileCameraView] = useState(() => window.innerWidth <= 768)
  const [wastageReason, setWastageReason] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [recentResult, setRecentResult] = useState<ScanResultSnapshot | null>(null)
  const [searchParams] = useSearchParams()
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const qrUploadInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)
  const reasonInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recentScanRef = useRef<Map<string, number>>(new Map())
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detectorRef = useRef<{
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
  } | null>(null)
  const detectorBusyRef = useRef(false)
  const lastAutoScanRef = useRef<{ value: string; timestamp: number }>({ value: '', timestamp: 0 })
  const pendingScans = Array.isArray(pendingScansState) ? pendingScansState : []

  const focusScannerListener = useCallback(() => {
    requestAnimationFrame(() => {
      barcodeInputRef.current?.focus()
    })
  }, [])

  const stopCameraStream = useCallback(() => {
    const stream = cameraStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }
  }, [])

  const startCamera = useCallback(
    async (preferred: 'environment' | 'user' = 'environment') => {
      setCameraError(null)
      setCameraActive(false)
      stopCameraStream()

      const attempts: Array<'environment' | 'user' | null> = [
        preferred,
        preferred === 'environment' ? 'user' : 'environment',
        null,
      ]

      let lastError: unknown = null

      for (const attempt of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(
            attempt
              ? {
                  video: {
                    facingMode: { ideal: attempt },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                }
              : { video: true, audio: false }
          )

          cameraStreamRef.current = stream
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream
            void cameraVideoRef.current.play().catch(() => {
              // Ignore autoplay errors; user can still scan manually.
            })
          }

          if (attempt) {
            setCameraFacingMode(attempt)
          }

          setCameraActive(true)
          return
        } catch (err) {
          lastError = err
        }
      }

      const message =
        lastError instanceof Error ? lastError.message : 'Could not access camera'
      setCameraError(message)
      setCameraActive(false)
    },
    [stopCameraStream]
  )

  useEffect(() => {
    if (!isMobileCameraView) {
      stopCameraStream()
      setCameraActive(false)
      setCameraError(null)
      return
    }

    void startCamera('environment')

    return () => {
      stopCameraStream()
      setCameraActive(false)
    }
  }, [isMobileCameraView, startCamera, stopCameraStream])

  useEffect(() => {
    const handleResize = () => {
      setIsMobileCameraView(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (detailSheetOpen) return
    focusScannerListener()
  }, [detailSheetOpen, focusScannerListener])

  useEffect(() => {
    const modeParam = searchParams.get('mode')
    const sessionParam = searchParams.get('session')
    if (
      modeParam === 'delivery' ||
      modeParam === 'transfer' ||
      modeParam === 'wastage' ||
      modeParam === 'audit'
    ) {
      setMode(modeParam)
    }
    if (sessionParam) {
      setSessionId(sessionParam)
    }
  }, [searchParams, setMode])

  const showErrorAndRecover = (message: string) => {
    setFeedback({ type: 'error', message })
    void showFeedback('error', message)
    setBarcode('')
    focusScannerListener()
  }

  const decodeQrFromFile = async (file: File): Promise<string | null> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
          return
        }
        reject(new Error('Failed to read image file'))
      }
      reader.onerror = () => reject(new Error('Failed to read image file'))
      reader.readAsDataURL(file)
    })

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Invalid image format'))
      img.src = dataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Could not process image')
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const decoded = jsQR(imageData.data, imageData.width, imageData.height)

    return decoded?.data?.trim() || null
  }

  const handleQrUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsSubmitting(true)
    try {
      const decodedValue = await decodeQrFromFile(file)
      if (!decodedValue) {
        showErrorAndRecover('No QR detected in uploaded image')
        return
      }

      setBarcode(decodedValue)
      await handleScan(decodedValue)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode uploaded QR'
      showErrorAndRecover(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const parseQrPayload = (raw: string): { ok: true; data: ParsedQrPayload } | { ok: false; error: string } => {
    const trimmed = raw.trim()
    if (!trimmed) return { ok: false, error: 'Invalid QR: empty value' }

    let encodedMode: ScanType | undefined
    let payload = trimmed

    // Supported formats:
    // SKU
    // SKU:QTY
    // MODE|SKU
    // MODE|SKU:QTY
    if (trimmed.includes('|')) {
      const tokens = trimmed.split('|')
      if (tokens.length !== 2) {
        return { ok: false, error: 'Invalid QR format' }
      }
      const modeToken = tokens[0].trim().toLowerCase()
      if (
        modeToken !== 'delivery' &&
        modeToken !== 'transfer' &&
        modeToken !== 'wastage' &&
        modeToken !== 'audit'
      ) {
        return { ok: false, error: 'Invalid QR mode tag' }
      }
      encodedMode = modeToken
      payload = tokens[1].trim()
    }

    if (!payload || payload.startsWith(':') || payload.endsWith(':')) {
      return { ok: false, error: 'Missing SKU or quantity in QR' }
    }

    const skuQtyTokens = payload.split(':')
    if (skuQtyTokens.length > 2) {
      return { ok: false, error: 'Invalid QR: too many separators' }
    }

    const sku = skuQtyTokens[0].trim().toUpperCase()
    if (!/^[A-Z0-9-]+$/.test(sku)) {
      return { ok: false, error: 'Invalid QR: malformed SKU' }
    }

    if (skuQtyTokens.length === 1) {
      return { ok: true, data: { sku, encodedMode } }
    }

    const quantityRaw = skuQtyTokens[1].trim()
    if (!quantityRaw) {
      return { ok: false, error: 'Missing quantity in QR' }
    }

    const quantity = Number.parseInt(quantityRaw, 10)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: 'Invalid quantity in QR' }
    }

    return { ok: true, data: { sku, quantity, encodedMode } }
  }

  const isDuplicateScan = (sku: string, quantity: number, metadata: ScanModeMetadata) => {
    const now = Date.now()
    const recent = recentScanRef.current

    for (const [key, ts] of recent.entries()) {
      if (now - ts > DUPLICATE_WINDOW_MS) {
        recent.delete(key)
      }
    }

    const dedupeKey = [
      currentMode,
      sku,
      quantity,
      metadata.sessionId || '',
      metadata.reason || '',
      metadata.fromLocation || '',
      metadata.toLocation || '',
    ].join('|')

    const previous = recent.get(dedupeKey)
    if (previous && now - previous <= DUPLICATE_WINDOW_MS) {
      return true
    }

    recent.set(dedupeKey, now)
    return false
  }

  const handleScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)

    const parsed = parseQrPayload(barcode)
    if (!parsed.ok) {
      showErrorAndRecover(parsed.error)
      return
    }

    const { sku, quantity, encodedMode } = parsed.data

    if (encodedMode) {
      setMode(encodedMode)
    }

    // Look up item to get full details
    const lookup = lookupItemBySku(sku)
    if (!lookup.found || !lookup.item) {
      showErrorAndRecover(lookup.error || 'Item not found')
      return
    }

    setScanDraft({
      sku,
      item: lookup.item,
      quantity: quantity ?? 1,
    })
    setDraftQuantity(String(quantity ?? 1))
    setDetailSheetOpen(true)
    void showFeedback('success', `${MODE_CONFIG[currentMode].label}: ${lookup.item.name}`)
    setBarcode('')
  }, [currentMode, focusScannerListener, setMode, showFeedback])

  useEffect(() => {
    const windowWithDetector = window as Window & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
      }
    }

    if (!windowWithDetector.BarcodeDetector) {
      detectorRef.current = null
      return
    }

    try {
      detectorRef.current = new windowWithDetector.BarcodeDetector({ formats: ['qr_code'] })
    } catch {
      detectorRef.current = new windowWithDetector.BarcodeDetector()
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || detailSheetOpen) return
    if (!detectorRef.current) return

    let cancelled = false

    const schedule = () => {
      if (cancelled) return
      autoScanTimerRef.current = setTimeout(() => {
        void tick()
      }, 320)
    }

    const tick = async () => {
      if (cancelled) return
      const detector = detectorRef.current
      const video = cameraVideoRef.current

      if (!detector || !video || video.readyState < 2 || detailSheetOpen || isSubmitting) {
        schedule()
        return
      }

      if (detectorBusyRef.current) {
        schedule()
        return
      }

      detectorBusyRef.current = true

      try {
        const detections = await detector.detect(video)
        const detectedValue = detections.find((item) => item.rawValue?.trim())?.rawValue?.trim()

        if (detectedValue) {
          const now = Date.now()
          const last = lastAutoScanRef.current

          if (detectedValue !== last.value || now - last.timestamp > DUPLICATE_WINDOW_MS) {
            lastAutoScanRef.current = { value: detectedValue, timestamp: now }
            setBarcode(detectedValue)
            await handleScan(detectedValue)
          }
        }
      } catch {
        // Keep camera loop alive even if a frame decode fails.
      } finally {
        detectorBusyRef.current = false
        schedule()
      }
    }

    schedule()

    return () => {
      cancelled = true
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current)
        autoScanTimerRef.current = null
      }
    }
  }, [cameraActive, detailSheetOpen, handleScan, isSubmitting])

  const getModeMetadata = (): ScanModeMetadata => {
    if (currentMode === 'delivery' || currentMode === 'audit') {
      return { sessionId: sessionId.trim() }
    }
    if (currentMode === 'wastage') {
      return { reason: wastageReason.trim() }
    }
    if (currentMode === 'transfer') {
      return {
        fromLocation: TRANSFER_FROM_LOCATION,
        toLocation: TRANSFER_TO_LOCATION,
      }
    }
    return {}
  }

  const hasRequiredModeInputs = () => {
    if (currentMode === 'delivery' || currentMode === 'audit') {
      return Boolean(sessionId.trim())
    }
    if (currentMode === 'wastage') {
      return Boolean(wastageReason.trim())
    }
    if (currentMode === 'transfer') return true
    return true
  }

  const processScanWithQuantity = async (item: InventoryItemData, quantity: number): Promise<boolean> => {
    if (quantity <= 0) {
      showErrorAndRecover('Missing or invalid quantity')
      return false
    }

    if (!hasRequiredModeInputs()) {
      const msg =
        currentMode === 'delivery' || currentMode === 'audit'
          ? 'Session is required'
          : currentMode === 'wastage'
          ? 'Reason is required for wastage'
          : currentMode === 'transfer'
            ? 'Transfer is fixed to Stock -> Display'
            : 'Missing required fields'
      showErrorAndRecover(msg)
      return false
    }

    const metadata = getModeMetadata()
    if (isDuplicateScan(item.sku, quantity, metadata)) {
      showErrorAndRecover('Duplicate scan detected. Try again in a moment.')
      return false
    }

    // Use scan engine to validate, persist, and create record
    // Non-blocking: fires off IndexedDB writes without awaiting
    setFeedback({ type: 'success', message: `Processing ${item.sku}...` })
    const result = await processScanInput(item.sku, quantity, currentMode, metadata)

    if (!result.success) {
      showErrorAndRecover(result.error || 'Scan failed')
      return false
    }

    // Enqueue the validated record
    if (result.record) {
      const contextMessage =
        currentMode === 'delivery'
          ? `Session ${metadata.sessionId || 'N/A'} • ${
              pendingScans.filter(
                (scan) => scan.type === 'delivery' && scan.metadata?.sessionId === metadata.sessionId
              ).length + 1
            } lines scanned`
          : currentMode === 'audit'
            ? `Session ${metadata.sessionId || 'N/A'} • Count logged`
            : currentMode === 'wastage'
              ? `Reason: ${metadata.reason || 'No reason'}`
              : currentMode === 'transfer'
                ? `${metadata.fromLocation || 'Unknown'} -> ${metadata.toLocation || 'Unknown'}`
                : 'Recorded'

      enqueueScan(result.record)
      const verb = MODE_CONFIG[currentMode].feedbackVerb
      setFeedback({ type: 'complete', message: `✓ ${MODE_CONFIG[currentMode].label} • ${quantity}x ${item.sku} ${verb}` })
      setRecentResult({
        sku: item.sku,
        name: item.name,
        quantity,
        mode: currentMode,
        context: contextMessage,
      })

      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      resultTimeoutRef.current = setTimeout(() => {
        setRecentResult(null)
      }, 2200)

      void showFeedback('complete', `${MODE_CONFIG[currentMode].label}: ${quantity}x ${item.name} ${verb}`)
      setBarcode('')
      focusScannerListener()

      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback({ type: 'idle', message: '' })
        clearActiveFeedback()
      }, 1500)

      return true
    }

    return false
  }

  const handleConfirmScanDraft = async () => {
    if (!scanDraft) return

    const quantity = Number.parseInt(draftQuantity, 10)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      showErrorAndRecover('Missing or invalid quantity')
      return
    }

    const success = await processScanWithQuantity(scanDraft.item, quantity)
    if (!success) {
      return
    }

    setScanDraft(null)
    setDetailSheetOpen(false)
    setDraftQuantity('1')
    focusScannerListener()
  }

  const handleCloseDetailSheet = () => {
    setDetailSheetOpen(false)
    setScanDraft(null)
    focusScannerListener()
  }

  useEffect(() => {
    if (!detailSheetOpen) return

    const timer = setTimeout(() => {
      if (currentMode === 'delivery' || currentMode === 'audit') {
        sessionInputRef.current?.focus()
        return
      }

      if (currentMode === 'wastage') {
        reasonInputRef.current?.focus()
        return
      }

      quantityInputRef.current?.focus()
    }, 0)

    return () => clearTimeout(timer)
  }, [currentMode, detailSheetOpen])

  const handleScannerSubmit = async () => {
    if (!barcodeInput.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await handleScan(barcodeInput)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void handleScannerSubmit()
  }

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current)
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current)
    }
  }, [])

  const displayFeedbackType =
    activeLevel === 'error'
      ? 'error'
      : activeLevel === 'complete'
        ? 'complete'
        : activeLevel === 'success'
          ? 'success'
          : feedback.type
  const displayFeedbackMessage = activeMessage || feedback.message
  const cameraStatusMessage = isSubmitting
    ? 'Analyzing scan...'
    : isSyncing
      ? 'Syncing background queue...'
      : 'Ready to scan'

  if (!isMobileCameraView) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="scan-page-container"
      onClickCapture={() => {
        if (!detailSheetOpen) {
          focusScannerListener()
        }
      }}
    >
      <section className="scan-camera-panel">
        {cameraActive ? (
          <div className="camera-placeholder">
            <video
              ref={cameraVideoRef}
              className="camera-video"
              autoPlay
              muted
              playsInline
            />
            <div className="scan-frame-overlay">
              <div className="scan-crosshair" />
              <div className="scan-corner scan-corner-tl" />
              <div className="scan-corner scan-corner-tr" />
              <div className="scan-corner scan-corner-bl" />
              <div className="scan-corner scan-corner-br" />
            </div>
            <div className={`scan-camera-pill ${isSubmitting ? 'scan-camera-pill-active' : ''}`}>
              {cameraStatusMessage}
            </div>
            <div className="scan-camera-toolbar">
              <button
                type="button"
                className="camera-switch-btn"
                onClick={() => void startCamera(cameraFacingMode === 'environment' ? 'user' : 'environment')}
              >
                Use {cameraFacingMode === 'environment' ? 'Front' : 'Rear'} Camera
              </button>
            </div>
            {recentResult && (
              <div className={`scan-result-card scan-result-${recentResult.mode}`}>
                <p className="scan-result-title">Scan Captured</p>
                <p className="scan-result-name">{recentResult.name}</p>
                <p className="scan-result-meta">
                  {recentResult.sku} • {recentResult.quantity}x • {MODE_CONFIG[recentResult.mode].label}
                </p>
                <p className="scan-result-context">{recentResult.context}</p>
              </div>
            )}
            <div className="camera-vignette" />
          </div>
        ) : (
          <div className="camera-fallback">
            <div className="text-4xl mb-4">📷</div>
            <p className="text-gray-600 text-center">{cameraError || 'Camera initializing...'}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void startCamera('user')}
            >
              Try Front Camera
            </Button>
          </div>
        )}
      </section>

      <section className="scan-controls-panel">
        {displayFeedbackType !== 'idle' && displayFeedbackMessage && (
          <div className={`scan-feedback-inline scan-feedback-${displayFeedbackType}`}>
            {displayFeedbackMessage}
          </div>
        )}

        <div className="scan-listener-card">
          <p className="scan-listener-title">Scanner Listening</p>
          <p className="scan-listener-subtitle">Scan first. Mode selection appears in the detail sheet.</p>

          <input
            ref={qrUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleQrUploadChange(event)
            }}
          />

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full mb-2"
            onClick={() => qrUploadInputRef.current?.click()}
            disabled={isSubmitting}
          >
            Upload QR Image
          </Button>

          <form
            className="scan-manual-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleScannerSubmit()
            }}
          >
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              className="scan-manual-input"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder="Manual test input: SKU or SKU:QTY"
              aria-label="Manual scan input"
            />
            {barcodeInput && (
              <button
                type="button"
                className="scan-manual-clear"
                onClick={() => {
                  setBarcode('')
                  focusScannerListener()
                }}
                aria-label="Clear input"
              >
                ✕
              </button>
            )}
            <Button type="submit" className="h-10 w-full mt-2" disabled={!barcodeInput.trim() || isSubmitting}>
              {isSubmitting ? 'Scanning...' : 'Test Scan'}
            </Button>
          </form>
        </div>

      </section>

      {detailSheetOpen && scanDraft && (
        <div className="scan-detail-sheet-backdrop" onClick={handleCloseDetailSheet}>
          <div className="scan-detail-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="scan-detail-sheet-header">
              <div>
                <p className="scan-detail-kicker">Scan Details</p>
                <h3 className="scan-detail-title">{scanDraft.item.name}</h3>
                <p className="scan-detail-subtitle">{scanDraft.sku}</p>
              </div>
              <button type="button" className="scan-detail-close" onClick={handleCloseDetailSheet}>✕</button>
            </div>

            <form
              className="scan-detail-fields"
              onSubmit={(e) => {
                e.preventDefault()
                void handleConfirmScanDraft()
              }}
            >
              <div className="scan-detail-mode-picker">
                <p className="scan-detail-mode-label">Operation Mode</p>
                <div className="mode-switcher" role="tablist" aria-label="Scan mode">
                  {(Object.keys(MODE_CONFIG) as ScanType[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`mode-chip ${currentMode === mode ? 'mode-chip-active' : ''}`}
                      onClick={() => setMode(mode)}
                      aria-pressed={currentMode === mode}
                    >
                      {MODE_CONFIG[mode].label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="scan-detail-label">
                Quantity
                <input
                  ref={quantityInputRef}
                  type="number"
                  min={1}
                  value={draftQuantity}
                  onChange={(e) => setDraftQuantity(e.target.value)}
                  className="scan-detail-input"
                />
              </label>

              {(currentMode === 'delivery' || currentMode === 'audit') && (
                <label className="scan-detail-label">
                  Session ID
                  <input
                    ref={sessionInputRef}
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter session ID"
                    className="scan-detail-input"
                  />
                </label>
              )}

              {currentMode === 'wastage' && (
                <label className="scan-detail-label">
                  Wastage Reason
                  <input
                    ref={reasonInputRef}
                    type="text"
                    value={wastageReason}
                    onChange={(e) => setWastageReason(e.target.value)}
                    placeholder="Enter reason"
                    className="scan-detail-input"
                  />
                </label>
              )}

              {currentMode === 'transfer' && (
                <div className="rounded-lg border border-[#dceae4] bg-[#f7fcfa] px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-[#64748b]">Movement</p>
                  <p className="text-sm font-semibold text-[#0f172a]">
                    {TRANSFER_FROM_LOCATION} {'->'} {TRANSFER_TO_LOCATION}
                  </p>
                </div>
              )}
              <div className="scan-detail-actions">
                <Button variant="outline" className="h-11" type="button" onClick={handleCloseDetailSheet}>Cancel</Button>
                <Button className="h-11" type="submit">Confirm Scan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScanPage
