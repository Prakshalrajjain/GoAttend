
import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar.jsx'
import FeatureList from './components/FeatureList.jsx'
import LocationCard from './components/LocationCard.jsx'
import LoginForm from './components/LoginForm.jsx'
import BackendStatus from './components/BackendStatus.jsx'
import OfficeLocations from './components/OfficeLocations.jsx'

function App() {
  const [activeSection, setActiveSection] = useState('home')

  function handleGetStarted() {
    setActiveSection('login')
  }

  function handleLearnMore() {
    setActiveSection('features')
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="brand">
          <span className="brand-icon">G</span>
          <span>GeoAttend</span>
        </div>

        <span className="status">Attendance made smarter</span>
      </header>

      <main className="hero">
        <div className="hero-content">
          {activeSection === 'home' && (
            <>
              <BackendStatus />

              <p className="eyebrow">
                SMART ATTENDANCE MANAGEMENT
              </p>

              <h1>
                Attendance that
                <br />
                <span>knows your location.</span>
              </h1>

              <p className="description">
                A smarter attendance experience using location
                verification, photo capture, and secure digital records.
              </p>

              <div className="actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleGetStarted}
                >
                  Get Started
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleLearnMore}
                >
                  Learn More
                </button>
              </div>
            </>
          )}

          {activeSection === 'login' && (
            <LoginForm
              onBack={() => setActiveSection('home')}
            />
          )}

          {activeSection === 'features' && (
            <section>
              <p className="eyebrow">HOW GEOATTEND WORKS</p>

              <h1>Verify. Record. Review.</h1>

              <p className="description">
                GeoAttend is designed to combine location verification,
                photo evidence, attendance records, and analytics.
              </p>

              <button
                className="secondary-button"
                type="button"
                onClick={() => setActiveSection('home')}
              >
                Back to Home
              </button>
            </section>
          )}

          <div className="features">
            <div className="feature">
              <span className="feature-icon">◎</span>
              <span>GPS Verification</span>
            </div>

            <div className="feature">
              <span className="feature-icon">▣</span>
              <span>Photo Verification</span>
            </div>

            <div className="feature">
              <span className="feature-icon">✓</span>
              <span>Secure Records</span>
            </div>
          </div>
        </div>

        <div className="visual">
          <div className="visual-card">
            <div className="visual-top">
              <span className="live-dot"></span>
              LOCATION STATUS
            </div>

            <div className="map-circle">
              <div className="map-ring ring-one"></div>
              <div className="map-ring ring-two"></div>
              <div className="map-pin">●</div>
            </div>

            <h2>Location-aware attendance</h2>
            <p>Designed for verified check-ins</p>

            <div className="visual-bottom">
              <span>GPS</span>
              <span>PHOTO</span>
              <span>RECORD</span>
            </div>
          </div>
        </div>

        {activeSection === 'home' && (
          <OfficeLocations />
        )}
      </main>

      <footer>
        GeoAttend · GPS-Based Smart Attendance Management
      </footer>
    </div>
  )
}

export default App
