import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Filter,
  LogOut,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  Search,
  Settings2,
  Truck,
  Wrench
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import CouplingPage from './components/CouplingPage'
import ServiceOrderHistoryPage from './components/ServiceOrderHistoryPage'
import FleetGroupsPage from './components/FleetGroupsPage'
import StatusBadge from './components/StatusBadge'
import TypeMultiSelect from './components/TypeMultiSelect'
import ExpandedRow from './components/ExpandedRow'
import { getFleetMappingGroups, getFleetMappingMembers, getOverview, me, TOKEN_KEY } from './services/api'
import type { FleetMappingGroup, FleetMappingMember, OperationalStatus, Overview, Ownership, Session, Vehicle } from './types'
import { BRANCHES, belongsToBranch, branchTitle, canonicalBranchCode, type BranchCode } from './config/branches'
import {
  COLLECTION_SERVICE,
  DISTRIBUTION_SERVICE,
  TRANSFER_SERVICE,
  operationLabel
} from './utils/operations'

const PAGE_SIZE = 50
const cleanPath = window.location.pathname.replace(/\/+$/, '')
const isCouplingPage = cleanPath === '/acoplamentos' || cleanPath === '/historico-carretas'
const isOsHistoryPage = cleanPath === '/historico-os'

function cleanVehiclePlate(value: unknown): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function elapsed(value?: string): string {
  if (!value) return 'INÍCIO NÃO REGISTRADO'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'INÍCIO NÃO REGISTRADO'

  const totalMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  return days
    ? `${days}d ${hours}h`
    : `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function kgText(kg: number): string {
  return `${Number(kg || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(Number(kg || 0)) ? 0 : 2,
    maximumFractionDigits: 2
  })} kg`
}

function tons(kg: number): string {
  return `${(Number(kg || 0) / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: kg % 1000 ? 1 : 0,
    maximumFractionDigits: 1
  })} T`
}

function trailersText(vehicle: Vehicle): string {
  const trailers = vehicle.manifest?.trailers || []
  return trailers.length ? trailers.join(' + ') : '—'
}

function destinationText(vehicle: Vehicle): string {
  if (vehicle.operationalStatus === 'MAINTENANCE') return 'Manutenção'

  const manifest = vehicle.manifest
  if (!manifest) return '—'

  const context = manifest.operationContext
  if (context?.label) return context.label

  if (manifest.service.includes('Transferência')) {
    if (manifest.transferBase) return `Base ${manifest.transferBase}`
    if (manifest.transferDestination) return manifest.transferDestination
    return 'Base destino não identificada'
  }

  if (manifest.destinationText) return manifest.destinationText
  if (manifest.quantidadeDestinos) return `${manifest.quantidadeDestinos} destino(s)`
  return '—'
}

function vehicleTypeText(vehicle: Vehicle, mapping?: FleetMappingMember): string {
  return mapping?.vehicle_type || vehicle.vehicleType || 'Não identificado'
}

function effectiveOwnership(vehicle: Vehicle, mapping?: FleetMappingMember): Ownership {
  if (mapping?.ownership === 'OWN' || mapping?.ownership === 'THIRD_PARTY') return mapping.ownership
  if (String(mapping?.owner_code || '').trim()) return 'THIRD_PARTY'
  return vehicle.ownership
}

function effectiveThirdPartyName(vehicle: Vehicle, mapping?: FleetMappingMember): string {
  return mapping?.third_party_name || mapping?.owner_code || vehicle.thirdPartyName || ''
}

function driverText(vehicle: Vehicle, mapping?: FleetMappingMember): string {
  if (vehicle.operationalStatus === 'MAINTENANCE') return `OS ${vehicle.maintenance?.serviceOrderId || '—'}`
  // Em operação, o manifesto é a verdade imutável. Override manual nunca substitui.
  if (vehicle.operationalStatus === 'COMMITTED' || vehicle.operationalStatus === 'IN_TRANSIT') {
    return vehicle.manifest?.motorista || '—'
  }
  // Disponível pode usar motorista manual legado; vazio permanece vazio/—.
  return mapping?.driver_name || '—'
}

function serviceText(vehicle: Vehicle, _mapping?: FleetMappingMember): string {
  return operationLabel(vehicle.manifest)
}

function serviceKindText(vehicle: Vehicle, _mapping?: FleetMappingMember): 'DISTRIBUTION' | 'TRANSFER' | 'COLLECTION' | 'OTHER' {
  const label = operationLabel(vehicle.manifest)
  if (label === DISTRIBUTION_SERVICE) return 'DISTRIBUTION'
  if (label === TRANSFER_SERVICE) return 'TRANSFER'
  if (label === COLLECTION_SERVICE) return 'COLLECTION'
  return 'OTHER'
}

function branchIconSrc(code: BranchCode): string {
  return `/filial-${code.toLowerCase()}.png`
}

function BranchOverview({
  session,
  vehicles,
  loading,
  error,
  mappingByPlate,
  mappingMembers,
  mappingReady,
  onOpen,
  onRefresh,
  onGroups,
  onLogout
}: {
  session: Session
  vehicles: Vehicle[]
  loading: boolean
  error: string
  mappingByPlate: Map<string, FleetMappingMember>
  mappingMembers: FleetMappingMember[]
  mappingReady: boolean
  onOpen: (branch: BranchCode) => void
  onRefresh: () => void
  onGroups: () => void
  onLogout: () => void
}) {
  const branchRows = useMemo(() => {
    const operationalByPlate = new Map(
      vehicles.map(vehicle => [cleanVehiclePlate(vehicle.plate), vehicle])
    )

    return BRANCHES.map(branch => {
      // A composição da filial vem diretamente do mapeamento. O overview
      // operacional só informa o estado atual da placa.
      const branchMembers = mappingMembers.filter(member =>
        belongsToBranch(member.base_code, branch.code) &&
        (member.ownership === 'OWN' || (!member.ownership && !String(member.owner_code || '').trim()))
      )

      const serviceCounts = {
        available: 0,
        collection: 0,
        distribution: 0,
        transfer: 0,
        maintenance: 0
      }

      for (const member of branchMembers) {
        const vehicle = operationalByPlate.get(cleanVehiclePlate(member.plate))

        // Se a placa está cadastrada na frota mas não apareceu no recorte
        // operacional atual, ela continua sendo um veículo disponível.
        if (!vehicle || vehicle.operationalStatus === 'AVAILABLE') {
          serviceCounts.available += 1
          continue
        }

        if (vehicle.operationalStatus === 'MAINTENANCE') {
          serviceCounts.maintenance += 1
          continue
        }

        const kind = serviceKindText(vehicle, member)
        if (kind === 'DISTRIBUTION') serviceCounts.distribution += 1
        if (kind === 'TRANSFER') serviceCounts.transfer += 1
        if (kind === 'COLLECTION') serviceCounts.collection += 1
      }

      return {
        ...branch,
        total: branchMembers.length,
        serviceCounts
      }
    })
  }, [vehicles, mappingMembers])

  return (
    <div className="branch-overview branch-overview-tv">
      <div className="branch-top-shell">
        <header className="branch-top branch-top-tv">
          <div className="branch-brand">
            <img src="/transmassa-logo.png" alt="Transmassa"/>
            <div>
              <span>GESTÃO À VISTA · {session.user.name.toUpperCase()}</span>
              <h1>Visão por filial</h1>
            </div>
          </div>
          <div className="branch-actions">
            <button onClick={onGroups}><Settings2/>Mapeamento</button>
            <button onClick={onRefresh}><RefreshCw className={loading ? 'spin' : ''}/>Atualizar</button>
            <button onClick={onLogout}><LogOut/>Sair</button>
          </div>
        </header>
      </div>

      {error && <div className="error branch-error"><AlertTriangle/>{error}</div>}

      <main className="branch-grid branch-grid-tv">
        {branchRows.map((branch, index) => (
          <motion.button
            key={branch.code}
            className="branch-card branch-card-tv"
            onClick={() => onOpen(branch.code)}
            disabled={!mappingReady || loading}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .08 + index * .07, duration: .35 }}
            whileHover={{ scale: 1.006 }}
            whileTap={{ scale: .992 }}
          >
            <div className="branch-card-head branch-card-head-tv">
              <img className="branch-icon-img" src={branchIconSrc(branch.code)} alt={branch.name}/>
              <div>
                <h2>{branch.name}</h2>
                <p><MapPin/>{branch.location}</p>
              </div>
              <ArrowRight className="branch-arrow"/>
            </div>

            <section className="branch-service-board branch-service-board-tv">
              <article className="total">
                <Truck/>
                <span>Total</span>
                <strong>{mappingReady ? branch.total : '—'}</strong>
              </article>
              <article className="available">
                <Truck/>
                <span>Disponíveis</span>
                <strong>{branch.serviceCounts.available}</strong>
              </article>
              <article className="collection">
                <PackageCheck/>
                <span>Coleta</span>
                <strong>{branch.serviceCounts.collection}</strong>
              </article>
              <article className="distribution">
                <Route/>
                <span>Distribuição/Lotação</span>
                <strong>{branch.serviceCounts.distribution}</strong>
              </article>
              <article className="transfer">
                <ArrowRight/>
                <span>Transferência</span>
                <strong>{branch.serviceCounts.transfer}</strong>
              </article>
              <article className="maintenance">
                <Wrench/>
                <span>Manutenção</span>
                <strong>{branch.serviceCounts.maintenance}</strong>
              </article>
            </section>
          </motion.button>
        ))}
        <div className="branch-card branch-card-tv branch-card-empty-tv" aria-hidden="true"/>
      </main>
    </div>
  )
}

function ManagementCard({
  label,
  total,
  active,
  breakdown,
  onClick
}: {
  label: string
  total: number
  active: boolean
  breakdown?: Array<{ label: string; total: number }>
  onClick: () => void
}) {
  return (
    <motion.button
      layout
      className={`management-card ${active ? 'active' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      <span>{label}</span>
      <strong>{total}</strong>
      {!!breakdown?.length && (
        <div className="card-breakdown">
          {breakdown.slice(0, 5).map(item => (
            <small key={item.label}>{item.label} <b>{item.total}</b></small>
          ))}
        </div>
      )}
    </motion.button>
  )
}

