
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

  if (loading) return <p>Loading office locations...</p>
  if (error) return <p>{error}</p>

  return (
    <section>
      <h2>Office Locations</h2>

      {locations.length === 0 ? (
        <p>No office locations have been added yet.</p>
      ) : (
        locations.map((location) => (
          <article key={location.id}>
            <h3>{location.name}</h3>
            <p>Latitude: {location.latitude}</p>
            <p>Longitude: {location.longitude}</p>
            <p>Allowed radius: {location.allowed_radius_meters} metres</p>
          </article>
        ))
      )}
    </section>
  )
}
