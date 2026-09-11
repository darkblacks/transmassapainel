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
  /** Todos os manifestos ainda ativos/empenhados da placa. */
  activeManifests?: ManifestSummary[]
  activeManifestCount?: number
  /** Ex.: OS pendente ao mesmo tempo em que há serviço ativo. */
  hasInconsistency?: boolean
  inconsistencyReason?: string
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
  service_override?: string | null
  owner_code?: string | null
  notes?: string | null
  ownership?: Ownership | null
  third_party_id?: number | null
  third_party_name?: string | null
}

export interface FleetThirdParty {
  id: number
  code: string
  name: string
  active?: boolean
  created_at?: string
  updated_at?: string
}
export interface FleetBaseCode {
  code: string
  label: string
  active?: boolean
}

export interface FleetMappingAuditEvent {
  id: number
  action: 'MEMBER_CREATED' | 'MEMBER_UPDATED' | 'MEMBER_DELETED' | 'BASE_CREATED' | 'BASE_UPDATED' | string
  group_id?: number | null
  plate?: string | null
  base_code?: string | null
  actor_user_id?: number | null
  actor_email?: string | null
  actor_role?: string | null
  before_data?: Record<string, unknown> | null
  after_data?: Record<string, unknown> | null
  created_at: string
}
