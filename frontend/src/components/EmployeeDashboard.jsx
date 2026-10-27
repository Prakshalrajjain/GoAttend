import { useEffect, useState } from 'react'
import {
  checkInAttendance,
  checkOutAttendance,
  getMyAttendanceHistory,
  getOfficeLocations,
  getTodayAttendance,
  verifyGeofence,
} from '../services/api.js'
import CameraCapture from './CameraCapture.jsx'

export default function EmployeeDashboard({ user, onLogout }) {
  const [locations, setLocations] = useState([])
  const [selectedOfficeId, setSelectedOfficeId] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [userCoords, setUserCoords] = useState(null)
  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [gpsError, setGpsError] = useState('')
  const [geofenceStatus, setGeofenceStatus] = useState(null)
  const [geofenceLoading, setGeofenceLoading] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState(null)

  const [todayData, setTodayData] = useState({ has_checked_in: false, record: null })
  const [todayLoading, setTodayLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null)

  // Load initial data
  useEffect(() => {
    loadTodayStatus()
    loadOfficeLocations()
    loadHistory()
  }, [])

  async function loadTodayStatus() {
    setTodayLoading(true)
    try {
      const data = await getTodayAttendance()
      setTodayData(data)
    } catch (err) {
      console.error('Failed to load today status:', err)
    } finally {
      setTodayLoading(false)
    }
  }

  async function loadOfficeLocations() {
    try {
      const locs = await getOfficeLocations()
      setLocations(locs)
      if (locs.length > 0 && !selectedOfficeId) {
        setSelectedOfficeId(locs[0].id)
      }
    } catch (err) {
      console.error('Failed to load offices:', err)
    }
  }

  async function loadHistory(start = startDate, end = endDate) {
    setHistoryLoading(true)
    try {
      const data = await getMyAttendanceHistory(start, end)
      setHistory(data)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Request browser GPS
  function requestLocation() {
    setGpsError('')
    setGpsLoading(true)
    setGeofenceStatus(null)

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.')
      setGpsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        setUserCoords(coords)
        setGpsAccuracy(Math.round(pos.coords.accuracy))
        setGpsLoading(false)

        // Verify distance against currently selected office
        if (selectedOfficeId) {
          await runGeofenceCheck(selectedOfficeId, coords.latitude, coords.longitude)
        }
      },
      (err) => {
        setGpsLoading(false)
        console.error('Geolocation error:', err)
        if (err.code === 1) {
          setGpsError('Location permission was denied. Please allow location access in your browser.')
        } else if (err.code === 2) {
          setGpsError('Location unavailable. Ensure GPS is enabled.')
        } else if (err.code === 3) {
          setGpsError('Location request timed out. Please try again.')
        } else {
          setGpsError('Could not determine your GPS location.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    )
  }

  async function runGeofenceCheck(officeId, lat, lon) {
    setGeofenceLoading(true)
    try {
      const res = await verifyGeofence(officeId, lat, lon)
      setGeofenceStatus(res)
    } catch (err) {
      console.error('Geofence check failed:', err)
      setGeofenceStatus(null)
    } finally {
      setGeofenceLoading(false)
    }
  }

  // Handle office selection change
  async function handleOfficeChange(e) {
    const newId = Number(e.target.value)
    setSelectedOfficeId(newId)
    if (userCoords) {
      await runGeofenceCheck(newId, userCoords.latitude, userCoords.longitude)
    }
  }

  // Check-In Action
  async function handleCheckIn() {
    setActionError('')
    setActionSuccess('')

    if (!userCoords) {
      setActionError('Please acquire your GPS location first.')
      return
    }

    if (!selectedOfficeId) {
      setActionError('Please select your office location.')
      return
    }

    if (!capturedPhoto) {
      setActionError('Please capture a live verification photo before checking in.')
      return
    }

    setActionLoading(true)
    try {
      await checkInAttendance(
        selectedOfficeId,
        userCoords.latitude,
        userCoords.longitude,
        capturedPhoto,
      )
      setActionSuccess('Attendance verified and recorded successfully!')
      setCapturedPhoto(null)
      await loadTodayStatus()
      await loadHistory()
    } catch (err) {
      console.error('Check-in error:', err)
      setActionError(err.message || 'Check-in failed.')
    } finally {
      setActionLoading(false)
    }
  }

  // Check-Out Action
  async function handleCheckOut() {
    setActionError('')
    setActionSuccess('')
    setActionLoading(true)

    try {
      const lat = userCoords ? userCoords.latitude : null
      const lon = userCoords ? userCoords.longitude : null
      await checkOutAttendance(lat, lon)
      setActionSuccess('Checked out successfully!')
      await loadTodayStatus()
      await loadHistory()
    } catch (err) {
      console.error('Check-out error:', err)
      setActionError(err.message || 'Check-out failed.')
    } finally {
      setActionLoading(false)
    }
  }

  // Format timestamp helper
  function formatTime(isoString) {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function formatDate(isoString) {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">EMPLOYEE ATTENDANCE WORKSPACE</span>
          <h1>Welcome back, <span>{user?.full_name || 'Employee'}</span></h1>
          <p className="description">
            Your real-time GPS location and live photo are verified against authorized office geofences.
          </p>
        </div>

        <div className="user-badge-card">
          <div className="user-avatar-circle">
            {(user?.full_name || 'U')[0].toUpperCase()}
          </div>
          <div className="user-badge-details">
            <span className="user-badge-name">{user?.full_name}</span>
            <span className="user-badge-email">{user?.email}</span>
            <span className="role-chip">{user?.role?.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Action Messages */}
      {actionError && (
        <div className="auth-alert error" role="alert">
          <span>⚠️ {actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="auth-alert success" role="status">
          <span>✓ {actionSuccess}</span>
        </div>
      )}

      {/* Main Grid: Today's Status & Action Panel */}
      <div className="dashboard-grid">
        {/* Left Column: Today's Session */}
        <section className="dashboard-card session-card">
          <div className="card-top">
            <div className="card-title-group">
              <span className="card-badge">TODAY'S ATTENDANCE</span>
              <h2>Daily Check-in & Check-out</h2>
            </div>
            <span className="today-date-pill">
              📅 {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {todayLoading ? (
            <div className="loading-state">
              <span className="spinner"></span> Checking today's attendance record...
            </div>
          ) : todayData.has_checked_in ? (
            /* User already checked in today */
            <div className="today-active-view">
              <div className="status-banner present">
                <span className="status-dot present"></span>
                <span>
                  {todayData.record?.check_out_at
                    ? 'COMPLETED FOR TODAY'
                    : 'ACTIVE SESSION — CHECKED IN'}
                </span>
              </div>

              <div className="session-details-table">
                <div className="session-detail-row">
                  <span className="label">Office Location</span>
                  <span className="value">{todayData.record?.office_name}</span>
                </div>
                <div className="session-detail-row">
                  <span className="label">Check-In Time</span>
                  <span className="value highlight">{formatTime(todayData.record?.check_in_at)}</span>
                </div>
                <div className="session-detail-row">
                  <span className="label">Check-Out Time</span>
                  <span className="value">
                    {todayData.record?.check_out_at ? formatTime(todayData.record.check_out_at) : 'Not checked out yet'}
                  </span>
                </div>
                <div className="session-detail-row">
                  <span className="label">Attendance Status</span>
                  <span className={`status-tag ${todayData.record?.status}`}>
                    {todayData.record?.status?.toUpperCase()}
                  </span>
                </div>
                <div className="session-detail-row">
                  <span className="label">Check-In GPS</span>
                  <span className="value font-mono">
                    {todayData.record?.check_in_latitude?.toFixed(4)}, {todayData.record?.check_in_longitude?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Photo Evidence if present */}
              {todayData.record?.photo_url && (
                <div className="attendance-evidence-box">
                  <span className="evidence-label">Verification Photo Evidence:</span>
                  <img
                    src={todayData.record.photo_url}
                    alt="Attendance selfie"
                    className="evidence-photo-thumb"
                    onClick={() => setPreviewPhotoUrl(todayData.record.photo_url)}
                  />
                </div>
              )}

              {/* Check-Out Action Button */}
              {!todayData.record?.check_out_at && (
                <div className="checkout-action-box">
                  <button
                    type="button"
                    className="primary-button checkout-btn"
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Recording Check-out...' : '⏱️ Complete Check-Out'}
                  </button>
                  <p className="action-hint">
                    Ready to leave? Click check-out to record your departure timestamp.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* User has not checked in yet */
            <div className="checkin-flow-container">
              {/* Step 1: GPS Verification */}
              <div className="flow-step">
                <div className="step-header">
                  <span className="step-num">1</span>
                  <h3>Verify GPS Location</h3>
                </div>

                <div className="step-content">
                  <div className="office-selector-row">
                    <label htmlFor="office-select">Select Target Office:</label>
                    <select
                      id="office-select"
                      className="office-dropdown"
                      value={selectedOfficeId}
                      onChange={handleOfficeChange}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} (Radius: {loc.allowed_radius_meters}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="location-action-row">
                    <button
                      type="button"
                      className="secondary-button locate-btn"
                      onClick={requestLocation}
                      disabled={gpsLoading}
                    >
                      {gpsLoading ? 'Acquiring GPS...' : '📍 Detect My Current Location'}
                    </button>

                    {gpsAccuracy && (
                      <span className="accuracy-pill">
                        Accuracy: ±{gpsAccuracy}m
                      </span>
                    )}
                  </div>

                  {gpsError && (
                    <div className="gps-alert error">
                      <span>⚠️ {gpsError}</span>
                    </div>
                  )}

                  {userCoords && (
                    <div className="coords-display">
                      <span>Latitude: <strong>{userCoords.latitude.toFixed(6)}</strong></span>
                      <span>Longitude: <strong>{userCoords.longitude.toFixed(6)}</strong></span>
                    </div>
                  )}

                  {geofenceLoading && (
                    <div className="geofence-loading">Verifying distance with server...</div>
                  )}

                  {geofenceStatus && !geofenceLoading && (
                    <div
                      className={`geofence-badge ${
                        geofenceStatus.is_within_radius ? 'success' : 'failure'
                      }`}
                    >
                      <span className="geofence-icon">
                        {geofenceStatus.is_within_radius ? '✓' : '✗'}
                      </span>
                      <div>
                        <strong>
                          {geofenceStatus.is_within_radius
                            ? 'Inside Authorized Range'
                            : 'Outside Authorized Range'}
                        </strong>
                        <p>
                          Distance: {geofenceStatus.distance_meters}m from {geofenceStatus.office_name} (Max allowed: {geofenceStatus.allowed_radius_meters}m)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Live Camera Capture */}
              <div className="flow-step">
                <div className="step-header">
                  <span className="step-num">2</span>
                  <h3>Capture Live Photo Verification</h3>
                </div>

                <div className="step-content">
                  <CameraCapture
                    photoData={capturedPhoto}
                    onPhotoCaptured={setCapturedPhoto}
                  />
                </div>
              </div>

              {/* Step 3: Check-in Submit */}
              <div className="flow-step final-step">
                <button
                  type="button"
                  className="primary-button final-checkin-btn"
                  onClick={handleCheckIn}
                  disabled={actionLoading || !userCoords || !capturedPhoto}
                >
                  {actionLoading ? 'Verifying & Submitting Check-In...' : '✓ Confirm & Check In Now'}
                </button>
                {(!userCoords || !capturedPhoto) && (
                  <p className="requirements-note">
                    * Both GPS location and live photo are required to submit attendance.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Attendance Overview & Guidelines */}
        <div className="dashboard-side-col">
          <div className="dashboard-card info-card">
            <h3>Geofence Rules & Security</h3>
            <ul className="info-bullets">
              <li>
                <span className="bullet-icon">◎</span>
                <div>
                  <strong>Server-Side Distance Math:</strong> Your device coordinates are verified on the backend using the Haversine great-circle formula.
                </div>
              </li>
              <li>
                <span className="bullet-icon">📸</span>
                <div>
                  <strong>Live Camera Only:</strong> Arbitrary photo uploads are disallowed. Direct webcam capture prevents proxy attendance.
                </div>
              </li>
              <li>
                <span className="bullet-icon">🛡️</span>
                <div>
                  <strong>Immutable Audit Log:</strong> Every check-in and check-out generates a cryptographic audit trail in PostgreSQL.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Attendance History Section */}
      <section className="dashboard-card history-card">
        <div className="history-header">
          <div>
            <span className="card-badge">ATTENDANCE LOG</span>
            <h2>My Attendance History</h2>
          </div>

          <div className="history-filters">
            <label>
              From:
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  loadHistory(e.target.value, endDate)
                }}
              />
            </label>
            <label>
              To:
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  loadHistory(startDate, e.target.value)
                }}
              />
            </label>
            {(startDate || endDate) && (
              <button
                type="button"
                className="secondary-button clear-btn"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  loadHistory('', '')
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {historyLoading ? (
          <div className="loading-state">Loading attendance history...</div>
        ) : history.length === 0 ? (
          <div className="empty-history">
            <span className="empty-icon">📅</span>
            <p>No attendance records found for the selected period.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Office</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                  <th>Coordinates</th>
                  <th>Photo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.check_in_at)}</td>
                    <td>{item.office_name}</td>
                    <td className="highlight">{formatTime(item.check_in_at)}</td>
                    <td>{formatTime(item.check_out_at)}</td>
                    <td>
                      <span className={`status-tag ${item.status}`}>
                        {item.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      {item.check_in_latitude?.toFixed(4)}, {item.check_in_longitude?.toFixed(4)}
                    </td>
                    <td>
                      {item.photo_url ? (
                        <button
                          type="button"
                          className="view-photo-btn"
                          onClick={() => setPreviewPhotoUrl(item.photo_url)}
                        >
                          👁️ View
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Photo Modal Preview */}
      {previewPhotoUrl && (
        <div className="modal-backdrop" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Attendance Verification Photo</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewPhotoUrl(null)}
              >
                ✕
              </button>
            </div>
            <img src={previewPhotoUrl} alt="Attendance verification proof" className="modal-img" />
          </div>
        </div>
      )}
    </div>
  )
}
