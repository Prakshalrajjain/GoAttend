import { useEffect, useState } from 'react'
import { getOfficeLocations } from '../services/api.js'

export default function OfficeLocations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getOfficeLocations()
      .then(setLocations)
      .catch(() => setError('Could not load office locations.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="locations-wrapper">
        <p className="loading-state">Loading authorized office locations...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="locations-wrapper">
        <p className="auth-alert error">{error}</p>
      </div>
    )
  }

  return (
    <div className="locations-wrapper">
      <div className="locations-header">
        <span className="eyebrow">AUTHORIZED WORKSPACES</span>
        <h2>Active Office Locations & Geofences</h2>
        <p className="description">
          Attendance check-ins are restricted to these authorized physical locations.
        </p>
      </div>

      {locations.length === 0 ? (
        <p className="empty-history">No office locations configured yet.</p>
      ) : (
        <div className="locations-grid">
          {locations.map((location) => (
            <article key={location.id} className="location-item-card">
              <div className="loc-card-header">
                <span className="loc-pin">📍</span>
                <h3>{location.name}</h3>
              </div>

              <div className="loc-card-body">
                <div className="loc-info-row">
                  <span className="label">Latitude</span>
                  <span className="value font-mono">{location.latitude}</span>
                </div>
                <div className="loc-info-row">
                  <span className="label">Longitude</span>
                  <span className="value font-mono">{location.longitude}</span>
                </div>
                <div className="loc-info-row">
                  <span className="label">Geofence Radius</span>
                  <span className="value highlight">{location.allowed_radius_meters} metres</span>
                </div>
              </div>

              <div className="loc-card-footer">
                <span className="active-status-badge">● Active Geofence</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
