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
  FleetThirdParty
} from '../types'

export const TOKEN_KEY = 'transmassa_v7_token'

const api = axios.create({
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
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('transmassa-auth-expired'))
    }
    return Promise.reject(error)
  }
)

export async function login(email: string, password: string): Promise<Session & { token: string }> {
  return (await api.post('/api/auth/login', { email, password })).data
}

export async function me(): Promise<Session> {
  return (await api.get('/api/auth/me')).data
}

export async function getOverview(): Promise<Overview> {
  return (await api.get('/api/tv/overview')).data
}

export async function getManifestDetail(id: number): Promise<ManifestDetail> {
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

export async function updateFleetGroup(id: number, data: { name?: string; plates?: string[] }): Promise<FleetGroup> {
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

export default api

import type { VehicleHistoryOs } from '../types'


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
export async function getFleetMappingMembers(groupId: number): Promise<{group:FleetMappingGroup,members:FleetMappingMember[]}> {
  return (await api.get(`/api/fleet-mapping/groups/${groupId}/members`)).data
}
export async function getFleetBaseCodes(): Promise<FleetBaseCode[]> {
  const r = await api.get('/api/fleet-mapping/base-codes')
  return r.data.items || []
}
export async function addFleetBaseCode(code: string, label: string): Promise<FleetBaseCode> {
  return (await api.post('/api/fleet-mapping/base-codes', { code, label })).data
}
export async function saveFleetMappingMember(groupId: number, plate: string, data: Partial<FleetMappingMember>): Promise<FleetMappingMember> {
  return (await api.put(`/api/fleet-mapping/groups/${groupId}/members/${encodeURIComponent(plate)}`, { plate, ...data })).data
}
export async function deleteFleetMappingMember(groupId: number, plate: string): Promise<void> {
  await api.delete(`/api/fleet-mapping/groups/${groupId}/members/${encodeURIComponent(plate)}`)
}
export async function getFleetMappingAudit(groupId: number, limit = 100): Promise<FleetMappingAuditEvent[]> {
  const r = await api.get('/api/fleet-mapping/audit', { params: { group_id: groupId, limit } })
  return r.data.items || []
}

export async function getFleetServiceOrders(months = 24): Promise<{available:boolean, rows:Array<VehicleHistoryOs & {plate:string}>, reason?:string}> {
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

export async function createFleetThirdParty(data: { code: string; name: string }): Promise<FleetThirdParty> {
  const r = await api.post('/api/fleet-mapping/third-parties', data)
  return r.data.item || r.data
}

export async function updateFleetThirdParty(id: number, data: Partial<Pick<FleetThirdParty, 'code' | 'name' | 'active'>>): Promise<FleetThirdParty> {
  const r = await api.put(`/api/fleet-mapping/third-parties/${id}`, data)
  return r.data.item || r.data
}

export async function deleteFleetThirdParty(id: number): Promise<void> {
  await api.delete(`/api/fleet-mapping/third-parties/${id}`)
}

export async function downloadFleetMappingExcel(groupId: number, kind: 'export' | 'template'): Promise<Blob> {
  const suffix = kind === 'template' ? 'template-excel' : 'export-excel'
  const response = await api.get(`/api/fleet-mapping/groups/${groupId}/${suffix}`, { responseType: 'blob' })
  return response.data
}

export interface FleetMappingImportResult {
  ok: boolean
  total: number
  created: number
  updated: number
  message?: string
}

export async function importFleetMappingExcel(groupId: number, file: File): Promise<FleetMappingImportResult> {
  const payload = await file.arrayBuffer()
  const response = await api.post(`/api/fleet-mapping/groups/${groupId}/import-excel`, payload, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    timeout: 60000
  })
  return response.data
}
