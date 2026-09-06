export type OperationalStatus = 'AVAILABLE' | 'COMMITTED' | 'IN_TRANSIT' | 'MAINTENANCE'
export type Ownership = 'OWN' | 'THIRD_PARTY'

export interface ManifestSummary {
  id: number
  numero: string | number
  referencia?: string
  data?: string
  previsaoSaida?: string
  saida?: string
  chegada?: string
  previsaoChegada?: string
  status?: string
  motorista?: string
  reboque1?: string
  reboque2?: string
  trailers: string[]
  quantidadeDestinos: number
  qtdNf: number
  volumesNf: number
  pesoKg: number
  entregas: number
  transferencias: number
  coletas: number
  service: string
  operationContext?: {
    label: string
    kind: 'TRANSFER' | 'DISTRIBUTION' | 'COLLECTION' | 'OTHER'
    details: string[]
  } | null
  destinationText?: string
  transferBase?: string
  transferDestination?: string
  observacoes?: string
}

export interface MaintenanceSummary {
  serviceOrderId?: string | number
  status?: string
  type?: string
  openedAt?: string
  days?: string | number
  odometer?: string | number
  laborThird?: unknown
  laborOwn?: unknown
  parts?: unknown
  total?: unknown
  branch?: string
}

export interface Vehicle {
  plate: string
  vehicleType: string
  fleetSource: string
  operationalStatus: OperationalStatus
  ownership: Ownership
  thirdPartyName: string
  capacityKg: number
  loadKg: number
  utilizationPercent: number | null
  manifest: ManifestSummary | null
  maintenance: MaintenanceSummary | null
}

export interface BreakdownItem {
  label: string
  total: number
}

export interface FleetGroup {
  id: number
  key: string
  name: string
  base: string
  plates: string[]
  system: boolean
  updatedAt: string
}

export interface Preference {
  userId: number
  activeFleetGroupId: number | null
  filters: {
    status: string
    type: string
    service: string
    ownership: string
  }
  updatedAt: string
}

export interface SessionUser {
  id: number
  name: string
  email: string
  role: string
  defaultBase: string
}

export interface Session {
  user: SessionUser
  preferences: Preference
}

export interface Overview {
  generatedAt: string
  source: Record<string, string>
  counts: {
    total: number
    available: number
    committed: number
    inTransit: number
    maintenance: number
  }
  breakdowns: {
    available: BreakdownItem[]
    committed: BreakdownItem[]
    inTransit: BreakdownItem[]
    maintenance: BreakdownItem[]
  }
  preferences: Preference
  activeFleetGroup: FleetGroup | null
  vehicles: Vehicle[]
}

export interface ManifestDetail {
  manifest: Record<string, unknown>
  service: string
  fretes: Array<Record<string, unknown>>
  notasFiscais: Array<Record<string, unknown>>
  coletas: Array<Record<string, unknown>>
  cache?: 'HIT' | 'MISS'
}

export interface MaintenanceDetail extends MaintenanceSummary {
  plate: string
}

export interface FleetCatalogItem {
  plate: string
  vehicleType: string
  source: string
}

export interface CouplingFleet {
  tractors: FleetCatalogItem[]
  trailers: FleetCatalogItem[]
  couplings: Array<{
    tractorPlate: string
    trailers: string[]
    updatedAt: string
  }>
}


export interface TrailerHistoryRow {
  trailerPlate: string
  tractorPlate: string
  manifestId: number
  manifestNumber: string | number
  status: string
  driver: string
  date: string | null
  departureAt: string | null
  arrivalAt: string | null
  current: boolean
}

export interface TrailerHistoryResponse {
  current: TrailerHistoryRow[]
  history: TrailerHistoryRow[]
}

