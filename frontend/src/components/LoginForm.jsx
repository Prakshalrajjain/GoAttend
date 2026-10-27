import { useState } from 'react'
import { loginUser, registerUser } from '../services/api.js'

export default function LoginForm({ onBack, onLoginSuccess }) {
  const [mode, setMode] = useState('authority') // 'authority' | 'login' | 'register'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('prakshalraj111@gmail.com')
  const [password, setPassword] = useState('12345678')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  function handleSwitchMode(newMode) {
    setMode(newMode)
    setError('')
    setSuccessMessage('')
    if (newMode === 'authority') {
      setEmail('prakshalraj111@gmail.com')
      setPassword('12345678')
    } else if (newMode === 'login') {
      setEmail('')
      setPassword('')
    } else if (newMode === 'register') {
      setEmail('')
      setPassword('')
      setFullName('')
    }
  }

  function handleFillAdminCredentials() {
    setEmail('prakshalraj111@gmail.com')
    setPassword('12345678')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      if (mode === 'login' || mode === 'authority') {
        const result = await loginUser(email, password)
        setSuccessMessage(`Login successful as ${result.employee.role.toUpperCase()}! Redirecting...`)
        if (onLoginSuccess) {
          onLoginSuccess(result.employee)
        }
      } else if (mode === 'register') {
        await registerUser(fullName, email, password)
        setSuccessMessage('Account registered successfully! Signing in...')
        const result = await loginUser(email, password)
        if (onLoginSuccess) {
          onLoginSuccess(result.employee)
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message || 'Authentication request failed. Please check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="login-panel">
      {/* Mode Switcher Tabs */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${mode === 'authority' ? 'active' : ''}`}
          onClick={() => handleSwitchMode('authority')}
          style={mode === 'authority' ? { color: '#fbbf24', background: '#35250c' } : {}}
        >
          🛡️ Authority Portal
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => handleSwitchMode('login')}
        >
          Employee Sign In
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => handleSwitchMode('register')}
        >
          Register New Staff
        </button>
      </div>

      <p className="eyebrow">
        {mode === 'authority' && 'ADMINISTRATIVE ACCESS'}
        {mode === 'login' && 'EMPLOYEE LOGIN'}
        {mode === 'register' && 'NEW ACCOUNT REGISTRATION'}
      </p>

      <h1>
        {mode === 'authority' && (
          <>
            Authority <span>Admin Panel.</span>
          </>
        )}
        {mode === 'login' && (
          <>
            Sign in to <span>GeoAttend.</span>
          </>
        )}
        {mode === 'register' && (
          <>
            Register your <span>profile.</span>
          </>
        )}
      </h1>

      <p className="description">
        {mode === 'authority' &&
          'Sign in with your administrative account to view all staff registrations, track real-time attendance with GPS coordinates, inspect verification photos, and manage office locations.'}
        {mode === 'login' &&
          'Sign in with your employee email to access your attendance workspace, verify location, and capture check-in photos.'}
        {mode === 'register' &&
          'Create a new employee profile with full name, email, and password.'}
      </p>

      {/* Authority quick credentials card */}
      {mode === 'authority' && (
        <div
          style={{
            background: '#191b16',
            border: '1px solid #f59e0b50',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '18px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: '#fbbf24' }}>🔑 Primary Authority Admin:</strong>
            <button
              type="button"
              onClick={handleFillAdminCredentials}
              style={{
                background: '#f59e0b20',
                border: '1px solid #f59e0b',
                color: '#fbbf24',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              ⚡ Auto-Fill My Admin Credentials
            </button>
          </div>
          <div style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
            <div>Admin Email: <code style={{ color: '#71e0b0' }}>prakshalraj111@gmail.com</code></div>
            <div>Password: <code style={{ color: '#71e0b0' }}>12345678</code></div>
          </div>
        </div>
      )}

      {error && (
        <div className="auth-alert error" role="alert">
          <span>⚠️ {error}</span>
        </div>
      )}

      {successMessage && (
        <div className="auth-alert success" role="status">
          <span>✓ {successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form">
        {mode === 'register' && (
          <div>
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              placeholder="e.g. Aditi Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            maxLength={128}
            disabled={loading}
          />
        </div>

        <button
          className="primary-button submit-btn"
          type="submit"
          disabled={loading}
          style={
            mode === 'authority'
              ? { background: '#f59e0b', borderColor: '#f59e0b', color: '#1a1505' }
              : {}
          }
        >
          {loading ? (
            <span className="spinner-text">Authenticating...</span>
          ) : mode === 'authority' ? (
            'Enter Authority Admin Console →'
          ) : mode === 'login' ? (
            'Sign In to Workspace'
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="auth-footer-actions">
        <button
          className="secondary-button back-button"
          type="button"
          onClick={onBack}
          disabled={loading}
        >
          ← Back to Home
        </button>
      </div>
    </section>
  )
}
