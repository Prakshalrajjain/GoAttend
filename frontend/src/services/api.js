const API_BASE_URL = 'http://127.0.0.1:8000'

// Token management in localStorage
export function getAuthToken() {
  return localStorage.getItem('geoattend_token')
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('geoattend_token', token)
  } else {
    localStorage.removeItem('geoattend_token')
  }
}

export function getStoredUser() {
  const userStr = localStorage.getItem('geoattend_user')
  try {
    return userStr ? JSON.parse(userStr) : null
  } catch {
    return null
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('geoattend_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('geoattend_user')
  }
}

export function clearAuth() {
  localStorage.removeItem('geoattend_token')
  localStorage.removeItem('geoattend_user')
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const token = getAuthToken()
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle 401 Unauthorized globally
  if (response.status === 401 && endpoint !== '/api/auth/login') {
    // Only clear if this was an authenticated endpoint
    // clearAuth()
  }

  // Parse response
  let data = null
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((e) => e.msg || e.message).join(', ')
      } else if (data.message) {
        errorMsg = data.message
      }
    }
    const error = new Error(errorMsg)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

// Health APIs
export async function getBackendHealth() {
  return request('/api/health')
}

export async function getDatabaseHealth() {
  return request('/api/health/database')
}

// Authentication APIs
export async function loginUser(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (data.access_token) {
    setAuthToken(data.access_token)
    setStoredUser(data.employee)
  }
  return data
}

export async function registerUser(fullName, email, password) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
    }),
  })
}

export async function setupFirstAdmin(fullName, email, password) {
  return request('/api/auth/setup-admin', {
    method: 'POST',
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
    }),
  })
}

export async function getMe() {
  return request('/api/auth/me')
}

// Office Locations APIs
export async function getOfficeLocations() {
  return request('/api/locations')
}

export async function createOfficeLocation(locationData) {
  return request('/api/locations', {
    method: 'POST',
    body: JSON.stringify(locationData),
  })
}

export async function updateOfficeLocation(id, locationData) {
  return request(`/api/locations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(locationData),
  })
}

export async function deleteOfficeLocation(id) {
  return request(`/api/locations/${id}`, {
    method: 'DELETE',
  })
}

// Geofence & Attendance APIs
export async function verifyGeofence(officeLocationId, latitude, longitude) {
  return request('/api/attendance/verify-location', {
    method: 'POST',
    body: JSON.stringify({
      office_location_id: officeLocationId,
      latitude,
      longitude,
    }),
  })
}

export async function checkInAttendance(officeLocationId, latitude, longitude, photoData) {
  return request('/api/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({
      office_location_id: officeLocationId,
      latitude,
      longitude,
      photo_data: photoData,
    }),
  })
}

export async function checkOutAttendance(latitude = null, longitude = null, attendanceId = null) {
  return request('/api/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({
      attendance_id: attendanceId,
      latitude,
      longitude,
    }),
  })
}

export async function getTodayAttendance() {
  return request('/api/attendance/today')
}

export async function getMyAttendanceHistory(startDate = '', endDate = '') {
  let query = ''
  const params = []
  if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`)
  if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`)
  if (params.length > 0) query = `?${params.join('&')}`
  return request(`/api/attendance/my-history${query}`)
}

export async function getAttendanceSummary() {
  return request('/api/attendance/summary')
}

// Administrator APIs
export async function getAdminEmployees() {
  return request('/api/admin/employees')
}

export async function updateEmployeeRole(employeeId, role) {
  return request(`/api/admin/employees/${employeeId}/role?role=${encodeURIComponent(role)}`, {
    method: 'PUT',
  })
}

export async function getAdminAttendance({ employeeId, officeId, status, startDate, endDate } = {}) {
  const params = []
  if (employeeId) params.push(`employee_id=${employeeId}`)
  if (officeId) params.push(`office_id=${officeId}`)
  if (status) params.push(`status_filter=${encodeURIComponent(status)}`)
  if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`)
  if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`)
  const query = params.length > 0 ? `?${params.join('&')}` : ''
  return request(`/api/admin/attendance${query}`)
}

export async function getAdminAnalytics() {
  return request('/api/admin/analytics')
}

export function getExportCsvUrl(startDate = '', endDate = '') {
  const token = getAuthToken()
  const params = []
  if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`)
  if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`)
  const query = params.length > 0 ? `?${params.join('&')}` : ''
  return `${API_BASE_URL}/api/admin/export${query}`
}

export { API_BASE_URL }