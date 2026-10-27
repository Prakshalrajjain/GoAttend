import { useCallback, useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onPhotoCaptured, photoData, liveFrameData }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamFrameCanvasRef = useRef(null)
  const fileInputRef = useRef(null)

  const [stream, setStream] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [videoResolution, setVideoResolution] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [isFlashing, setIsFlashing] = useState(false)

  const liveFrameBufferRef = useRef(null)
  const streamRef = useRef(null)
  streamRef.current = stream

  // Clean stop for all media tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore
        }
      })
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraLoading(false)
    setVideoResolution(null)
    setCountdown(null)
  }, [])

  // Enumerate all available camera devices on the laptop
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      setVideoDevices(videoInputs)
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId)
      }
    } catch (err) {
      console.warn('Could not list video devices:', err)
    }
  }, [selectedDeviceId])

  // Start real laptop camera
  const startCamera = useCallback(async (deviceIdToUse = null) => {
    setCameraError('')
    setCameraLoading(true)

    // Check secure context
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'https:'

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraLoading(false)
      if (!isLocal) {
        setCameraError(
          'Camera access requires a secure connection (HTTPS) or localhost. Please open http://localhost:5173 to access your laptop camera.'
        )
      } else {
        setCameraError('Webcam API is not supported in this browser. Please use a modern browser like Chrome, Edge, or Firefox.')
      }
      return
    }

    // Stop existing stream if running
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }

    try {
      const constraints = {
        audio: false,
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          ...(deviceIdToUse ? { deviceId: { exact: deviceIdToUse } } : {}),
        },
      }

      let mediaStream = null
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (firstErr) {
        // Fallback with basic constraints if resolution constraints are too strict
        console.warn('Strict constraints failed, falling back to basic video:', firstErr)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      setStream(mediaStream)
      setCameraActive(true)
      setCameraLoading(false)

      // Bind directly to video element if already in DOM
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch((e) => console.warn('Autoplay error:', e))
      }

      // Refresh devices list now that permission is granted
      refreshDevices()
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraLoading(false)
      setCameraActive(false)

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          'Camera permission was blocked. Please click the lock or camera icon in your browser address bar and choose "Allow".'
        )
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No webcam was found on this laptop/device.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application (e.g. Zoom, Teams, Skype, or another tab). Close it and retry.')
      } else {
        setCameraError(err.message || 'Could not access the laptop camera.')
      }
    }
  }, [refreshDevices])

  // Attach mediaStream to video tag whenever stream or videoRef becomes available
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }
      videoRef.current.play().catch((e) => console.warn('Play error:', e))
    }
  }, [stream, cameraActive])

  // Periodically sample background live stream frame for dual-verification engine
  useEffect(() => {
    let intervalId = null
    if (cameraActive && stream) {
      intervalId = setInterval(() => {
        if (!videoRef.current || !streamFrameCanvasRef.current) return
        const video = videoRef.current
        const canvas = streamFrameCanvasRef.current
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          liveFrameBufferRef.current = canvas.toDataURL('image/jpeg', 0.85)
        }
      }, 600)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [cameraActive, stream])

  // Auto-start camera when component mounts if photo has not been captured yet
  useEffect(() => {
    if (!photoData) {
      startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [])

  // Web Audio click effect
  function triggerShutterSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(600, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.09)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.09)
    } catch {
      // Audio autoplay restrictions
    }
  }

  // Trigger snapshot capture
  function performCapture() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')

    // Mirror image so the captured selfie matches what the user saw in the viewfinder
    ctx.save()
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, width, height)
    ctx.restore()

    // Visual shutter flash effect & audio click
    setIsFlashing(true)
    triggerShutterSound()
    setTimeout(() => setIsFlashing(false), 260)

    // 1. User-clicked selfie
    const userPhoto = canvas.toDataURL('image/jpeg', 0.9)

    // 2. Automated live stream frame
    const liveStreamFrame = liveFrameBufferRef.current || userPhoto

    onPhotoCaptured(userPhoto, liveStreamFrame)
    stopCamera()
  }

  // Countdown timer trigger (3-2-1 snapshot)
  function startCountdownCapture() {
    if (countdown !== null) return
    setCountdown(3)
    let currentCount = 3
    const timer = setInterval(() => {
      currentCount -= 1
      if (currentCount <= 0) {
        clearInterval(timer)
        setCountdown(null)
        performCapture()
      } else {
        setCountdown(currentCount)
      }
    }, 1000)
  }

  // Retake photo
  function handleRetake() {
    onPhotoCaptured(null, null)
    liveFrameBufferRef.current = null
    startCamera(selectedDeviceId)
  }

  // Fallback upload from device camera / file input
  function handleFallbackFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target.result
      onPhotoCaptured(dataUrl, dataUrl)
      stopCamera()
    }
    reader.readAsDataURL(file)
  }

  // Handle camera device switch
  function handleDeviceChange(e) {
    const newDeviceId = e.target.value
    setSelectedDeviceId(newDeviceId)
    startCamera(newDeviceId)
  }

  return (
    <div className="camera-capture-box">
      {/* Header Bar */}
      <div className="camera-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="camera-badge">DUAL-PHOTO VERIFICATION ENGINE</span>
          {cameraActive && (
            <span className="live-pill">● LIVE CAMERA FEED</span>
          )}
          {videoResolution && (
            <span className="camera-res-badge">{videoResolution}</span>
          )}
        </div>

        {/* Camera Selector (if multiple cameras available) */}
        {videoDevices.length > 1 && cameraActive && (
          <select
            className="camera-device-select"
            value={selectedDeviceId}
            onChange={handleDeviceChange}
            title="Switch webcam"
          >
            {videoDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId}>
                📹 {dev.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error alert with retry & fallback */}
      {cameraError && (
        <div className="camera-alert error" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Camera Access Required</strong>
              <span>{cameraError}</span>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => startCamera(selectedDeviceId)}
                >
                  🔄 Retry Laptop Camera
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  📷 Take Photo via OS Camera App
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captured Image Preview: 2 Photos (Clicked Selfie + Live Video Stream Frame) */}
      {photoData ? (
        <div className="dual-photo-preview-container" style={{ marginTop: '12px' }}>
          <div className="dual-photo-grid">
            <div className="photo-card-proof">
              <span className="proof-tag tag-primary">📸 Proof 1: User-Clicked Selfie</span>
              <img
                src={photoData}
                alt="User clicked verification selfie"
                className="captured-image dual-thumb"
              />
              <span className="proof-sub">Captured live from laptop camera</span>
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

          <div className="photo-actions" style={{ marginTop: '14px', justifyContent: 'center' }}>
            <span className="photo-verified-tag">✓ Both Photo Proofs Captured</span>
            <button
              type="button"
              className="secondary-button retake-btn"
              onClick={handleRetake}
            >
              🔄 Retake Selfie
            </button>
          </div>
        </div>
      ) : (
        /* Video Stream View */
        <div className="video-stream-container" style={{ marginTop: '12px' }}>
          {cameraLoading ? (
            <div className="camera-loading-box">
              <div className="camera-spinner" />
              <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f4' }}>
                Connecting to laptop webcam...
              </p>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Please allow camera access when prompted by your browser
              </span>
            </div>
          ) : cameraActive ? (
            <div className="video-wrapper">
              {/* Shutter Flash Animation */}
              {isFlashing && <div className="shutter-flash" />}

              {/* Countdown Overlay */}
              {countdown !== null && (
                <div className="camera-countdown-overlay">
                  <span className="countdown-number">{countdown}</span>
                </div>
              )}

              {/* Live Video Feed */}
              <video
                ref={(el) => {
                  videoRef.current = el
                  if (el && stream && el.srcObject !== stream) {
                    el.srcObject = stream
                    el.play().catch(() => {})
                  }
                }}
                autoPlay
                playsInline
                muted
                className="live-video"
                onLoadedMetadata={(e) => {
                  const w = e.target.videoWidth
                  const h = e.target.videoHeight
                  if (w && h) {
                    setVideoResolution(`${w}×${h}`)
                  }
                }}
              />

              {/* Face Guide Overlay */}
              <div className="viewfinder-overlay">
                <div className="face-oval" />
                <p className="viewfinder-tip">
                  Center your face inside the oval and click &quot;Snap Selfie&quot;
                </p>
              </div>
            </div>
          ) : (
            <div className="camera-placeholder">
              <div className="camera-icon-circle">📷</div>
              <p>Laptop Camera is Currently Off</p>
              <span className="subtext">
                GeoAttend uses your real laptop camera to verify your identity with a user-clicked selfie and a live sensor frame.
              </span>
            </div>
          )}

          {/* Camera Action Buttons */}
          <div className="camera-controls-bar">
            {!cameraActive ? (
              <button
                type="button"
                className="primary-button camera-btn"
                onClick={() => startCamera(selectedDeviceId)}
                disabled={cameraLoading}
              >
                {cameraLoading ? 'Connecting...' : '📸 Open Laptop Camera'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-button capture-btn"
                  onClick={performCapture}
                  disabled={countdown !== null}
                >
                  📸 Snap Selfie Now
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startCountdownCapture}
                  disabled={countdown !== null}
                  title="Take photo after 3-second countdown"
                >
                  ⏱️ 3s Timer
                </button>
              </>
            )}

            {/* Native Device Camera Fallback */}
            <button
              type="button"
              className="text-button-subtle"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ fontSize: '12px', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Take via Device App
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input for native camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={handleFallbackFile}
      />

      {/* Hidden canvases for capturing high-res frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={streamFrameCanvasRef} style={{ display: 'none' }} />
    </div>
  )
}
