import { useRef, useEffect, useState } from 'react'

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isCameraActive: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  captureFrame: () => string | null
  error: string | null
}

export const useCamera = (): UseCameraReturn => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCameraActive(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      throw err
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setIsCameraActive(false)
    }
  }

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null

    const context = canvasRef.current.getContext('2d')
    if (!context) return null

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    context.drawImage(videoRef.current, 0, 0)

    return canvasRef.current.toDataURL('image/png')
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return {
    videoRef,
    canvasRef,
    isCameraActive,
    startCamera,
    stopCamera,
    captureFrame,
    error: null,
  }
}
