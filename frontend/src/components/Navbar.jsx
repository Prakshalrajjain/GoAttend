import BackendStatus from './BackendStatus.jsx'

export default function Navbar({ user, activeSection, onNavigate, onLogout }) {
  return (
    <header className="navbar">
      <div className="brand" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
        <span className="brand-icon">G</span>
        <span>GeoAttend</span>
      </div>

      <div className="navbar-center">
        <BackendStatus />
      </div>

      <nav className="nav-actions">
        {user ? (
          <>
            <button
              type="button"
              className={`nav-link-btn ${activeSection === 'employee-dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('employee-dashboard')}
            >
              My Attendance
            </button>

            {user.role === 'admin' && (
              <button
                type="button"
                className={`nav-link-btn admin-link ${activeSection === 'admin-dashboard' ? 'active' : ''}`}
                onClick={() => onNavigate('admin-dashboard')}
              >
                🛡️ Admin Console
              </button>
            )}

            <div className="nav-user-pill">
              <span className="nav-user-name">{user.full_name?.split(' ')[0]}</span>
              <span className="nav-role-badge">{user.role}</span>
            </div>

            <button
              type="button"
              className="secondary-button logout-btn"
              onClick={onLogout}
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="nav-link-btn"
              onClick={() => onNavigate('features')}
            >
              Features
            </button>

            <button
              type="button"
              className="primary-button login-nav-btn"
              onClick={() => onNavigate('login')}
            >
              Sign In
            </button>
          </>
        )}
      </nav>
    </header>
  )
}
