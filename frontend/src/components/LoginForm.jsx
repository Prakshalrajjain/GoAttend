
import { useState } from 'react'

function LoginForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setMessage('Please enter your email and password.')
      return
    }

    setMessage('Form validated. Backend authentication is not connected yet.')
  }

  return (
    <section className="login-panel">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Sign in to <span>GeoAttend.</span></h1>
      <p className="description">
        Access your attendance workspace securely.
      </p>

      <form onSubmit={handleSubmit} className="login-form">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setMessage('')
          }}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setMessage('')
          }}
          required
        />

        <button className="primary-button" type="submit">
          Sign In
        </button>

        {message && <p className="form-message" role="status">{message}</p>}
      </form>

      <button
        className="secondary-button back-button"
        type="button"
        onClick={onBack}
      >
        Back to Home
      </button>
    </section>
  )
}

export default LoginForm
