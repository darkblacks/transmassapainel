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
  VehicleHistoryOs,
  EslHealthSummary,
  EslRecentExecution,
  EslReportHealth,
  IntegrationHealthLevel
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


const serviceOrderHistoryCache = new Map<string, Record<string, unknown>>()


function normalizeHealthLevel(value: unknown): IntegrationHealthLevel {
  const raw = String(value || '').toLowerCase()
  if (['healthy', 'ok', 'success', 'sucesso', 'up', 'online'].includes(raw)) return 'healthy'
  if (['warning', 'warn', 'delayed', 'atrasado', 'processing', 'pulado'].includes(raw)) return 'warning'
  if (['critical', 'error', 'erro', 'down', 'offline', 'failed', 'falha'].includes(raw)) return 'critical'
  return 'unknown'
}

function reportLabel(key: string): string {
  const labels: Record<string, string> = {
    fretes: 'Fretes',
    manifestos: 'Manifestos',
    ocorrencias: 'Ocorrências',
    os: 'Ordens de serviço'
  }
  return labels[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Integração')
}

function normalizeEslReport(raw: any): EslReportHealth {
  const key = String(raw?.key || raw?.report || raw?.relatorio || '').toLowerCase()
  return {
    key,
    label: String(raw?.label || reportLabel(key)),
    frequencyMinutes: raw?.frequencyMinutes == null ? (raw?.frequency_minutes == null ? null : Number(raw.frequency_minutes)) : Number(raw.frequencyMinutes),
    status: normalizeHealthLevel(raw?.status || raw?.situacao),
    lastSuccessAt: raw?.lastSuccessAt || raw?.last_success_at || raw?.ultimaConclusao || raw?.ultima_conclusao || null,
    lastErrorAt: raw?.lastErrorAt || raw?.last_error_at || null,
    nextPlannedAt: raw?.nextPlannedAt || raw?.next_planned_at || raw?.proximo_ciclo || null,
    lastScheduledAt: raw?.lastScheduledAt || raw?.last_scheduled_at || raw?.ciclo_programado || null,
    avgDurationSeconds: raw?.avgDurationSeconds == null ? (raw?.avg_duration_seconds == null ? null : Number(raw.avg_duration_seconds)) : Number(raw.avgDurationSeconds),
    totalSuccess: Number(raw?.totalSuccess ?? raw?.sucesso ?? raw?.success ?? 0),
    totalError: Number(raw?.totalError ?? raw?.erro ?? raw?.error ?? 0),
    totalSkipped: Number(raw?.totalSkipped ?? raw?.pulado ?? raw?.skipped ?? 0),
    processing: Boolean(raw?.processing),
    note: raw?.note || raw?.observacao || null
  }
}

function normalizeRecentExecution(raw: any): EslRecentExecution {
  return {
    id: raw?.id,
    report: String(raw?.report || raw?.relatorio || 'Integração'),
    status: String(raw?.status || raw?.situacao || 'desconhecido'),
    scheduledAt: raw?.scheduledAt || raw?.scheduled_at || raw?.ciclo_programado || null,
    startedAt: raw?.startedAt || raw?.started_at || raw?.iniciado_em || null,
    finishedAt: raw?.finishedAt || raw?.finished_at || raw?.finalizado_em || null,
    durationSeconds: raw?.durationSeconds == null ? (raw?.tempo_total == null ? null : Number(raw.tempo_total)) : Number(raw.durationSeconds),
    rows: raw?.rows == null ? (raw?.linhas == null ? null : Number(raw.linhas)) : Number(raw.rows),
    changes: raw?.changes == null ? Number((raw?.alterados ?? 0)) + Number((raw?.novos ?? 0)) : Number(raw.changes)
  }
}

function normalizeLegacyMirrorSummary(raw: any): EslHealthSummary {
  const generatedAt = raw?.generatedAt || raw?.updatedAt || raw?.lastSyncAt || new Date().toISOString()
  const lastCompletedAt = raw?.lastCompletedAt || raw?.lastSyncAt || raw?.updatedAt || raw?.generatedAt || null
  return {
    generatedAt,
    overallStatus: normalizeHealthLevel(raw?.status),
    overview: {
      headline: 'Acompanhamento da integração',
      lastCompletedAt,
      nextPlannedAt: raw?.nextPlannedAt || null,
      delayedReports: Array.isArray(raw?.delayedReports) ? raw.delayedReports : [],
      activeReports: Array.isArray(raw?.activeReports) ? raw.activeReports : [],
      note: 'Modo de compatibilidade: backend detalhado de integração ainda não respondeu.'
    },
    reports: Array.isArray(raw?.reports) ? raw.reports.map(normalizeEslReport) : [],
    recentExecutions: Array.isArray(raw?.recentExecutions) ? raw.recentExecutions.map(normalizeRecentExecution) : []
  }
}

function normalizeEslHealthSummary(raw: any): EslHealthSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      generatedAt: new Date().toISOString(),
      overallStatus: 'unknown',
      overview: { headline: 'Integração ESL', note: 'Nenhum dado de integração foi retornado.' },
      reports: []
    }
  }

  if (!Array.isArray(raw?.reports) && !raw?.overview && (raw?.lastSyncAt || raw?.updatedAt || raw?.generatedAt)) {
    return normalizeLegacyMirrorSummary(raw)
  }

  return {
    generatedAt: raw?.generatedAt || new Date().toISOString(),
    overallStatus: normalizeHealthLevel(raw?.overallStatus || raw?.status),
    overview: {
      headline: raw?.overview?.headline || raw?.headline || 'Integração ESL',
      lastCompletedAt: raw?.overview?.lastCompletedAt || raw?.lastCompletedAt || null,
      nextPlannedAt: raw?.overview?.nextPlannedAt || raw?.nextPlannedAt || null,
      delayedReports: Array.isArray(raw?.overview?.delayedReports) ? raw.overview.delayedReports : [],
      activeReports: Array.isArray(raw?.overview?.activeReports) ? raw.overview.activeReports : [],
      note: raw?.overview?.note || raw?.note || null
    },
    reports: Array.isArray(raw?.reports) ? raw.reports.map(normalizeEslReport) : [],
    recentExecutions: Array.isArray(raw?.recentExecutions) ? raw.recentExecutions.map(normalizeRecentExecution) : []
  }
}