export interface OsHistoryRow {
  os: string
  plate: string
  status: string
  openedAt: string | null
  closedAt: string | null
  total: number | string | null
  branch: string
  maintenanceType: string
  odometer?: string | number | null
  daysInMaintenance?: string | number | null
  laborThird?: string | number | null
  laborOwn?: string | number | null
  parts?: string | number | null
  isOpen?: boolean
  firstSeenAt?: string | null
  changedAt?: string | null
  payload?: Record<string, unknown>
}

export interface OsHistoryResponse {
  available: boolean
  sourceTable?: string
  rows: OsHistoryRow[]
  reason?: string
  operational?: {
    manifestCount: number
    nfMoved: number
    revenue: number
    cargoValue: number | null
    servicesTotal: number
    serviceCounts: {
      COLETA: number
      DISTRIBUICAO: number
      TRANSFERENCIA: number
      OUTROS: number
    }
    note?: string
  }
}

export interface OsHistoryDetail {
  current: Record<string, unknown>
  history: Array<{
    id: number
    service_order_id: string
    version: number
    event_type: string
    captured_at: string
    changed_fields: Record<string, unknown>
    payload: Record<string, unknown>
    source_file?: string
  }>
}


export interface MonthlyInsight {
  month: string
  fuelCost: number
  fuelLiters: number
  avgKmL: number | null
  maintenanceCost: number
  nfValue: number
  serviceCost: number
}

export interface FleetInsightsResponse {
  available: boolean
  nfAvailable?: boolean
  monthly: MonthlyInsight[]
  reason?: string
}

export interface VehicleHistoryFuel {
  date?: string | null
  station?: string
  fuel?: string
  total?: number
  liters?: number
  kmL?: number | null
  odometer?: string | number
  driver?: string
}

export interface VehicleHistoryOs {
  os?: string
  date?: string | null
  branch?: string
  status?: string
  type?: string
  total?: number
  parts?: number
  laborOwn?: number
  laborThird?: number
  odometer?: string | number
}

export interface VehicleHistoryService {
  os?: string
  date?: string | null
  service?: string
  group?: string
  type?: string
  value?: number
}

export interface VehicleHistoryPart {
  os?: string
  date?: string | null
  part?: string
  group?: string
  type?: string
  value?: number
}


export interface VehicleManifestHistory {
  id: number
  numero: string | number
  data?: string | null
  previsaoSaida?: string | null
  saida?: string | null
  chegada?: string | null
  fechamento?: string | null
  status?: string | null
  motorista?: string | null
  reboque1?: string | null
  reboque2?: string | null
  quantidadeDestinos: number
  qtdNf: number
  volumesNf: number
  pesoKg: number
  coletas: number
  distribuicoes: number
  transferencias: number
  totalFreight: number
  service: string
}

export interface VehicleInsights {
  available: boolean
  nfAvailable?: boolean
  plate: string
  monthly: MonthlyInsight[]
  totals?: {
    fuelCost: number
    fuelLiters: number
    avgKmL: number | null
    maintenanceCost: number
    serviceCost: number
    nfValue: number
  }
  fuel: VehicleHistoryFuel[]
  serviceOrders: VehicleHistoryOs[]
  services: VehicleHistoryService[]
  parts: VehicleHistoryPart[]
  manifests?: VehicleManifestHistory[]
  operational?: {
    manifestCount: number
    nfMoved: number
    revenue: number
    cargoValue: number | null
    servicesTotal: number
    serviceCounts: {
      COLETA: number
      DISTRIBUICAO: number
      TRANSFERENCIA: number
      OUTROS: number
    }
    note?: string
  }
  reason?: string
}


export interface FleetMappingGroup {
  id: number | 'total'
  name: string
  slug: string
  virtual?: boolean
  is_system?: boolean
  is_shared?: boolean
  member_count?: number | null
  bases?: Array<{ base_code: string; total: number }>
}
export interface FleetMappingMember {
  id?: number
  plate: string
  base_code?: string | null
  driver_name?: string | null
  vehicle_type?: string | null
  owner_code?: string | null
  notes?: string | null
}
export interface FleetBaseCode {
  code: string
  label: string
  active?: boolean
}
