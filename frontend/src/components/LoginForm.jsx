import { useState } from 'react'
import { loginUser, registerUser, setupFirstAdmin } from '../services/api.js'

export default function LoginForm({ onBack, onLoginSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'admin-setup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await loginUser(email, password)
        setSuccessMessage('Login successful! Redirecting...')
        if (onLoginSuccess) {
          onLoginSuccess(result.employee)
        }
      } else if (mode === 'register') {
        await registerUser(fullName, email, password)
        setSuccessMessage('Account registered successfully! Signing in...')
        // Auto sign-in after registration
        const result = await loginUser(email, password)
        if (onLoginSuccess) {
          onLoginSuccess(result.employee)
        }
      } else if (mode === 'admin-setup') {
        await setupFirstAdmin(fullName, email, password)
        setSuccessMessage('Initial Administrator created! Signing in...')
        const result = await loginUser(email, password)
        if (onLoginSuccess) {
          onLoginSuccess(result.employee)
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err.message || 'Authentication request failed. Please check your credentials.')
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
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login')
            setError('')
            setSuccessMessage('')
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => {
            setMode('register')
            setError('')
            setSuccessMessage('')
          }}
        >
          Create Account
        </button>
      </div>

      <p className="eyebrow">
        {mode === 'login' && 'WELCOME BACK'}
        {mode === 'register' && 'JOIN GEOATTEND'}
        {mode === 'admin-setup' && 'SYSTEM INITIALIZATION'}
      </p>

      <h1>
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
        {mode === 'admin-setup' && (
          <>
            Setup Initial <span>Admin.</span>
          </>
        )}
      </h1>

      <p className="description">
        {mode === 'login' && 'Enter your verified employee credentials to access your attendance workspace.'}
        {mode === 'register' && 'Create your employee account to start recording location-verified attendance.'}
        {mode === 'admin-setup' && 'Initialize the primary administrator account for this system.'}
      </p>

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
        {(mode === 'register' || mode === 'admin-setup') && (
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Enter password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            disabled={loading}
          />
        </div>

        <button className="primary-button submit-btn" type="submit" disabled={loading}>
          {loading ? (
            <span className="spinner-text">Processing...</span>
          ) : mode === 'login' ? (
            'Sign In'
          ) : mode === 'register' ? (
            'Create Account'
          ) : (
            'Initialize Admin'
          )}
        </button>
      </form>

      <div className="auth-footer-actions">
        {mode !== 'admin-setup' ? (
          <button
            type="button"
            className="text-link-btn"
            onClick={() => {
              setMode('admin-setup')
              setError('')
              setSuccessMessage('')
            }}
          >
            Need to initialize the primary administrator?
          </button>
        ) : (
          <button
            type="button"
            className="text-link-btn"
            onClick={() => {
              setMode('login')
              setError('')
              setSuccessMessage('')
            }}
          >
            ← Back to normal sign in
          </button>
        )}

        <button
          className="secondary-button back-button"
          type="button"
          onClick={onBack}
          disabled={loading}
        >
          Back to Home
        </button>
      </div>
    </section>
  )
}
