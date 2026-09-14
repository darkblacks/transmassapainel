import axios from 'axios'
import type {
  CouplingFleet,
  FleetCatalogItem,
  FleetGroup,
  MaintenanceDetail,
  ManifestDetail,
  Overview,
  Preference,
  Session,
  TrailerHistoryResponse,
  OsHistoryResponse,
  OsHistoryDetail,
  FleetMappingGroup,
  FleetMappingMember,
  FleetBaseCode,
  FleetMappingAuditEvent,
  FleetThirdParty,
  VehicleHistoryOs
} from '../types'
import { getVehicleAttention } from '../utils/operationalAttention'

export const TOKEN_KEY = 'transmassa_token'
const USER_KEY = 'transmassa_user'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/backend',
  timeout: 30000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401 && !String(error.config?.url || '').includes('/api/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new Event('transmassa-auth-expired'))
    }
    return Promise.reject(error)
  }
)

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser(): unknown {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(data: { token: string; user?: unknown }): void {
  localStorage.setItem(TOKEN_KEY, data.token)
  if (data.user !== undefined) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function login(email: string, password: string): Promise<Session & { token: string; user?: unknown }> {
  const data = (await api.post('/api/auth/login', { username: email, password })).data
  saveSession(data)
  return data
}

export async function me(): Promise<Session> {
  return (await api.get('/api/auth/me')).data
}

export async function getOverview(): Promise<Overview> {
  const data = (await api.get('/api/tv/overview')).data as Overview

  data.vehicles = (data.vehicles || []).map(vehicle => {
    const attention = getVehicleAttention(vehicle)

    return {
      ...vehicle,
      hasInconsistency: attention.needsAttention,
      inconsistencyReason: attention.reasons.join(' • ')
    }
  })

  return data
}

export async function getManifestDetail(id: number | string): Promise<ManifestDetail> {
  return (await api.get(`/api/tv/manifest/${encodeURIComponent(id)}`)).data
}

export async function getMaintenanceDetail(plate: string): Promise<MaintenanceDetail> {
  return (await api.get(`/api/tv/maintenance/${encodeURIComponent(plate)}`)).data
}

export async function getFleetCatalog(): Promise<FleetCatalogItem[]> {
  return (await api.get('/api/tv/fleet-catalog')).data
}

export async function getFleetGroups(): Promise<FleetGroup[]> {
  return (await api.get('/api/fleet-groups')).data
}

export async function createFleetGroup(data: { name: string; plates: string[] }): Promise<FleetGroup> {
  return (await api.post('/api/fleet-groups', data)).data
}

export async function updateFleetGroup(
  id: number,
  data: { name?: string; plates?: string[] }
): Promise<FleetGroup> {
  return (await api.put(`/api/fleet-groups/${id}`, data)).data
}

export async function setActiveFleetGroup(groupId: number): Promise<Preference> {
  return (await api.put('/api/preferences/active-group', { groupId })).data
}

export async function getPublicCouplingFleet(): Promise<CouplingFleet> {
  return (await api.get('/api/public/coupling-fleet')).data
}

export async function savePublicCoupling(plate: string, trailers: string[]): Promise<void> {
  await api.put(`/api/public/couplings/${encodeURIComponent(plate)}`, { trailers })
}

export async function getTrailerHistory(): Promise<TrailerHistoryResponse> {
  return (await api.get('/api/history/trailers')).data
}

export async function getServiceOrderHistory(): Promise<OsHistoryResponse> {
  return (await api.get('/api/history/service-orders')).data
}

export async function getServiceOrderHistoryDetail(osId: string): Promise<OsHistoryDetail> {
  return (await api.get(`/api/history/service-orders/${encodeURIComponent(osId)}`)).data
}

export async function getFleetMappingGroups(): Promise<FleetMappingGroup[]> {
  const r = await api.get('/api/fleet-mapping/groups')
  return r.data.groups || []
}

export async function getFleetMappingMembers(
  groupId: number
): Promise<{ group: FleetMappingGroup; members: FleetMappingMember[] }> {
  return (await api.get(`/api/fleet-mapping/groups/${groupId}/members`)).data
}

export async function getFleetBaseCodes(): Promise<FleetBaseCode[]> {
  const r = await api.get('/api/fleet-mapping/base-codes')
  return r.data.items || []
}

export async function addFleetBaseCode(code: string, label: string): Promise<FleetBaseCode> {
  return (await api.post('/api/fleet-mapping/base-codes', { code, label })).data
}

export async function saveFleetMappingMember(
  groupId: number,
  plate: string,
  data: Partial<FleetMappingMember>
): Promise<FleetMappingMember> {
  return (
    await api.put(`/api/fleet-mapping/groups/${groupId}/members/${encodeURIComponent(plate)}`, {
      plate,
      ...data
    })
  ).data
}

export async function deleteFleetMappingMember(groupId: number, plate: string): Promise<void> {
  await api.delete(`/api/fleet-mapping/groups/${groupId}/members/${encodeURIComponent(plate)}`)
}

export async function getFleetMappingAudit(
  groupId: number,
  limit = 100
): Promise<FleetMappingAuditEvent[]> {
  const r = await api.get('/api/fleet-mapping/audit', {
    params: { group_id: groupId, limit }
  })
  return r.data.items || []
}

export async function getFleetServiceOrders(
  months = 24
): Promise<{
  available: boolean
  rows: Array<VehicleHistoryOs & { plate: string }>
  reason?: string
}> {
  try {
    const response = await api.get('/api/history/service-orders', {
      params: { months, _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      timeout: 30000
    })
    const payload = response.data || {}
    return {
      available: payload.available !== false,
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      reason: payload.reason
    }
  } catch (error: any) {
    return {
      available: false,
      rows: [],
      reason: error?.response?.data?.message || error?.message || 'Endpoint de OS indisponível.'
    }
  }
}

export async function createFleetMappingGroup(name: string): Promise<FleetMappingGroup> {
  const r = await api.post('/api/fleet-mapping/groups', { name })
  return r.data.group || r.data
}

export async function getFleetThirdParties(): Promise<FleetThirdParty[]> {
  const r = await api.get('/api/fleet-mapping/third-parties')
  return r.data.items || r.data.third_parties || r.data || []
}

export async function createFleetThirdParty(data: {
  code: string
  name: string
}): Promise<FleetThirdParty> {
  const r = await api.post('/api/fleet-mapping/third-parties', data)
  return r.data.item || r.data
}

export async function updateFleetThirdParty(
  id: number,
  data: Partial<Pick<FleetThirdParty, 'code' | 'name' | 'active'>>
): Promise<FleetThirdParty> {
  const r = await api.put(`/api/fleet-mapping/third-parties/${id}`, data)
  return r.data.item || r.data
}

export async function deleteFleetThirdParty(id: number): Promise<void> {
  await api.delete(`/api/fleet-mapping/third-parties/${id}`)
}

export async function downloadFleetMappingExcel(
  groupId: number,
  kind: 'export' | 'template' = 'export'
): Promise<Blob> {
  const endpoint = kind === 'template' ? 'excel-template' : 'excel-export'
  const response = await api.get(`/api/fleet-mapping/groups/${groupId}/${endpoint}`, {
    responseType: 'blob'
  })
  return response.data
}

export async function importFleetMappingExcel(
  groupId: number,
  file: File
): Promise<{
  total: number
  created: number
  updated: number
}> {
  const form = new FormData()
  form.append('file', file)

  return (
    await api.post(`/api/fleet-mapping/groups/${groupId}/excel-import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  ).data
}

export const overview = getOverview
export const manifestDetail = getManifestDetail
export const fleetGroups = getFleetGroups
export const setActiveGroup = setActiveFleetGroup

export async function mirrorSummary(): Promise<unknown> {
  return (await api.get('/api/mirror/summary')).data
}

export async function mirrorRecords(type: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return (await api.get(`/api/mirror/records/${encodeURIComponent(type)}`, { params })).data
}

export async function mirrorVehicle(plate: string): Promise<unknown> {
  return (await api.get(`/api/mirror/vehicle/${encodeURIComponent(plate)}`)).data
}

export async function openServiceOrders(): Promise<unknown> {
  return (await api.get('/api/history/service-orders')).data
}

export default api