function Panel({
  session,
  onLogout
}: {
  session: Session
  onLogout: () => void
}) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'' | OperationalStatus>('')
  const [ownership, setOwnership] = useState<'' | 'OWN' | 'THIRD_PARTY'>('')
  const [service, setService] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openPlate, setOpenPlate] = useState<string | null>(null)
  const [view, setView] = useState<'branches' | 'panel' | 'groups'>('branches')
  const [mappingGroups, setMappingGroups] = useState<FleetMappingGroup[]>([])
  const [mappingMembers, setMappingMembers] = useState<FleetMappingMember[]>([])
  const [mappingGroupId, setMappingGroupId] = useState<'total' | number>('total')
  const [mappingBase, setMappingBase] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      setError('')
      setData(await getOverview())
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Erro ao carregar painel')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = window.setInterval(() => load(true), 60000)
    return () => window.clearInterval(interval)
  }, [])

  async function loadMapping(preferredGroupId?: number) {
    try {
      const groups = await getFleetMappingGroups()
      setMappingGroups(groups)

      const realGroups = groups.filter(group => group.id !== 'total')
      const preferred = preferredGroupId
        ? realGroups.find(group => Number(group.id) === preferredGroupId)
        : undefined
      const consolidated = realGroups.find(group => group.slug === 'grupo-consolidado-alexandre')
      const selected = preferred || consolidated || realGroups[0]

      if (!selected) {
        setMappingGroupId('total')
        setMappingMembers([])
        return
      }

      const selectedId = Number(selected.id)
      setMappingGroupId(selectedId)
      const response = await getFleetMappingMembers(selectedId)
      setMappingMembers(response.members || [])
    } catch (err) {
      console.error('FLEET MAPPING LOAD:', err)
      setMappingGroups([])
      setMappingMembers([])
    }
  }

  useEffect(() => {
    loadMapping()
  }, [])

  useEffect(() => {
    if (mappingGroupId === 'total') return
    getFleetMappingMembers(Number(mappingGroupId))
      .then(r => setMappingMembers(r.members || []))
      .catch(() => setMappingMembers([]))
  }, [mappingGroupId])

  const mappingPlateSet = useMemo(
    () => new Set(mappingMembers.map(m => String(m.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))),
    [mappingMembers]
  )
  const mappingByPlate = useMemo(
    () => new Map(mappingMembers.map(m => [String(m.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), m])),
    [mappingMembers]
  )
  const mappingBaseByPlate = useMemo(
    () => new Map(mappingMembers.map(m => [String(m.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), m.base_code || ''])),
    [mappingMembers]
  )
  const mappingBases = useMemo(
    () => [...new Set(mappingMembers.map(m => m.base_code).filter((v): v is string => Boolean(v)))].sort(),
    [mappingMembers]
  )

  const operationalByPlate = useMemo(
    () => new Map((data?.vehicles || []).map(vehicle => [cleanVehiclePlate(vehicle.plate), vehicle])),
    [data]
  )

  const effectiveVehicles = useMemo<Vehicle[]>(() => {
    if (mappingGroupId === 'total') return data?.vehicles || []

    return mappingMembers.map(mapping => {
      const plate = cleanVehiclePlate(mapping.plate)
      const operational = operationalByPlate.get(plate)
      if (operational) return operational

      // Placa existe na frota definida, mas ainda não apareceu no recorte
      // operacional. Mantemos visível como disponível, sem inventar manifesto.
      return {
        plate,
        vehicleType: mapping.vehicle_type || 'Não identificado',
        fleetSource: 'FLEET_MAPPING',
        operationalStatus: 'AVAILABLE',
        ownership: mapping.ownership === 'THIRD_PARTY' ? 'THIRD_PARTY' : 'OWN',
        thirdPartyName: mapping.third_party_name || mapping.owner_code || '',
        capacityKg: 0,
        loadKg: 0,
        utilizationPercent: null,
        manifest: null,
        maintenance: null
      } as Vehicle
    })
  }, [data, mappingGroupId, mappingMembers, operationalByPlate])

  const types = useMemo(() => {
    const set = new Set(effectiveVehicles.map(v => vehicleTypeText(v, mappingByPlate.get(cleanVehiclePlate(v.plate)))))
    return [...set].sort()
  }, [effectiveVehicles, mappingByPlate])

  useEffect(() => {
    // Sempre sincroniza o filtro de tipos quando o universo muda.
    // Isso é importante quando o mapeamento termina de carregar e troca,
    // por exemplo, "Cavalo" por "Cavalo Mecânico". Sem isso o filtro antigo
    // pode eliminar todas as linhas do grupo.
    setSelectedTypes(types)
  }, [types.join('|'), mappingGroupId])

  useEffect(() => {
    // Primeira carga: todos os tipos ficam selecionados. Antes o estado começava
    // vazio e o filtro removia 100% da frota da tabela.
    if (types.length > 0 && selectedTypes.length === 0) {
      setSelectedTypes(types)
    }
  }, [types])

  const services = useMemo(() => {
    return [...new Set(
      effectiveVehicles
        .map(v => serviceText(v, mappingByPlate.get(cleanVehiclePlate(v.plate))))
        .filter((value): value is string => Boolean(value))
    )].sort()
  }, [effectiveVehicles, mappingByPlate])

  // Base dos KPIs:
  // aplica TODOS os filtros ativos (tipo, vínculo, serviço e busca),
  // mas NÃO aplica o filtro de status. Assim os cards gerais mudam com
  // os filtros e continuam permitindo trocar de status sem "zerar" os demais.
  const kpiRows = useMemo(() => {
    const q = query.trim().toLowerCase()

    return effectiveVehicles.filter(vehicle => {
      const mapping = mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
      const effectiveType = vehicleTypeText(vehicle, mapping)

      // Tipo/categoria vem do SQL no overview.
      if (selectedTypes.length > 0 && !selectedTypes.includes(effectiveType)) return false

      // Grupo/base vêm do mapeamento Alexandre.
      if (mappingGroupId !== 'total' && !mappingPlateSet.has(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) return false
      if (mappingBase) {
        const selectedBranch = canonicalBranchCode(mappingBase)
        const vehicleBase = mappingBaseByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
        if (selectedBranch ? !belongsToBranch(vehicleBase, selectedBranch) : vehicleBase !== mappingBase) return false
      }

      if (ownership && effectiveOwnership(vehicle, mapping) !== ownership) return false
      if (service && serviceText(vehicle, mapping) !== service) return false

      if (!q) return true

      return [
        vehicle.plate,
        effectiveType,
        effectiveThirdPartyName(vehicle, mapping),
        vehicle.manifest?.numero,
        driverText(vehicle, mapping),
        vehicle.manifest?.service,
        serviceText(vehicle, mapping),
        mapping?.notes,
        vehicle.manifest?.transferDestination,
        ...(vehicle.manifest?.trailers || []),
        vehicle.maintenance?.serviceOrderId
      ].some(value => String(value || '').toLowerCase().includes(q))
    })
  }, [effectiveVehicles, selectedTypes, ownership, service, query, mappingGroupId, mappingPlateSet, mappingBaseByPlate, mappingBase, mappingByPlate])

  // A tabela recebe também o foco do status selecionado.
  const rows = useMemo(() => {
    if (!status) return kpiRows
    return kpiRows.filter(vehicle => vehicle.operationalStatus === status)
  }, [kpiRows, status])

  // KPIs e subdivisões calculados NO FRONT sobre o universo filtrado.
  // Portanto qualquer alteração em Tipo / Próprio-Terceiro / Serviço / Busca
  // atualiza imediatamente os números grandes.
  const dynamicCounts = useMemo(() => ({
    total: kpiRows.length,
    available: kpiRows.filter(v => v.operationalStatus === 'AVAILABLE').length,
    committed: kpiRows.filter(v => v.operationalStatus === 'COMMITTED').length,
    inTransit: kpiRows.filter(v => v.operationalStatus === 'IN_TRANSIT').length,
    maintenance: kpiRows.filter(v => v.operationalStatus === 'MAINTENANCE').length
  }), [kpiRows])

  const dynamicBreakdowns = useMemo(() => {
    function byType(targetStatus: OperationalStatus) {
      const counts = new Map<string, number>()
      for (const vehicle of kpiRows.filter(v => v.operationalStatus === targetStatus)) {
        const key = vehicleTypeText(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))
        counts.set(key, (counts.get(key) || 0) + 1)
      }
      return [...counts.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
    }

    function byService(targetStatus: OperationalStatus) {
      const counts = new Map<string, number>()
      for (const vehicle of kpiRows.filter(v => v.operationalStatus === targetStatus)) {
        const key = serviceText(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))
        counts.set(key, (counts.get(key) || 0) + 1)
      }
      return [...counts.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
    }

    return {
      available: byType('AVAILABLE'),
      committed: byType('COMMITTED'),
      inTransit: byService('IN_TRANSIT'),
      maintenance: kpiRows
        .filter(v => v.operationalStatus === 'MAINTENANCE')
        .map(v => ({ label: v.plate, total: 1 }))
    }
  }, [kpiRows, mappingByPlate])

  useEffect(() => {
    setPage(1)
  }, [status, selectedTypes.join('|'), ownership, service, query, mappingGroupId, mappingBase])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (view === 'groups') {
    return (
      <FleetGroupsPage
        user={session.user}
        onBack={() => {
          setView('branches')
          load()
          loadMapping(mappingGroupId === 'total' ? undefined : Number(mappingGroupId))
        }}
        onUseMapping={(groupId, baseCode='') => {
          setMappingGroupId(groupId)
          setMappingBase(baseCode)
          setView('panel')
          setPage(1)
        }}
      />
    )
  }

  if (view === 'branches') {
    return (
      <BranchOverview
        session={session}
        vehicles={effectiveVehicles}
        loading={loading}
        error={error}
        mappingByPlate={mappingByPlate}
        mappingMembers={mappingMembers}
        mappingReady={mappingGroupId !== 'total' && mappingMembers.length > 0}
        onOpen={branch => {
          setMappingBase(branch)
          setOwnership('OWN')
          setStatus('')
          setService('')
          setPage(1)
          setView('panel')
        }}
        onRefresh={() => {
          load()
          loadMapping(mappingGroupId === 'total' ? undefined : Number(mappingGroupId))
        }}
        onGroups={() => setView('groups')}
        onLogout={onLogout}
      />
    )
  }


  return (
    <div className="tv-app">
      <motion.header
        className="top"
        initial={{ opacity: 0, y: -22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="brand-area">
          <img src="/transmassa-logo.png" alt="Transmassa"/>
          <div>
            <span className="eyebrow">TRANSMASSA · {session.user.name.toUpperCase()}</span>
            <h1>Gestão à vista da frota</h1>
            <p>Recorte: {mappingGroupId === 'total' ? 'Total' : (mappingGroups.find(g => g.id === mappingGroupId)?.name || 'Grupo mapeado')}{mappingBase ? ` · ${branchTitle(mappingBase)}` : ''} · 50 veículos por página</p>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={() => setView('branches')}>← Filiais</button>
          <a href="/historico-carretas" target="_blank" rel="noreferrer">Cavalos / carretas</a>
          <a href="/historico-os" target="_blank" rel="noreferrer">Histórico OS</a>
          <button onClick={() => setView('groups')}><Settings2/>Grupos de frota</button>
          <button onClick={() => load()}><RefreshCw className={loading ? 'spin' : ''}/>Atualizar</button>
          <button onClick={onLogout}><LogOut/>Sair</button>
        </div>
      </motion.header>

      {error && <div className="error"><AlertTriangle/>{error}</div>}

      <motion.div
        className="filters"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.32 }}
      >
        <div className="search">
          <Search/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Placa, motorista, manifesto, terceiro, OS..."
          />
        </div>

        <div className="filter-control">
          <Filter/>
          <select value={status} onChange={e => setStatus(e.target.value as '' | OperationalStatus)}>
            <option value="">Todos status</option>
            <option value="AVAILABLE">Disponível</option>
            <option value="COMMITTED">Contratado</option>
            <option value="IN_TRANSIT">Em movimento</option>
            <option value="MAINTENANCE">Manutenção</option>
          </select>
        </div>

        <select
          value={String(mappingGroupId)}
          onChange={e => {
            const value = e.target.value
            setMappingGroupId(value === 'total' ? 'total' : Number(value))
            setMappingBase('')
          }}
          title="Grupo do mapeamento"
        >
          <option value="total">Total</option>
          {mappingGroups.filter(g => g.id !== 'total').map(g => (
            <option key={String(g.id)} value={String(g.id)}>{g.name}</option>
          ))}
        </select>

        <select
          value={mappingBase}
          onChange={e => setMappingBase(e.target.value)}
          disabled={mappingGroupId === 'total'}
          title="Filial/base do mapeamento"
        >
          <option value="">Todas filiais</option>
          {BRANCHES.map(branch => (
            <option key={branch.code} value={branch.code}>{branch.code} · {branch.name}</option>
          ))}
          {mappingBases.filter(base => !canonicalBranchCode(base)).map(base => (
            <option key={base} value={base}>{base}</option>
          ))}
        </select>

        <TypeMultiSelect
          types={types}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

        <select value={ownership} onChange={e => setOwnership(e.target.value as '' | 'OWN' | 'THIRD_PARTY')}>
          <option value="">Próprio + Terceiro</option>
          <option value="OWN">Próprio</option>
          <option value="THIRD_PARTY">Terceiro</option>
        </select>

        <select value={service} onChange={e => setService(e.target.value)}>
          <option value="">Todos serviços</option>
          {services.map(item => <option key={item}>{item}</option>)}
        </select>

        <strong>{rows.length} veículos</strong>
      </motion.div>

      <section className={`fleet-table ${status === '' ? 'compact-mode' : 'focus-mode'}`}>
        <div className="fleet-head">
          <span></span>
          <span>Status</span>
          <span>Veículo</span>
          <span>Tipo</span>
          <span>Carreta(s)</span>
          <span>Vínculo</span>
          <span>Motorista / OS</span>
          <span>Manifesto</span>
          <span>Operação</span>
          <span>Destino / Base</span>
          <span>Tempo desde a saída</span>
          <span>Carga / capacidade</span>
        </div>

        <AnimatePresence mode="popLayout">
        {pageRows.map(vehicle => {
          const isOpen = openPlate === vehicle.plate
          const manifest = vehicle.manifest
          const maintenance = vehicle.maintenance

          return (
            <motion.div
              layout
              className="vehicle-block"
              key={vehicle.plate}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`fleet-row s-${vehicle.operationalStatus.toLowerCase()}`}>
                <button
                  className="expand-btn"
                  onClick={(e) => { e.stopPropagation(); setOpenPlate(isOpen ? null : vehicle.plate) }}
                >
                  {isOpen ? <ChevronUp/> : <ChevronDown/>}
                </button>

                <StatusBadge status={vehicle.operationalStatus}/>
                <strong className="row-plate">{vehicle.plate}</strong>
                <span>{vehicleTypeText(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))}</span>
                <span className="trailers-cell">{trailersText(vehicle)}</span>

                <span className={effectiveOwnership(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) === 'THIRD_PARTY' ? 'third-party' : 'own-fleet'}>
                  {effectiveOwnership(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) === 'THIRD_PARTY'
                    ? `Terceiro · ${effectiveThirdPartyName(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) || '—'}`
                    : 'Próprio'}
                </span>

                <span>
                  {vehicle.operationalStatus === 'MAINTENANCE'
                    ? `OS ${maintenance?.serviceOrderId || '—'}`
                    : driverText(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))}
                </span>

                <span>{vehicle.operationalStatus === 'MAINTENANCE' ? '—' : (manifest?.numero || '—')}</span>
                <span>{vehicle.operationalStatus === 'MAINTENANCE' ? (maintenance?.type || 'Manutenção') : serviceText(vehicle, mappingByPlate.get(String(vehicle.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))}</span>
                <span
                  className="destination"
                  title={(manifest?.operationContext?.details || []).join(' • ')}
                >
                  {destinationText(vehicle)}
                </span>

                <strong className={vehicle.operationalStatus === 'IN_TRANSIT' && !manifest?.saida ? 'missing-time' : ''}>
                  {vehicle.operationalStatus === 'IN_TRANSIT'
                    ? elapsed(manifest?.saida)
                    : vehicle.operationalStatus === 'COMMITTED'
                      ? 'Aguardando saída'
                      : '—'}
                </strong>

                <div className="capacity-cell">
                  {vehicle.capacityKg > 0
                    ? <>
                        <div className="capacity-main">
                          <strong>{kgText(vehicle.loadKg)}</strong>
                          <span>/ {kgText(vehicle.capacityKg)}</span>
                        </div>
                        <div className="capacity-bar">
                          <i style={{ width: `${Math.min(100, Math.max(0, vehicle.utilizationPercent || 0))}%` }}/>
                        </div>
                        <small>{vehicle.utilizationPercent ?? 0}%</small>
                      </>
                    : <div className="capacity-unknown">
                        <strong>{kgText(vehicle.loadKg)}</strong>
                        <span>/ Total não cadastrado</span>
                      </div>
                  }
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="details"
                    className="expanded-row"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <ExpandedRow vehicle={vehicle}/>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
        </AnimatePresence>
      </section>


      <footer className="pager">
        <span>
          Mostrando {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, rows.length)} de {rows.length}
        </span>
        <div>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <strong>{page} / {pages}</strong>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</button>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  // Nenhuma tela do sistema é montada antes de a autenticação ser validada.
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true

    const expire = () => {
      localStorage.removeItem(TOKEN_KEY)
      if (alive) {
        setSession(null)
        setChecking(false)
      }
    }

    window.addEventListener('transmassa-auth-expired', expire)

    const validateSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY)

      if (!token) {
        if (alive) {
          setSession(null)
          setChecking(false)
        }
        return
      }

      try {
        const data = await me()
        if (alive) setSession(data)
      } catch {
        // Token inválido/expirado (ou sessão impossível de validar): volta ao login.
        localStorage.removeItem(TOKEN_KEY)
        if (alive) setSession(null)
      } finally {
        if (alive) setChecking(false)
      }
    }

    validateSession()

    return () => {
      alive = false
      window.removeEventListener('transmassa-auth-expired', expire)
    }
  }, [])

  // O login é sempre a porta de entrada, inclusive nas rotas auxiliares.
  if (checking) return <div className="loading-page"><Activity className="spin"/>Validando acesso...</div>
  if (!session) return <LoginPage onLogin={setSession}/>

  if (isCouplingPage) return <CouplingPage/>
  if (isOsHistoryPage) return <ServiceOrderHistoryPage/>

  return (
    <Panel
      session={session}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY)
        setSession(null)
      }}
    />
  )
}
