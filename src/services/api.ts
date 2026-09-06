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
  FleetInsightsResponse,
  VehicleInsights,
  FleetMappingGroup,
  FleetMappingMember,
  FleetBaseCode
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


export async function getFleetMonthlyInsights(plates: string[], months = 12): Promise<FleetInsightsResponse> {
  return (await api.post('/api/fleet-insights/monthly', { plates, months })).data
}

type MirrorRecord = {
  report_type: string
  natural_key: string
  record_date?: string | null
  plate?: string | null
  service_order_no?: string | null
  payload?: Record<string, unknown>
  first_seen_at?: string | null
  last_seen_at?: string | null
  updated_at?: string | null
}

type MirrorVehicleResponse = {
  plate: string
  service_orders: MirrorRecord[]
  supplies: MirrorRecord[]
  service_order_services: MirrorRecord[]
  service_order_parts: MirrorRecord[]
}

function textValue(p: Record<string, unknown> | undefined, ...keys: string[]): string {
  for (const key of keys) {
    const value = p?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function numericValue(p: Record<string, unknown> | undefined, ...keys: string[]): number {
  for (const key of keys) {
    const value = p?.[key]
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const raw = String(value).trim()
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/[^\d.-]/g, '')
    const number = Number(normalized.replace(/[^\d.-]/g, ''))
    if (Number.isFinite(number)) return number
  }
  return 0
}

function rowDate(row: MirrorRecord): string | null {
  const p = row.payload || {}
  return textValue(p, 'data', 'data_servico', 'data_movimentacao', 'movimentacao', 'service_at', 'movement_at') || row.record_date || null
}

function rowOs(row: MirrorRecord): string {
  const p = row.payload || {}
  return String(row.service_order_no || textValue(p, 'n', 'no_os', 'numero_os', 'ordem_de_servico', 'os') || '')
}

function rowMonth(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const m = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}` : ''
}

export async function getVehicleInsights(plate: string, months = 24): Promise<VehicleInsights> {
  const normalizedPlate = String(plate || '').trim().toUpperCase()

  const [baseResult, mirrorResult] = await Promise.allSettled([
    api.get(`/api/fleet-insights/vehicle/${encodeURIComponent(normalizedPlate)}`, {
      params: { months, _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    }),
    api.get(`/api/mirror/vehicle/${encodeURIComponent(normalizedPlate)}`, {
      params: { _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    })
  ])

  const base: VehicleInsights = baseResult.status === 'fulfilled'
    ? (baseResult.value.data as VehicleInsights)
    : {
        available: true,
        plate: normalizedPlate,
        monthly: [],
        fuel: [],
        serviceOrders: [],
        services: [],
        parts: [],
        manifests: []
      }

  if (base.plate && String(base.plate).trim().toUpperCase() !== normalizedPlate) {
    throw new Error(`Resposta analítica pertence a outra placa: ${base.plate}`)
  }

  if (mirrorResult.status !== 'fulfilled') {
    return {
      ...base,
      plate: normalizedPlate,
      available: false,
      fuel: [],
      serviceOrders: [],
      services: [],
      parts: [],
      reason: 'Espelho PostgreSQL V16 indisponível.'
    }
  }

  const mirror = mirrorResult.value.data as MirrorVehicleResponse

  const fuel = (mirror.supplies || []).map(row => {
    const p = row.payload || {}
    return {
      date: rowDate(row),
      station: textValue(p, 'posto', 'posto_de_combustivel', 'fornecedor'),
      fuel: textValue(p, 'combustivel', 'produto', 'tipo_combustivel'),
      total: numericValue(p, 'total', 'valor_total', 'valor'),
      liters: numericValue(p, 'litros', 'quantidade', 'qtd_litros'),
      kmL: numericValue(p, 'consumo_km_litro', 'km_l', 'media_km_l') || null,
      odometer: textValue(p, 'odometro', 'hodometro', 'km'),
      driver: textValue(p, 'motorista')
    }
  })

  const serviceOrders = (mirror.service_orders || []).map(row => {
    const p = row.payload || {}
    return {
      os: rowOs(row),
      date: rowDate(row),
      branch: textValue(p, 'filial', 'corporacao'),
      status: textValue(p, 'status'),
      type: textValue(p, 'tipo_de_manutencao', 'tipo_manutencao', 'tipo'),
      total: numericValue(p, 'total', 'valor_total'),
      parts: numericValue(p, 'pecas', 'valor_pecas'),
      laborOwn: numericValue(p, 'mao_de_obra_proprio', 'mao_de_obra_propria'),
      laborThird: numericValue(p, 'mao_de_obra_terceiro', 'mao_de_obra_terceiros'),
      odometer: textValue(p, 'odometro', 'hodometro')
    }
  })

  const services = (mirror.service_order_services || []).map(row => {
    const p = row.payload || {}
    return {
      os: rowOs(row),
      date: rowDate(row),
      service: textValue(p, 'servico', 'descricao', 'produto'),
      group: textValue(p, 'item_do_conjunto', 'grupo', 'conjunto_e_item'),
      type: textValue(p, 'tipo', 'local_servico'),
      value: numericValue(p, 'valor_servico', 'valor', 'total')
    }
  })

  const parts = (mirror.service_order_parts || []).map(row => {
    const p = row.payload || {}
    return {
      os: rowOs(row),
      date: rowDate(row),
      part: textValue(p, 'peca', 'produto', 'descricao'),
      group: textValue(p, 'grupo', 'conjunto_e_item', 'item_do_conjunto'),
      type: textValue(p, 'tipo'),
      value: numericValue(p, 'valor', 'valor_total', 'total')
    }
  })

  const fuelCost = fuel.reduce((sum, row) => sum + Number(row.total || 0), 0)
  const fuelLiters = fuel.reduce((sum, row) => sum + Number(row.liters || 0), 0)
  const maintenanceCost = serviceOrders.reduce((sum, row) => sum + Number(row.total || 0), 0)
  const serviceCost = services.reduce((sum, row) => sum + Number(row.value || 0), 0)
  const validKmL = fuel.map(row => Number(row.kmL || 0)).filter(v => v > 0)
  const avgKmL = validKmL.length ? validKmL.reduce((a,b) => a + b, 0) / validKmL.length : null

  const monthlyMap = new Map<string, any>()
  for (const existing of base.monthly || []) monthlyMap.set(existing.month, { ...existing })

  const ensure = (month: string) => {
    if (!monthlyMap.has(month)) monthlyMap.set(month, {
      month, fuelCost: 0, fuelLiters: 0, avgKmL: null,
      maintenanceCost: 0, nfValue: 0, serviceCost: 0,
      _kmLSum: 0, _kmLCount: 0
    })
    return monthlyMap.get(month)
  }

  const touchedFuel = new Set<string>()
  const touchedOs = new Set<string>()
  const touchedServices = new Set<string>()

  for (const row of fuel) {
    const month = rowMonth(row.date)
    if (!month) continue
    const m = ensure(month)
    if (!touchedFuel.has(month)) {
      m.fuelCost = 0; m.fuelLiters = 0; m.avgKmL = null; m._kmLSum = 0; m._kmLCount = 0
      touchedFuel.add(month)
    }
    m.fuelCost += Number(row.total || 0)
    m.fuelLiters += Number(row.liters || 0)
    if (Number(row.kmL || 0) > 0) {
      m._kmLSum = (m._kmLSum || 0) + Number(row.kmL)
      m._kmLCount = (m._kmLCount || 0) + 1
    }
  }

  for (const row of serviceOrders) {
    const month = rowMonth(row.date)
    if (!month) continue
    const m = ensure(month)
    if (!touchedOs.has(month)) { m.maintenanceCost = 0; touchedOs.add(month) }
    m.maintenanceCost += Number(row.total || 0)
  }

  for (const row of services) {
    const month = rowMonth(row.date)
    if (!month) continue
    const m = ensure(month)
    if (!touchedServices.has(month)) { m.serviceCost = 0; touchedServices.add(month) }
    m.serviceCost += Number(row.value || 0)
  }

  for (const m of monthlyMap.values()) {
    if ((m._kmLCount || 0) > 0) m.avgKmL = (m._kmLSum || 0) / (m._kmLCount || 1)
    delete m._kmLSum
    delete m._kmLCount
  }

  const monthly = [...monthlyMap.values()]
    .sort((a:any,b:any) => String(a.month).localeCompare(String(b.month)))
    .slice(-Math.max(1, months))

  return {
    ...base,
    available: true,
    plate: normalizedPlate,
    monthly,
    totals: {
      fuelCost,
      fuelLiters,
      avgKmL,
      maintenanceCost,
      serviceCost,
      nfValue: Number(base.totals?.nfValue || 0)
    },
    fuel,
    serviceOrders,
    services,
    parts,
    manifests: base.manifests || []
  }
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

export async function getFleetServiceOrders(months = 24): Promise<{available:boolean, rows:Array<VehicleHistoryOs & {plate:string}>, reason?:string}> {
  try {
    const all: MirrorRecord[] = []
    let offset = 0
    const limit = 1000
    let total = 0

    do {
      const response = await api.get('/api/mirror/records/service_orders', {
        params: { limit, offset, _ts: Date.now() },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        timeout: 30000
      })
      const page = response.data
      const rows = (page.rows || []) as MirrorRecord[]
      all.push(...rows)
      total = Number(page.total || all.length)
      offset += rows.length
      if (!rows.length) break
    } while (offset < total)

    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - Math.max(1, months))

    const rows = all
      .map(row => {
        const p = row.payload || {}
        return {
          plate: String(row.plate || textValue(p, 'veiculo', 'placa') || '').toUpperCase(),
          os: rowOs(row),
          date: rowDate(row),
          branch: textValue(p, 'filial', 'corporacao'),
          status: textValue(p, 'status'),
          type: textValue(p, 'tipo_de_manutencao', 'tipo_manutencao', 'tipo'),
          total: numericValue(p, 'total', 'valor_total'),
          parts: numericValue(p, 'pecas', 'valor_pecas'),
          laborOwn: numericValue(p, 'mao_de_obra_proprio', 'mao_de_obra_propria'),
          laborThird: numericValue(p, 'mao_de_obra_terceiro', 'mao_de_obra_terceiros'),
          odometer: textValue(p, 'odometro', 'hodometro')
        }
      })
      .filter(row => {
        if (!row.date) return true
        const d = new Date(row.date)
        return Number.isNaN(d.getTime()) || d >= cutoff
      })

    return { available: true, rows }
  } catch (error: any) {
    return {
      available: false,
      rows: [],
      reason: error?.response?.data?.message || error?.message || 'Espelho PostgreSQL V16 indisponível.'
    }
  }
}
