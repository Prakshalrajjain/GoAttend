
import { useEffect, useState } from 'react'
import { getBackendHealth } from '../services/api.js'

function BackendStatus() {
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('Checking backend connection...')

  useEffect(() => {
    let active = true

    getBackendHealth()
      .then((data) => {
        if (active) {
          setStatus(data.status === 'healthy' ? 'connected' : 'error')
          setMessage(
            data.status === 'healthy'
              ? 'Backend connected'
              : 'Backend returned an unexpected status',
          )
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error')
          setMessage('Backend unavailable. Check that FastAPI is running.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className={`backend-status ${status}`} role="status">
      <span className="backend-status-dot"></span>
      {message}
    </div>
  )
}

export default BackendStatus
