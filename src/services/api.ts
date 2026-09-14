import axios from 'axios'

const TOKEN_KEY = 'transmassa_token'
const USER_KEY = 'transmassa_user'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/backend',
  timeout: 30000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (
      error?.response?.status === 401 &&
      !String(error.config?.url || '').includes('/api/auth/login')
    ) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new Event('transmassa-auth-expired'))
    }

    return Promise.reject(error)
  }
)

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function login(email, password) {
  const { data } = await api.post('/api/auth/login', {
    username: email,
    password,
  })

  saveSession(data)
  return data
}

export async function me() {
  return (await api.get('/api/auth/me')).data
}

export async function overview() {
  return (await api.get('/api/tv/overview')).data
}

export async function fleetGroups() {
  return (await api.get('/api/fleet-groups')).data
}

export async function setActiveGroup(groupId) {
  return (await api.put('/api/preferences/active-group', { groupId })).data
}

export async function manifestDetail(id) {
  return (await api.get(`/api/tv/manifest/${encodeURIComponent(id)}`)).data
}

export async function mirrorSummary() {
  return (await api.get('/api/mirror/summary')).data
}

export async function mirrorRecords(type, params = {}) {
  return (
    await api.get(`/api/mirror/records/${encodeURIComponent(type)}`, { params })
  ).data
}

export async function mirrorVehicle(plate) {
  return (
    await api.get(`/api/mirror/vehicle/${encodeURIComponent(plate)}`)
  ).data
}

export async function openServiceOrders() {
  return (await api.get('/api/history/service-orders')).data
}
