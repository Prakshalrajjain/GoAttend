const API_BASE_URL = 'http://127.0.0.1:8000'

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`)

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`)
  }

  return response.json()
}

export async function getOfficeLocations() {
  const response = await fetch(`${API_BASE_URL}/api/locations`)

  if (!response.ok) {
    throw new Error(`Failed to load locations: ${response.status}`)
  }

  return response.json()
}