function normalizePlate(value: unknown): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function maintenanceIsOpen(status: unknown): boolean {
  const value = String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return (
    value.includes('pendente') ||
    value.includes('aberto') ||
    value.includes('andamento') ||
    value.includes('aguard')
  )
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  )

  return results
}

function maintenanceToHistoryRow(
  plate: string,
  item: MaintenanceDetail | NonNullable<MaintenanceDetail['active']>
): import('../types').OsHistoryRow {
  const os = String(item.serviceOrderNumber || item.serviceOrderId || item.id || '')
  const row: import('../types').OsHistoryRow = {
    os,
    plate: normalizePlate(plate),
    status: String(item.status || ''),
    openedAt: item.openedAt ? String(item.openedAt) : null,
    closedAt: maintenanceIsOpen(item.status) ? null : (item.updatedAt ? String(item.updatedAt) : null),
    total: item.total == null ? null : Number(item.total),
    branch: String(item.branch || ''),
    maintenanceType: String(item.type || ''),
    odometer: item.odometer == null ? null : item.odometer,
    daysInMaintenance: item.daysInMaintenance == null ? null : item.daysInMaintenance,
    laborThird: item.laborTotal == null ? null : String(item.laborTotal),
    laborOwn: null,
    parts: item.partsTotal == null ? null : String(item.partsTotal),
    isOpen: maintenanceIsOpen(item.status),
    firstSeenAt: item.openedAt ? String(item.openedAt) : null,
    changedAt: item.updatedAt ? String(item.updatedAt) : null,
    payload: item as unknown as Record<string, unknown>
  }

  if (os) serviceOrderHistoryCache.set(os, row as unknown as Record<string, unknown>)
  return row
}


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
  const [catalog, overviewData] = await Promise.all([
    getFleetCatalog(),
    getOverview()
  ])

  const trailerMap = new Map<string, FleetCatalogItem>()
  const couplingMap = new Map<string, { tractorPlate: string; trailers: string[]; updatedAt: string }>()

  for (const vehicle of overviewData.vehicles || []) {
    const tractorPlate = normalizePlate(vehicle.plate)
    if (!tractorPlate) continue

    const trailers = Array.from(new Set(
      (vehicle.activeManifests || [])
        .flatMap(manifest => manifest.trailers || [])
        .map(normalizePlate)
        .filter(Boolean)
    ))

    if (!trailers.length) continue

    for (const plate of trailers) {
      if (!trailerMap.has(plate)) {
        trailerMap.set(plate, {
          plate,
          vehicleType: 'Carreta',
          source: 'MYSQL / manifestos'
        })
      }
    }

    const manifestDates = (vehicle.activeManifests || [])
      .map(manifest => manifest.generatedAt || manifest.data || '')
      .filter(Boolean)
      .sort()

    const latest =
      manifestDates.length > 0
        ? manifestDates[manifestDates.length - 1]
        : overviewData.generatedAt

    couplingMap.set(tractorPlate, {
      tractorPlate,
      trailers,
      updatedAt: String(latest || overviewData.generatedAt)
    })
  }

  return {
    tractors: catalog,
    trailers: Array.from(trailerMap.values()).sort((a, b) => a.plate.localeCompare(b.plate)),
    couplings: Array.from(couplingMap.values()).sort((a, b) => a.tractorPlate.localeCompare(b.tractorPlate))
  }
}

export async function savePublicCoupling(_plate: string, _trailers: string[]): Promise<void> {
  throw new Error('Edição manual de acoplamento não está disponível no backend atual. O painel usa os reboques dos manifestos.')
}

