import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  LogOut,
  RefreshCw,
  Search,
  Settings2
} from 'lucide-react'
import LoginPage from './components/LoginPage'
import CouplingPage from './components/CouplingPage'
import ServiceOrderHistoryPage from './components/ServiceOrderHistoryPage'
import FleetGroupsPage from './components/FleetGroupsPage'
import StatusBadge from './components/StatusBadge'
import TypeMultiSelect from './components/TypeMultiSelect'
import ExpandedRow from './components/ExpandedRow'
import { VehicleIntelligenceDrawer } from './components/FleetAnalytics'
import { getFleetMappingGroups, getFleetMappingMembers, getOverview, me, TOKEN_KEY } from './services/api'
import type { FleetMappingGroup, FleetMappingMember, OperationalStatus, Overview, Session, Vehicle } from './types'

const PAGE_SIZE = 50
const cleanPath = window.location.pathname.replace(/\/+$/, '')
const isCouplingPage = cleanPath === '/acoplamentos' || cleanPath === '/historico-carretas'
const isOsHistoryPage = cleanPath === '/historico-os'

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
  const [view, setView] = useState<'panel' | 'groups'>('panel')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
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

  useEffect(() => {
    getFleetMappingGroups().then(setMappingGroups).catch(() => setMappingGroups([]))
  }, [])

  useEffect(() => {
    if (mappingGroupId === 'total') {
      setMappingMembers([])
      setMappingBase('')
      return
    }
    getFleetMappingMembers(Number(mappingGroupId))
      .then(r => setMappingMembers(r.members || []))
      .catch(() => setMappingMembers([]))
  }, [mappingGroupId])

  const mappingPlateSet = useMemo(
    () => new Set(mappingMembers.map(m => m.plate)),
    [mappingMembers]
  )
  const mappingBaseByPlate = useMemo(
    () => new Map(mappingMembers.map(m => [m.plate, m.base_code || ''])),
    [mappingMembers]
  )
  const mappingBases = useMemo(
    () => [...new Set(mappingMembers.map(m => m.base_code).filter((v): v is string => Boolean(v)))].sort(),
    [mappingMembers]
  )

  const types = useMemo(() => {
    const set = new Set((data?.vehicles || []).map(v => v.vehicleType || 'Não identificado'))
    return [...set].sort()
  }, [data])

  useEffect(() => {
    if (types.length && selectedTypes.length === 0) {
      setSelectedTypes(types)
    }
  }, [types.join('|')])

  const services = useMemo(() => {
    return [...new Set(
      (data?.vehicles || [])
        .map(v => v.manifest?.service)
        .filter((value): value is string => Boolean(value))
    )].sort()
  }, [data])

  // Base dos KPIs:
  // aplica TODOS os filtros ativos (tipo, vínculo, serviço e busca),
  // mas NÃO aplica o filtro de status. Assim os cards gerais mudam com
  // os filtros e continuam permitindo trocar de status sem "zerar" os demais.
  const kpiRows = useMemo(() => {
    const q = query.trim().toLowerCase()

    return (data?.vehicles || []).filter(vehicle => {
      const vehicleType = vehicle.vehicleType || 'Não identificado'

      // Tipo/categoria vem do SQL no overview.
      if (!selectedTypes.includes(vehicleType)) return false

      // Grupo/base vêm do mapeamento Alexandre.
      if (mappingGroupId !== 'total' && !mappingPlateSet.has(vehicle.plate)) return false
      if (mappingBase && mappingBaseByPlate.get(vehicle.plate) !== mappingBase) return false

      if (ownership && vehicle.ownership !== ownership) return false
      if (service && vehicle.manifest?.service !== service) return false

      if (!q) return true

      return [
        vehicle.plate,
        vehicle.vehicleType,
        vehicle.thirdPartyName,
        vehicle.manifest?.numero,
        vehicle.manifest?.motorista,
        vehicle.manifest?.service,
        vehicle.manifest?.transferDestination,
        ...(vehicle.manifest?.trailers || []),
        vehicle.maintenance?.serviceOrderId
      ].some(value => String(value || '').toLowerCase().includes(q))
    })
  }, [data, selectedTypes, ownership, service, query, mappingGroupId, mappingPlateSet, mappingBaseByPlate, mappingBase])

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
        const key = vehicle.vehicleType || 'Não identificado'
        counts.set(key, (counts.get(key) || 0) + 1)
      }
      return [...counts.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
    }

    function byService(targetStatus: OperationalStatus) {
      const counts = new Map<string, number>()
      for (const vehicle of kpiRows.filter(v => v.operationalStatus === targetStatus)) {
        const key = vehicle.manifest?.service || 'Sem serviço'
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
  }, [kpiRows])

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
          setView('panel')
          load()
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
            <p>Recorte: {mappingGroupId === 'total' ? 'Total' : (mappingGroups.find(g => g.id === mappingGroupId)?.name || 'Grupo mapeado')}{mappingBase ? ` · ${mappingBase}` : ''} · 50 veículos por página</p>
          </div>
        </div>

        <div className="header-actions">
          <a href="/historico-carretas" target="_blank" rel="noreferrer">Cavalos / carretas</a>
          <a href="/historico-os" target="_blank" rel="noreferrer">Histórico OS</a>
          <button onClick={() => setView('groups')}><Settings2/>Grupos de frota</button>
          <button onClick={() => load()}><RefreshCw className={loading ? 'spin' : ''}/>Atualizar</button>
          <button onClick={onLogout}><LogOut/>Sair</button>
        </div>
      </motion.header>

      {error && <div className="error"><AlertTriangle/>{error}</div>}

      <section className="management-kpis">
        <ManagementCard
          label="Todos"
          total={dynamicCounts.total}
          active={status === ''}
          onClick={() => setStatus('')}
        />
        <ManagementCard
          label="Disponíveis"
          total={dynamicCounts.available}
          active={status === 'AVAILABLE'}
          breakdown={dynamicBreakdowns.available}
          onClick={() => setStatus(status === 'AVAILABLE' ? '' : 'AVAILABLE')}
        />
        <ManagementCard
          label="Empenhados"
          total={dynamicCounts.committed}
          active={status === 'COMMITTED'}
          breakdown={dynamicBreakdowns.committed}
          onClick={() => setStatus(status === 'COMMITTED' ? '' : 'COMMITTED')}
        />
        <ManagementCard
          label="Em movimento"
          total={dynamicCounts.inTransit}
          active={status === 'IN_TRANSIT'}
          breakdown={dynamicBreakdowns.inTransit}
          onClick={() => setStatus(status === 'IN_TRANSIT' ? '' : 'IN_TRANSIT')}
        />
        <ManagementCard
          label="Manutenção"
          total={dynamicCounts.maintenance}
          active={status === 'MAINTENANCE'}
          breakdown={dynamicBreakdowns.maintenance}
          onClick={() => setStatus(status === 'MAINTENANCE' ? '' : 'MAINTENANCE')}
        />
      </section>

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
            <option value="COMMITTED">Empenhado</option>
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
          {mappingBases.map(base => <option key={base} value={base}>{base}</option>)}
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
              <div className={`fleet-row s-${vehicle.operationalStatus.toLowerCase()} clickable-row`} onClick={() => setSelectedVehicle(vehicle)} title="Clique para abrir o histórico completo deste veículo">
                <button
                  className="expand-btn"
                  onClick={(e) => { e.stopPropagation(); setOpenPlate(isOpen ? null : vehicle.plate) }}
                >
                  {isOpen ? <ChevronUp/> : <ChevronDown/>}
                </button>

                <StatusBadge status={vehicle.operationalStatus}/>
                <strong className="row-plate">{vehicle.plate}</strong>
                <span>{vehicle.vehicleType || 'Não identificado'}</span>
                <span className="trailers-cell">{trailersText(vehicle)}</span>

                <span className={vehicle.ownership === 'THIRD_PARTY' ? 'third-party' : 'own-fleet'}>
                  {vehicle.ownership === 'THIRD_PARTY'
                    ? `Terceiro · ${vehicle.thirdPartyName || '—'}`
                    : 'Próprio'}
                </span>

                <span>
                  {vehicle.operationalStatus === 'MAINTENANCE'
                    ? `OS ${maintenance?.serviceOrderId || '—'}`
                    : (manifest?.motorista || '—')}
                </span>

                <span>{vehicle.operationalStatus === 'MAINTENANCE' ? '—' : (manifest?.numero || '—')}</span>
                <span>{vehicle.operationalStatus === 'MAINTENANCE' ? (maintenance?.type || 'Manutenção') : (manifest?.service || 'Livre')}</span>
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

      <VehicleIntelligenceDrawer vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />

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
  const [checking, setChecking] = useState(!(isCouplingPage || isOsHistoryPage) && Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (isCouplingPage || isOsHistoryPage) return

    let alive = true
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      setChecking(false)
      return
    }

    me()
      .then(data => alive && setSession(data))
      .catch(() => undefined)
      .finally(() => alive && setChecking(false))

    const expire = () => {
      localStorage.removeItem(TOKEN_KEY)
      setSession(null)
    }

    window.addEventListener('transmassa-auth-expired', expire)
    return () => {
      alive = false
      window.removeEventListener('transmassa-auth-expired', expire)
    }
  }, [])

  if (isCouplingPage) return <CouplingPage/>
  if (isOsHistoryPage) return <ServiceOrderHistoryPage/>
  if (checking) return <div className="loading-page"><Activity className="spin"/>Validando acesso...</div>
  if (!session) return <LoginPage onLogin={setSession}/>

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
