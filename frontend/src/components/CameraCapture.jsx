import { useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onPhotoCaptured, photoData, liveFrameData }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamFrameCanvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const liveFrameBufferRef = useRef(null)

  // Continuously sample live video stream frames
  useEffect(() => {
    let intervalId = null
    if (cameraActive) {
      intervalId = setInterval(() => {
        if (!videoRef.current || !streamFrameCanvasRef.current) return
        const video = videoRef.current
        const canvas = streamFrameCanvasRef.current
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          liveFrameBufferRef.current = canvas.toDataURL('image/jpeg', 0.8)
        }
      }, 700)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [cameraActive])

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

    // 1. Frame clicked by the user
    const userPhoto = canvas.toDataURL('image/jpeg', 0.85)

    // 2. Automated frame generated through the live camera video stream
    const liveStreamFrame = liveFrameBufferRef.current || userPhoto

    onPhotoCaptured(userPhoto, liveStreamFrame)
    stopCamera()
  }

  function handleRetake() {
    onPhotoCaptured(null, null)
    liveFrameBufferRef.current = null
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
        <span className="camera-badge">DUAL-PHOTO VERIFICATION ENGINE</span>
        {cameraActive && <span className="live-pill">● LIVE CAMERA FEED</span>}
      </div>

      {cameraError && (
        <div className="camera-alert error">
          <span>⚠️ {cameraError}</span>
        </div>
      )}

      {/* Captured Image Preview: 2 Photos (Clicked Selfie + Live Video Stream Frame) */}
      {photoData ? (
        <div className="dual-photo-preview-container">
          <div className="dual-photo-grid">
            <div className="photo-card-proof">
              <span className="proof-tag tag-primary">📸 Proof 1: User-Clicked Selfie</span>
              <img src={photoData} alt="User clicked verification selfie" className="captured-image dual-thumb" />
              <span className="proof-sub">Triggered explicitly by employee</span>
            </div>

            <div className="photo-card-proof">
              <span className="proof-tag tag-secondary">🎥 Proof 2: Live Video Stream Frame</span>
              <img
                src={liveFrameData || photoData}
                alt="Automated frame from live video stream"
                className="captured-image dual-thumb"
              />
              <span className="proof-sub">Continuous live sensor capture</span>
            </div>
          </div>

          <div className="photo-actions" style={{ marginTop: '14px' }}>
            <span className="photo-verified-tag">✓ Both Photo Proofs Captured</span>
            <button
              type="button"
              className="secondary-button retake-btn"
              onClick={handleRetake}
            >
              🔄 Retake Both Photos
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
                <p className="viewfinder-tip">
                  Looking into camera: 1 manual snapshot + 1 live stream verification frame will be saved
                </p>
              </div>
            </div>
          ) : (
            <div className="camera-placeholder">
              <div className="camera-icon-circle">📷</div>
              <p>Camera is currently off</p>
              <span className="subtext">
                GeoAttend requires two photo proofs: one clicked by yourself and an automated frame captured through the live camera video stream.
              </span>
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
                ⚪ Capture Live Dual Proofs
              </button>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={streamFrameCanvasRef} style={{ display: 'none' }} />
    </div>
  )
}