export async function getTrailerHistory(): Promise<TrailerHistoryResponse> {
  const overviewData = await getOverview()
  const current: TrailerHistoryResponse['current'] = []

  for (const vehicle of overviewData.vehicles || []) {
    for (const manifest of vehicle.activeManifests || []) {
      for (const trailer of manifest.trailers || []) {
        const trailerPlate = normalizePlate(trailer)
        if (!trailerPlate) continue

        current.push({
          trailerPlate,
          tractorPlate: normalizePlate(vehicle.plate),
          manifestId: Number(manifest.id || 0),
          manifestNumber: manifest.numero || manifest.id,
          status: String(manifest.status || ''),
          driver: String(manifest.motorista || ''),
          date: manifest.generatedAt || manifest.data || null,
          departureAt: manifest.saida || null,
          arrivalAt: manifest.chegada || null,
          current: true
        })
      }
    }
  }

  current.sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  )

  return {
    current,
    // O backend atual só expõe os manifestos ativos no overview.
    // Não inventamos histórico encerrado que não existe nessa API.
    history: []
  }
}

export async function getServiceOrderHistory(months = 24): Promise<OsHistoryResponse> {
  const catalog = await getFleetCatalog()
  const plates = Array.from(new Set(
    catalog.map(item => normalizePlate(item.plate)).filter(Boolean)
  ))

  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() - Math.max(1, months))

  const chunks = await mapWithConcurrency(plates, 6, async plate => {
    try {
      const detail = await getMaintenanceDetail(plate)
      const history = Array.isArray(detail.history) ? detail.history : []

      return history.map(item => maintenanceToHistoryRow(plate, item))
    } catch {
      return []
    }
  })

  const rows = chunks
    .flat()
    .filter(row => {
      if (!row.openedAt) return true
      const time = new Date(row.openedAt).getTime()
      return Number.isNaN(time) || time >= minDate.getTime()
    })
    .sort((a, b) =>
      String(b.openedAt || '').localeCompare(String(a.openedAt || ''))
    )

  return {
    available: true,
    sourceTable: 'os via /api/tv/maintenance/:plate',
    rows
  }
}

export async function getServiceOrderHistoryDetail(osId: string): Promise<OsHistoryDetail> {
  let current = serviceOrderHistoryCache.get(String(osId))

  if (!current) {
    const data = await getServiceOrderHistory()
    current = data.rows.find(row => String(row.os) === String(osId)) as unknown as Record<string, unknown> | undefined
  }

  if (!current) {
    return {
      current: { os: osId },
      history: []
    }
  }

  return {
    current,
    history: []
  }
}

export async function getFleetMappingGroups(): Promise<FleetMappingGroup[]> {
  const r = await api.get('/api/fleet-mapping/groups')
  return r.data.groups || []
}

export async function getFleetMappingMembers(
  groupId: number
): Promise<{ group: FleetMappingGroup; members: FleetMappingMember[] }> {
  const response = (await api.get(`/api/fleet-mapping/groups/${groupId}/members`)).data
  return {
    ...response,
    members: (response.members || []).map((m: FleetMappingMember & { branch_code?: string | null }) => ({
      ...m,
      base_code: m.base_code ?? m.branch_code ?? null,
      ownership: m.owner_code ? 'THIRD_PARTY' as const : 'OWN' as const
    }))
  }
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
      // A placa já está na URL. O DTO NestJS aceita apenas estes campos.
      branch_code: data.base_code ?? null,
      driver_name: data.driver_name ?? null,
      vehicle_type: data.vehicle_type ?? null,
      owner_code: data.ownership === 'OWN' ? null : data.owner_code ?? null,
      service_override: data.service_override ?? null,
      notes: data.notes ?? null
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
    const data = await getServiceOrderHistory(months)

    return {
      available: data.available,
      rows: data.rows.map(row => ({
        os: row.os,
        plate: row.plate,
        date: row.openedAt,
        branch: row.branch,
        status: row.status,
        type: row.maintenanceType,
        total: row.total == null ? undefined : Number(row.total),
        parts: row.parts == null ? undefined : Number(row.parts),
        laborOwn: row.laborOwn == null ? undefined : Number(row.laborOwn),
        laborThird: row.laborThird == null ? undefined : Number(row.laborThird),
        odometer: row.odometer == null ? undefined : row.odometer,
        daysInMaintenance: row.daysInMaintenance == null ? undefined : row.daysInMaintenance
      })),
      reason: data.reason
    }
  } catch (error: any) {
    return {
      available: false,
      rows: [],
      reason: error?.response?.data?.message || error?.message || 'Não foi possível consultar as OS por placa.'
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
  const data = await getServiceOrderHistory()
  return {
    ...data,
    rows: data.rows.filter(row => row.isOpen)
  }
}



export async function getEslHealthSummary(): Promise<EslHealthSummary> {
  // Fonte unica: registros reais de execucao ESL no MySQL, atraves do NestJS.
  // Nao usar dados de espelho legado para sugerir sucesso que nao foi confirmado.
  return normalizeEslHealthSummary((await api.get('/api/tv/esl-health')).data)
}

export default api
