import { useEffect, useState } from 'react'
import {
  createOfficeLocation,
  deleteOfficeLocation,
  getAdminAnalytics,
  getAdminAttendance,
  getAdminEmployees,
  getExportCsvUrl,
  getOfficeLocations,
  resolvePhotoUrl,
  updateEmployeeRole,
} from '../services/api.js'
import PlotlyChart from './PlotlyChart.jsx'

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('attendance') // 'attendance' | 'employees' | 'offices' | 'analytics'

  // Analytics state
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Attendance Monitor state
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [previewModalData, setPreviewModalData] = useState(null)

  // Office Locations state
  const [offices, setOffices] = useState([])
  const [officesLoading, setOfficesLoading] = useState(false)
  const [newOfficeName, setNewOfficeName] = useState('')
  const [newOfficeLat, setNewOfficeLat] = useState('')
  const [newOfficeLon, setNewOfficeLon] = useState('')
  const [newOfficeRadius, setNewOfficeRadius] = useState('100')
  const [officeFormError, setOfficeFormError] = useState('')
  const [officeFormSuccess, setOfficeFormSuccess] = useState('')

  // Employee Management state
  const [employees, setEmployees] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [employeeActionMsg, setEmployeeActionMsg] = useState('')

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics()
    if (activeTab === 'attendance') loadAttendance()
    if (activeTab === 'offices') loadOffices()
    if (activeTab === 'employees') loadEmployees()
  }, [activeTab])

  // Load analytics
  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const data = await getAdminAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Load attendance
  async function loadAttendance() {
    setAttendanceLoading(true)
    try {
      const data = await getAdminAttendance({
        status: statusFilter,
        startDate,
        endDate,
      })
      setAttendanceRecords(data)
    } catch (err) {
      console.error('Failed to load attendance:', err)
    } finally {
      setAttendanceLoading(false)
    }
  }

  // Load offices
  async function loadOffices() {
    setOfficesLoading(true)
    try {
      const data = await getOfficeLocations()
      setOffices(data)
    } catch (err) {
      console.error('Failed to load offices:', err)
    } finally {
      setOfficesLoading(false)
    }
  }

  // Load employees
  async function loadEmployees() {
    setEmployeesLoading(true)
    try {
      const data = await getAdminEmployees()
      setEmployees(data)
    } catch (err) {
      console.error('Failed to load employees:', err)
    } finally {
      setEmployeesLoading(false)
    }
  }

  // Add new office
  async function handleAddOffice(e) {
    e.preventDefault()
    setOfficeFormError('')
    setOfficeFormSuccess('')

    const lat = parseFloat(newOfficeLat)
    const lon = parseFloat(newOfficeLon)
    const radius = parseInt(newOfficeRadius, 10)

    if (!newOfficeName.trim() || isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      setOfficeFormError('Please fill out all fields with valid numbers.')
      return
    }

    try {
      await createOfficeLocation({
        name: newOfficeName.trim(),
        latitude: lat,
        longitude: lon,
        allowed_radius_meters: radius,
        is_active: true,
      })
      setOfficeFormSuccess(`Office '${newOfficeName}' created successfully!`)
      setNewOfficeName('')
      setNewOfficeLat('')
      setNewOfficeLon('')
      setNewOfficeRadius('100')
      await loadOffices()
    } catch (err) {
      setOfficeFormError(err.message || 'Failed to create office.')
    }
  }

  // Toggle office status
  async function handleDeactivateOffice(id) {
    if (!window.confirm('Are you sure you want to deactivate this office location?')) return
    try {
      await deleteOfficeLocation(id)
      await loadOffices()
    } catch (err) {
      alert(err.message || 'Failed to deactivate office.')
    }
  }

  // Toggle employee role
  async function handleToggleRole(employee) {
    const targetRole = employee.role === 'admin' ? 'employee' : 'admin'
    if (
      !window.confirm(
        `Are you sure you want to change ${employee.full_name}'s role to ${targetRole}?`,
      )
    ) {
      return
    }

    setEmployeeActionMsg('')
    try {
      const res = await updateEmployeeRole(employee.id, targetRole)
      setEmployeeActionMsg(res.message)
      await loadEmployees()
    } catch (err) {
      alert(err.message || 'Failed to update employee role.')
    }
  }

  // CSV export handler
  function handleExportCsv() {
    const url = getExportCsvUrl(startDate, endDate)
    window.open(url, '_blank')
  }

  function formatTime(isoString) {
    if (!isoString) return '—'
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function formatDate(isoString) {
    if (!isoString) return '—'
    return new Date(isoString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="dashboard-container admin-console">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">AUTHORITY CONTROL PANEL — REAL-TIME MONITORING</span>
          <h1>Authority <span>Admin Command Center</span></h1>
          <p className="description">
            Live organization oversight: view all staff registrations, inspect attendance records with exact GPS coordinates and photo evidence, configure geofences, and export data.
          </p>
        </div>

        <div className="admin-badge-card">
          <span className="shield-icon">🛡️</span>
          <div>
            <strong>System Authority</strong>
            <span className="admin-email">{user?.email}</span>
            <span className="role-chip">ADMIN ACCESS</span>
          </div>
        </div>
      </header>

      {/* Admin Tabs */}
      <nav className="admin-nav-tabs">
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          📋 Real-Time Attendance with GPS
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          👥 All Registrations (Staff Directory)
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'offices' ? 'active' : ''}`}
          onClick={() => setActiveTab('offices')}
        >
          🏢 Office Geofences & Radius
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Analytics & Plotly Trends
        </button>
      </nav>

      {/* ---------------- TAB 1: ANALYTICS ---------------- */}
      {activeTab === 'analytics' && (
        <section className="admin-section">
          {analyticsLoading || !analytics ? (
            <div className="loading-state">Loading attendance analytics...</div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">TOTAL CHECK-INS</span>
                  <strong className="stat-value">{analytics.overview.total_records}</strong>
                  <span className="stat-sub">Lifetime verified sessions</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">PRESENT ON TIME</span>
                  <strong className="stat-value text-mint">{analytics.overview.present_count}</strong>
                  <span className="stat-sub">Normal check-ins</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">LATE CHECK-INS</span>
                  <strong className="stat-value text-amber">{analytics.overview.late_count}</strong>
                  <span className="stat-sub">Recorded as late</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">UNIQUE EMPLOYEES</span>
                  <strong className="stat-value">{analytics.overview.unique_employees}</strong>
                  <span className="stat-sub">Active members</span>
                </div>
              </div>

              {/* Plotly Charts Grid */}
              <div className="charts-grid">
                {/* Daily Trend Chart */}
                <div className="dashboard-card chart-card">
                  <h3>Daily Attendance Trend (Last 14 Days)</h3>
                  {analytics.daily_trend?.length > 0 ? (
                    <PlotlyChart
                      data={[
                        {
                          x: analytics.daily_trend.map((d) => d.date),
                          y: analytics.daily_trend.map((d) => d.count),
                          type: 'bar',
                          marker: {
                            color: '#71e0b0',
                            line: { color: '#4cb889', width: 1.5 },
                          },
                          name: 'Check-ins',
                        },
                      ]}
                      layout={{
                        title: { text: 'Verified Daily Volume', font: { color: '#a8b8b4', size: 14 } },
                        xaxis: { title: 'Date', gridcolor: '#ffffff12', zerolinecolor: '#ffffff12' },
                        yaxis: { title: 'Attendance Count', gridcolor: '#ffffff12', zerolinecolor: '#ffffff12' },
                      }}
                    />
                  ) : (
                    <p className="no-data-msg">No attendance data recorded in the last 14 days.</p>
                  )}
                </div>

                {/* Status Breakdown Donut Chart */}
                <div className="dashboard-card chart-card">
                  <h3>Attendance Status Distribution</h3>
                  {analytics.overview.total_records > 0 ? (
                    <PlotlyChart
                      data={[
                        {
                          values: [
                            analytics.overview.present_count,
                            analytics.overview.late_count,
                            analytics.overview.rejected_count,
                          ],
                          labels: ['Present', 'Late', 'Rejected'],
                          type: 'pie',
                          hole: 0.45,
                          marker: {
                            colors: ['#71e0b0', '#f59e0b', '#ef4444'],
                          },
                        },
                      ]}
                      layout={{
                        title: { text: 'Status Composition', font: { color: '#a8b8b4', size: 14 } },
                        showlegend: true,
                        legend: { orientation: 'h', y: -0.1 },
                      }}
                    />
                  ) : (
                    <p className="no-data-msg">No attendance sessions to analyze.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- TAB 2: ATTENDANCE MONITOR ---------------- */}
      {activeTab === 'attendance' && (
        <section className="admin-section">
          <div className="monitor-controls-card dashboard-card">
            <div className="filters-row">
              <div>
                <label>Status Filter:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                  }}
                  className="admin-select"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present Only</option>
                  <option value="late">Late Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>
              </div>

              <div>
                <label>From Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="admin-date-input"
                />
              </div>

              <div>
                <label>To Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="admin-date-input"
                />
              </div>

              <div className="filter-actions">
                <button
                  type="button"
                  className="primary-button filter-btn"
                  onClick={loadAttendance}
                >
                  🔍 Filter Records
                </button>
                <button
                  type="button"
                  className="secondary-button export-btn"
                  onClick={handleExportCsv}
                >
                  📥 Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-card table-card">
            {attendanceLoading ? (
              <div className="loading-state">Loading attendance records...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="empty-history">
                <p>No attendance records match the selected filter criteria.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="attendance-table admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee</th>
                      <th>Office</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Status</th>
                      <th>Coordinates</th>
                      <th>Evidence (Dual Frame)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((r) => (
                      <tr key={r.id}>
                        <td>#{r.id}</td>
                        <td>
                          <strong>{r.employee_name}</strong>
                          <span className="table-subtext">{r.employee_email}</span>
                        </td>
                        <td>{r.office_name}</td>
                        <td className="highlight">{formatTime(r.check_in_at)}</td>
                        <td>{formatTime(r.check_out_at)}</td>
                        <td>
                          <span className={`status-tag ${r.status}`}>
                            {r.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="font-mono text-xs">
                          {r.check_in_latitude?.toFixed(4)}, {r.check_in_longitude?.toFixed(4)}
                        </td>
                        <td>
                          {r.photo_url || r.live_frame_url ? (
                            <div className="table-proofs-cell">
                              <img
                                src={resolvePhotoUrl(r.photo_url || r.live_frame_url)}
                                alt={r.employee_name}
                                className="table-photo-thumb"
                                onClick={() =>
                                  setPreviewModalData({
                                    photoUrl: r.photo_url,
                                    liveFrameUrl: r.live_frame_url,
                                    title: `Dual Verification Proofs — ${r.employee_name}`,
                                  })
                                }
                                title="Click to view full proofs"
                              />
                              <button
                                type="button"
                                className="view-photo-btn"
                                onClick={() =>
                                  setPreviewModalData({
                                    photoUrl: r.photo_url,
                                    liveFrameUrl: r.live_frame_url,
                                    title: `Dual Verification Proofs — ${r.employee_name}`,
                                  })
                                }
                              >
                                👁️ 2 Proofs
                              </button>
                            </div>
                          ) : (
                            <span className="text-subtle">No Photo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------- TAB 3: OFFICE GEOFENCES ---------------- */}
      {activeTab === 'offices' && (
        <section className="admin-section">
          <div className="offices-layout-grid">
            {/* Create Office Form */}
            <div className="dashboard-card add-office-card">
              <h3>Add Authorized Office Location</h3>
              <p className="description">
                Employees can only record attendance when physically present inside the specified radius.
              </p>

              {officeFormError && (
                <div className="auth-alert error">
                  <span>⚠️ {officeFormError}</span>
                </div>
              )}
              {officeFormSuccess && (
                <div className="auth-alert success">
                  <span>✓ {officeFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddOffice} className="office-form">
                <div>
                  <label htmlFor="officeName">Office Name</label>
                  <input
                    id="officeName"
                    type="text"
                    placeholder="e.g. AI Innovation Center"
                    value={newOfficeName}
                    onChange={(e) => setNewOfficeName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div>
                    <label htmlFor="officeLat">Latitude</label>
                    <input
                      id="officeLat"
                      type="number"
                      step="any"
                      placeholder="e.g. 23.2599"
                      value={newOfficeLat}
                      onChange={(e) => setNewOfficeLat(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="officeLon">Longitude</label>
                    <input
                      id="officeLon"
                      type="number"
                      step="any"
                      placeholder="e.g. 77.4126"
                      value={newOfficeLon}
                      onChange={(e) => setNewOfficeLon(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="officeRadius">Allowed Radius (Metres)</label>
                  <input
                    id="officeRadius"
                    type="number"
                    min="10"
                    max="5000"
                    value={newOfficeRadius}
                    onChange={(e) => setNewOfficeRadius(e.target.value)}
                    required
                  />
                  <span className="input-hint">Standard recommended radius: 100 metres</span>
                </div>

                <button type="submit" className="primary-button create-office-btn">
                  ➕ Add Office Geofence
                </button>
              </form>
            </div>

            {/* Existing Offices Table */}
            <div className="dashboard-card office-list-card">
              <h3>Authorized Office Locations</h3>
              {officesLoading ? (
                <div className="loading-state">Loading office locations...</div>
              ) : (
                <div className="table-responsive">
                  <table className="attendance-table">
                    <thead>
                      <tr>
                        <th>Office Name</th>
                        <th>Coordinates</th>
                        <th>Allowed Radius</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offices.map((loc) => (
                        <tr key={loc.id}>
                          <td>
                            <strong>{loc.name}</strong>
                          </td>
                          <td className="font-mono text-xs">
                            {loc.latitude}, {loc.longitude}
                          </td>
                          <td>{loc.allowed_radius_meters} m</td>
                          <td>
                            <span className="status-tag present">ACTIVE</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="secondary-button delete-btn"
                              onClick={() => handleDeactivateOffice(loc.id)}
                            >
                              Deactivate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- TAB 4: EMPLOYEE DIRECTORY ---------------- */}
      {activeTab === 'employees' && (
        <section className="admin-section">
          {employeeActionMsg && (
            <div className="auth-alert success">
              <span>✓ {employeeActionMsg}</span>
            </div>
          )}

          <div className="dashboard-card table-card">
            <div className="card-top">
              <h3>Registered Organization Staff</h3>
              <button
                type="button"
                className="secondary-button refresh-btn"
                onClick={loadEmployees}
              >
                🔄 Refresh
              </button>
            </div>

            {employeesLoading ? (
              <div className="loading-state">Loading employees...</div>
            ) : (
              <div className="table-responsive">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>System Role</th>
                      <th>Joined Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td>#{emp.id}</td>
                        <td>
                          <strong>{emp.full_name}</strong>
                        </td>
                        <td>{emp.email}</td>
                        <td>
                          <span
                            className={`role-tag ${
                              emp.role === 'admin' ? 'admin' : 'employee'
                            }`}
                          >
                            {emp.role?.toUpperCase()}
                          </span>
                        </td>
                        <td>{formatDate(emp.created_at)}</td>
                        <td>
                          {emp.id === user?.id ? (
                            <span className="text-subtle">Current User</span>
                          ) : (
                            <button
                              type="button"
                              className="secondary-button role-toggle-btn"
                              onClick={() => handleToggleRole(emp)}
                            >
                              {emp.role === 'admin'
                                ? 'Demote to Employee'
                                : 'Promote to Admin'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Dual Photo Modal */}
      {previewModalData && (
        <div className="modal-backdrop" onClick={() => setPreviewModalData(null)}>
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewModalData.title || 'Verification Photo Proofs'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-dual-proofs-grid">
              <div className="modal-proof-item">
                <span className="proof-tag tag-primary">📸 Proof 1: User-Clicked Selfie</span>
                <img
                  src={resolvePhotoUrl(previewModalData.photoUrl)}
                  alt="User clicked verification selfie"
                  className="modal-img"
                />
                <span className="proof-sub">Triggered explicitly by employee</span>
                {previewModalData.photoUrl && (
                  <a
                    href={resolvePhotoUrl(previewModalData.photoUrl)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: '#38bdf8', textAlign: 'center', marginTop: '6px', textDecoration: 'underline' }}
                  >
                    Open Full Image ↗
                  </a>
                )}
              </div>

              <div className="modal-proof-item">
                <span className="proof-tag tag-secondary">🎥 Proof 2: Live Video Stream Frame</span>
                <img
                  src={resolvePhotoUrl(previewModalData.liveFrameUrl || previewModalData.photoUrl)}
                  alt="Automated frame from live video feed"
                  className="modal-img"
                />
                <span className="proof-sub">Automated live video sensor capture</span>
                {(previewModalData.liveFrameUrl || previewModalData.photoUrl) && (
                  <a
                    href={resolvePhotoUrl(previewModalData.liveFrameUrl || previewModalData.photoUrl)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', color: '#38bdf8', textAlign: 'center', marginTop: '6px', textDecoration: 'underline' }}
                  >
                    Open Full Image ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
