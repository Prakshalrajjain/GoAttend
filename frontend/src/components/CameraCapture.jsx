import { useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onPhotoCaptured, photoData }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  async function startCamera() {
    setCameraError('')
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser. Please use a modern browser.')
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      })

      setStream(mediaStream)
      setCameraActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.')
      } else {
        setCameraError(err.message || 'Could not access camera.')
      }
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Export as high quality JPEG data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    onPhotoCaptured(dataUrl)
    stopCamera()
  }

  function handleRetake() {
    onPhotoCaptured(null)
    startCamera()
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="camera-capture-box">
      <div className="camera-header">
        <span className="camera-badge">LIVE CAMERA VERIFICATION</span>
        {cameraActive && <span className="live-pill">● LIVE</span>}
      </div>

      {cameraError && (
        <div className="camera-alert error">
          <span>⚠️ {cameraError}</span>
        </div>
      )}

      {/* Captured Image Preview */}
      {photoData ? (
        <div className="photo-preview-container">
          <img src={photoData} alt="Captured verification photo" className="captured-image" />
          <div className="photo-actions">
            <span className="photo-verified-tag">✓ Photo Captured</span>
            <button
              type="button"
              className="secondary-button retake-btn"
              onClick={handleRetake}
            >
              🔄 Retake Photo
            </button>
          </div>
        </div>
      ) : (
        /* Video Stream View */
        <div className="video-stream-container">
          {cameraActive ? (
            <div className="video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="live-video"
              />
              <div className="viewfinder-overlay">
                <div className="face-oval"></div>
                <p className="viewfinder-tip">Position your face inside the circle</p>
              </div>
            </div>
          ) : (
            <div className="camera-placeholder">
              <div className="camera-icon-circle">📷</div>
              <p>Camera is currently off</p>
              <span className="subtext">A live selfie is required to verify your physical presence.</span>
            </div>
          )}

          <div className="camera-controls">
            {!cameraActive ? (
              <button
                type="button"
                className="primary-button camera-btn"
                onClick={startCamera}
              >
                📸 Enable Live Camera
              </button>
            ) : (
              <button
                type="button"
                className="primary-button capture-btn"
                onClick={capturePhoto}
              >
                ⚪ Capture Live Photo
              </button>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
