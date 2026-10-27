import { useEffect, useState } from 'react'
import './App.css'
import Navbar from './components/Navbar.jsx'
import LocationCard from './components/LocationCard.jsx'
import LoginForm from './components/LoginForm.jsx'
import OfficeLocations from './components/OfficeLocations.jsx'
import EmployeeDashboard from './components/EmployeeDashboard.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import { clearAuth, getAuthToken, getMe, getStoredUser } from './services/api.js'

export default function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser())
  const [activeSection, setActiveSection] = useState(() => {
    const user = getStoredUser()
    if (user) {
      return user.role === 'admin' ? 'admin-dashboard' : 'employee-dashboard'
    }
    return 'home'
  })

  // Verify stored token on startup
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      getMe()
        .then((user) => {
          setCurrentUser(user)
        })
        .catch(() => {
          clearAuth()
          setCurrentUser(null)
          setActiveSection('home')
        })
    }
  }, [])

  function handleLoginSuccess(user) {
    setCurrentUser(user)
    if (user.role === 'admin') {
      setActiveSection('admin-dashboard')
    } else {
      setActiveSection('employee-dashboard')
    }
  }

  function handleLogout() {
    clearAuth()
    setCurrentUser(null)
    setActiveSection('home')
  }

  return (
    <div className="app">
      <Navbar
        user={currentUser}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {/* PUBLIC HOME LANDING */}
        {activeSection === 'home' && (
          <>
            <section className="hero">
              <div className="hero-content">
                <p className="eyebrow">SMART ATTENDANCE MANAGEMENT SYSTEM</p>
                <h1>
                  Attendance that
                  <br />
                  <span>knows your exact location.</span>
                </h1>

                <p className="description">
                  GeoAttend pairs browser Geolocation API with server-side Haversine distance
                  verification and live camera selfie capture to prevent proxy attendance and maintain
                  tamper-evident audit trails.
                </p>

                <div className="actions">
                  {currentUser ? (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        setActiveSection(
                          currentUser.role === 'admin'
                            ? 'admin-dashboard'
                            : 'employee-dashboard',
                        )
                      }
                    >
                      Open My Workspace →
                    </button>
                  ) : (
                    <>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => setActiveSection('login')}
                      >
                        Sign In / Register
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setActiveSection('features')}
                      >
                        Learn How It Works
                      </button>
                    </>
                  )}
                </div>

                <div className="features">
                  <div className="feature">
                    <span className="feature-icon">◎</span>
                    <span>GPS Geofencing (Haversine)</span>
                  </div>

                  <div className="feature">
                    <span className="feature-icon">▣</span>
                    <span>Live Camera Verification</span>
                  </div>

                  <div className="feature">
                    <span className="feature-icon">🛡️</span>
                    <span>Argon2 & JWT Security</span>
                  </div>
                </div>
              </div>

              <div className="visual">
                <LocationCard />
              </div>
            </section>

            <section className="home-locations-section">
              <OfficeLocations />
            </section>
          </>
        )}

        {/* AUTHENTICATION: LOGIN & REGISTER */}
        {activeSection === 'login' && (
          <div className="auth-view-wrapper">
            <LoginForm
              onBack={() => setActiveSection('home')}
              onLoginSuccess={handleLoginSuccess}
            />
          </div>
        )}

        {/* FEATURES OVERVIEW PAGE */}
        {activeSection === 'features' && (
          <section className="features-deepdive">
            <div className="features-header">
              <p className="eyebrow">SYSTEM ARCHITECTURE</p>
              <h1>Verify. Record. Review.</h1>
              <p className="description">
                GeoAttend combines real-time device sensor readings with strict server-side validation
                to create trustworthy digital attendance records.
              </p>
            </div>

            <div className="features-grid">
              <div className="feature-detail-card">
                <span className="detail-icon">📍</span>
                <h3>Haversine Geofencing</h3>
                <p>
                  Coordinates obtained from the browser Geolocation API are never trusted blindly.
                  The FastAPI server computes the spherical great-circle distance using the Haversine
                  formula and validates that the employee is physically located within the authorized office radius.
                </p>
              </div>

              <div className="feature-detail-card">
                <span className="detail-icon">📷</span>
                <h3>Live Selfie Capture</h3>
                <p>
                  Employees must capture a live photo directly from their camera stream. Pre-recorded or
                  arbitrary file uploads are disallowed, providing verifiable photographic evidence for every check-in.
                </p>
              </div>

              <div className="feature-detail-card">
                <span className="detail-icon">🔒</span>
                <h3>Argon2 & JWT Auth</h3>
                <p>
                  Passwords are automatically hashed using memory-hard Argon2id with unique salts.
                  Authenticated sessions utilize cryptographically signed JSON Web Tokens (JWT) with strict
                  expiry and role-based access control.
                </p>
              </div>

              <div className="feature-detail-card">
                <span className="detail-icon">📊</span>
                <h3>PostgreSQL Audit & Analytics</h3>
                <p>
                  Every check-in, check-out, and administrative modification is permanently logged with
                  timestamp, actor ID, and metadata in <code>attendance_audit</code>. Administrators enjoy real-time
                  Plotly charts and CSV exports.
                </p>
              </div>
            </div>

            <div className="features-back-action">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setActiveSection('home')}
              >
                ← Back to Home
              </button>
            </div>
          </section>
        )}

        {/* EMPLOYEE DASHBOARD */}
        {activeSection === 'employee-dashboard' && (
          currentUser ? (
            <EmployeeDashboard user={currentUser} onLogout={handleLogout} />
          ) : (
            <div className="auth-view-wrapper">
              <LoginForm
                onBack={() => setActiveSection('home')}
                onLoginSuccess={handleLoginSuccess}
              />
            </div>
          )
        )}

        {/* ADMIN DASHBOARD */}
        {activeSection === 'admin-dashboard' && (
          currentUser?.role === 'admin' ? (
            <AdminDashboard user={currentUser} />
          ) : (
            <div className="unauthorized-card">
              <h2>⚠️ Access Denied</h2>
              <p>You must be an administrator to access this area.</p>
              <button
                className="primary-button"
                onClick={() => setActiveSection('employee-dashboard')}
              >
                Return to My Attendance
              </button>
            </div>
          )
        )}
      </main>

      <footer>
        <div className="footer-content">
          <p>GeoAttend · GPS-Based Smart Attendance Management System</p>
          <span className="footer-meta">B.Tech Artificial Intelligence Project · FastAPI + React + PostgreSQL</span>
        </div>
      </footer>
    </div>
  )
}
