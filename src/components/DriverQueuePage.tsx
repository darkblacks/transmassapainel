import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, Plus, Printer, RefreshCw, Search, ShieldAlert, Truck, X, Pencil, MoreHorizontal, Trash2 } from 'lucide-react'
import { api } from '../services/api'


type Branch = 'CLIENTE_RJ' | 'SBC_RJ' | 'CLIENTE_CLIENTE' | 'SBC_CLIENTE' | 'RETORNO_RJ_SP'
type QueueDriver = {
  id: number
  position: number
  name: string
  plate?: string | null
  trailerPlate?: string | null
  branch: string
  lastCommitmentAt?: string | null
  lastManifestNumber?: string | null
}
type Commitment = { driver_id: string | number; actor_email?: string; after_data?: { position?: number; reason?: string | null }; before_data?: { position?: number }; occurred_at: string }
type QueuePayload = { drivers: QueueDriver[]; updatedAt?: string | null }
type FleetVehicle = { plate: string; ownerCode: string | null; ownerLabel: string; ownership: 'OWN' | 'THIRD_PARTY' }
type DriverSuggestion = { name: string; plate?: string | null }
type LastManifest = { id: number; number?: string | number | null; driverName?: string; plate?: string | null; date?: string | null }
const BRANCHES: { code: Branch; name: string }[] = [
  { code: 'CLIENTE_RJ', name: 'Cliente x RJ — Coleta e Entrega' },
  { code: 'SBC_RJ', name: 'Base SBC x RJ — Coleta e Entrega' },
  { code: 'CLIENTE_CLIENTE', name: 'Cliente x Cliente — Dedicado' },
  { code: 'SBC_CLIENTE', name: 'Base SBC x Cliente — SP' },
  { code: 'RETORNO_RJ_SP', name: 'Retorno x RJ x SP' }
]
function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR')
}
function errorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { status?: number; data?: { message?: string | string[] } }; message?: string }
  if (err?.response?.status === 404) return 'A rota da fila ainda não está ativa na API. Verifique a migração e o restart do NestJS.'
  if (err?.response?.status === 403) return 'Seu usuário não possui permissão administrativa para alterar a escala.'
  const message = err?.response?.data?.message
  return Array.isArray(message) ? message.join(' · ') : message || err?.message || fallback
}

export default function DriverQueuePage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<QueuePayload>({ drivers: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [branch, setBranch] = useState<Branch>('CLIENTE_RJ')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<'add' | 'move' | 'confirm' | 'end' | 'vehicles' | 'delete' | null>(null)
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [openActions, setOpenActions] = useState<number | null>(null)
  const [fleet, setFleet] = useState<Record<string, FleetVehicle>>({})
  const [trailPlate, setTrailPlate] = useState('')
  const [selected, setSelected] = useState<QueueDriver | null>(null)
  const [newPosition, setNewPosition] = useState('')
  
  const [reason, setReason] = useState('')
  const [newName, setNewName] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([])
  const [suggestionError, setSuggestionError] = useState(false)
  const [lastManifest, setLastManifest] = useState<Record<number, LastManifest | null>>({})
  const [manifestLoading, setManifestLoading] = useState<Record<number, boolean>>({})

  const plateKey = (value?: string | null) => (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const ownership = (plate?: string | null) => {
    const item = fleet[plateKey(plate)]
    return item ? item.ownerLabel : 'Não identificado'
  }
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      const result = await api.get<QueuePayload>('/api/driver-queue')
      if (!Array.isArray(result.data?.drivers)) throw new Error('Resposta da fila inválida')
      setData(result.data)
      try {
        const history = await api.get<{ commitments?: Commitment[] }>('/api/driver-queue/history', { params: { limit: 100 } })
        setCommitments(Array.isArray(history.data?.commitments) ? history.data.commitments : [])
      } catch { setCommitments([]) }
      setError('')
    } catch (err) { setError(errorMessage(err, 'Não foi possível consultar a escala.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void load(true)
    const timer = window.setInterval(() => { if (!document.hidden && !modal) void load() }, 30000)
    return () => window.clearInterval(timer)
  }, [load, modal])

  useEffect(() => {
    let alive = true
    async function loadFleet() {
      try {
        const result = await api.get<{ vehicles: FleetVehicle[] }>('/api/driver-queue/fleet-lookup')
        if (!alive) return
        setFleet(Object.fromEntries((result.data?.vehicles || []).map(m => [plateKey(m.plate), m])))
      } catch { if (alive) setFleet({}) }
    }
    void loadFleet()
    return () => { alive = false }
  }, [])
  // Suggestions are never required for registration: ESL is an optional read-only helper.
  useEffect(() => {
    if (modal !== 'add' || newName.trim().length < 2) { setSuggestions([]); setSuggestionError(false); return }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.get<{ suggestions: DriverSuggestion[] }>('/api/driver-queue/suggestions', { params: { q: newName.trim() } })
        if (!cancelled) { setSuggestions(result.data?.suggestions || []); setSuggestionError(false) }
      } catch { if (!cancelled) { setSuggestions([]); setSuggestionError(true) } }
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [newName, modal])

  const ordered = useMemo(() => data.drivers.filter(d => d.branch === branch).sort((a, b) => a.position - b.position), [data.drivers, branch])
  const filtered = useMemo(() => ordered.filter(d => `${d.name} ${d.plate || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [ordered, query])
  const recentCommitments = useMemo(() => commitments.filter(c => data.drivers.some(d => String(d.id) === String(c.driver_id) && d.branch === branch)).slice(0, 3), [commitments, data.drivers, branch])
  const branchName = BRANCHES.find(b => b.code === branch)?.name || branch

  async function addDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || newName.trim().length < 2) return
    setBusy(true); setFormError('')
    try {
      await api.post('/api/driver-queue/drivers', { branch, name: newName.trim(), plate: newPlate.trim().toUpperCase(), trailerPlate: trailPlate.trim().toUpperCase() })
      setModal(null); setNewName(''); setNewPlate(''); setTrailPlate(''); setSuggestions([])
      await load()
    } catch (err) { setFormError(errorMessage(err, 'Não foi possível cadastrar o motorista.')) }
    finally { setBusy(false) }
  }
  async function moveDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || busy || (modal !== 'confirm' && reason.trim().length < 10)) return
    const position = modal === 'end' || modal === 'confirm' || modal === 'move' ? ordered.length : Number(newPosition)
    if (!Number.isInteger(position) || position < 1 || position > ordered.length) { setFormError('Posição inválida.'); return }
    setBusy(true); setFormError('')
    try {
      await api.post('/api/driver-queue/move', { driverId: selected.id, position, reason: reason.trim(), kind: modal === 'end' ? 'FIM' : 'EMPenho' })
      setModal(null); setSelected(null); setReason(''); setNewPosition('')
      await load()
    } catch (err) { setFormError(errorMessage(err, 'Não foi possível ajustar a ordem.')) }
    finally { setBusy(false) }
  }
  async function updateVehicles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true); setFormError('')
    try {
      await api.post('/api/driver-queue/vehicles', {driverId:selected.id,plate:newPlate,trailerPlate:trailPlate})
      setModal(null); setSelected(null); await load()
    } catch (err) { setFormError(errorMessage(err, 'Não foi possível alterar as placas.')) }
    finally {setBusy(false)}
  }
  function empenhar(driver: QueueDriver) {
    if (busy) return
    setSelected(driver)
    setOpenActions(null)
    setNewPosition(String(ordered.length))
    setReason('')
    setFormError('')
    setModal(driver.position === 1 ? 'confirm' : 'move')
  }
  async function deleteDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || busy) return
    setBusy(true); setFormError('')
    try {
      await api.delete(`/api/driver-queue/drivers/${selected.id}`)
      setModal(null); setSelected(null); setOpenActions(null)
      await load()
    } catch (err) { setFormError(errorMessage(err, 'Não foi possível excluir o motorista da fila.')) }
    finally { setBusy(false) }
  }
  function sendToEnd(driver: QueueDriver) {
    if (busy) return
    setSelected(driver)
    setNewPosition(String(ordered.length))
    setReason('')
    setFormError('')
    setModal('end')
  }
  async function showManifest(driver: QueueDriver) {
    if (manifestLoading[driver.id]) return
    setManifestLoading(prev => ({ ...prev, [driver.id]: true }))
    try {
      const result = await api.get<{ manifest: LastManifest | null }>('/api/driver-queue/last-manifest', { params: { name: driver.name } })
      setLastManifest(prev => ({ ...prev, [driver.id]: result.data?.manifest ?? null }))
    } catch { setLastManifest(prev => ({ ...prev, [driver.id]: null })) }
    finally { setManifestLoading(prev => ({ ...prev, [driver.id]: false })) }
  }
  function printScale() {
    // Print the complete branch queue. Search never changes the printable scale.
    window.print()
  }
  function closeModal() { if (!busy) { setModal(null); setFormError('') } }
  return <div className="history-page queue-page">
    <header className="coupling-hero queue-screen-only">
      <div className="brand-area"><img src="/transmassa-logo.png" alt="Transmassa"/><div><span>TRANSMASSA · TORRE DE CONTROLE</span><h1>Escala de motoristas</h1><p>Organize a ordem manualmente. Nenhum serviço altera esta escala automaticamente.</p></div></div>
      <div className="queue-actions"><button onClick={onBack}><ArrowLeft/> Voltar</button><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''}/> Atualizar</button></div>
    </header>
    <main className="history-content">
      <div className="queue-masthead queue-screen-only"><div><span className="eyebrow">ESCALA MANUAL</span><h2>Ordem de atendimento</h2><p>Cadastre motoristas e empenhe na ordem da fila. Justificativa só é exigida ao empenhar fora da vez.</p></div><div className="queue-masthead-meta"><Clock3/><span>Última consulta<strong>{formatDate(data.updatedAt)}</strong></span></div></div>
      <div className="queue-tools queue-screen-only">
        <div className="queue-branch-switch">{BRANCHES.map(b => <button key={b.code} title={b.name} className={branch === b.code ? 'active' : ''} onClick={() => {setBranch(b.code);setOpenActions(null)}}>{b.name}</button>)}</div>
        <label className="queue-search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nome ou placa"/></label>

        <button className="queue-primary" onClick={() => { setModal('add'); setNewName(''); setNewPlate(''); setTrailPlate(''); setFormError('') }}><Plus/> Adicionar motorista</button>
        <button className="queue-print" onClick={printScale} disabled={loading || !!error || !ordered.length}><Printer/> Imprimir A4</button>
      </div>
      {error && <div className="queue-alert queue-screen-only"><ShieldAlert/><div><strong>Não foi possível carregar a fila</strong><p>{error}</p></div></div>}
      <div className="queue-print-heading"><img src="/transmassa-logo.png" alt="Transmassa"/><div><h1>Escala de Motoristas — {branchName}</h1><p>Emissão: {new Date().toLocaleString('pt-BR')} · {ordered.length} motorista(s)</p></div></div>
      <section className="queue-recent queue-screen-only" aria-label="Últimos três empenhos">
        <div className="queue-recent-title"><span className="eyebrow">HISTÓRICO DE EMPENHOS</span><h3>Últimos 3 empenhados</h3><p>Registros mais recentes desta fila · somente na tela</p></div>
        <div className="queue-recent-list">{recentCommitments.length ? recentCommitments.map((c, i) => {
          const driver = data.drivers.find(d => String(d.id) === String(c.driver_id))
          return <div className="queue-recent-item" key={`${c.driver_id}-${c.occurred_at}-${i}`}><span className="queue-recent-rank">{String(i + 1).padStart(2, '0')}</span><div><strong>{driver?.name || `Motorista #${c.driver_id}`}</strong><small>{driver?.plate || 'Empenho registrado'}</small></div><time dateTime={c.occurred_at}><Clock3/>{formatDate(c.occurred_at)}</time></div>
        }) : <p className="queue-recent-empty">Nenhum empenho encontrado para esta fila no histórico disponível.</p>}</div>
      </section>
      <div className="queue-board">
        <div className="queue-table-head"><span>Posição</span><span>Motorista</span><span>Cavalo / Carro</span><span>Carreta</span><span className="queue-screen-only">Ações</span></div>
        {(error ? [] : ordered).map(driver => <article key={driver.id} className={`queue-driver ${query && !`${driver.name} ${driver.plate || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) ? 'queue-search-hidden' : ''}`}>
          <div className="queue-number">{String(driver.position).padStart(2, '0')}</div>
          <div className="queue-driver-name"><small className="queue-owner">{ownership(driver.plate)}</small><strong>{driver.name}</strong><button type="button" className="queue-screen-only queue-lookup" onClick={() => void showManifest(driver)} disabled={!!manifestLoading[driver.id]}>{manifestLoading[driver.id] ? 'Consultando...' : lastManifest[driver.id] ? `Último manifesto: ${lastManifest[driver.id]?.number ?? lastManifest[driver.id]?.id}` : 'Ver último manifesto'}</button></div>
          <span>{driver.plate || '—'}</span>
          <span>{driver.trailerPlate || '—'}</span>
          <div className="queue-row-actions queue-screen-only">
            <button className="queue-empenhar" onClick={() => empenhar(driver)} disabled={busy} title="Confirmar empenho"><Truck/> Empenhar</button>
            <div className="queue-menu-wrap">
              <button type="button" className="queue-menu-trigger" aria-label={`Ações para ${driver.name}`} aria-expanded={openActions === driver.id} onClick={() => setOpenActions(openActions === driver.id ? null : driver.id)}><MoreHorizontal/></button>
              {openActions === driver.id && <div className="queue-menu" role="menu">
                <button type="button" onClick={() => {setOpenActions(null);setSelected(driver);setNewPlate(driver.plate||'');setTrailPlate(driver.trailerPlate||'');setFormError('');setModal('vehicles')}}><Pencil/> Editar placas</button>
                <button type="button" disabled={driver.position === ordered.length} onClick={() => {setOpenActions(null);sendToEnd(driver)}}><ArrowLeft/> Descer ao fim</button>
                <button type="button" className="queue-menu-danger" onClick={() => {setOpenActions(null);setSelected(driver);setFormError('');setModal('delete')}}><Trash2/> Excluir da fila</button>
              </div>}
            </div>
          </div>
        </article>)}
        {!filtered.length && <div className="queue-empty queue-screen-only">{loading ? 'Carregando a escala...' : error ? 'Ative a rota no backend para consultar a fila.' : query ? 'Nenhum motorista encontrado nessa busca.' : 'Esta fila ainda não possui motoristas. Clique em “Adicionar motorista”.'}</div>}
      </div>
      <p className="queue-footnote queue-screen-only">A escala é manual e fica salva no banco. Motoristas novos entram no final da fila. O último manifesto é apenas informativo e depende do ESL. As placas são editáveis. A página consulta mudanças a cada 30 segundos.</p>
    </main>
    {modal && <div className="queue-modal-backdrop queue-screen-only" onClick={closeModal}><form className="queue-modal" onClick={e => e.stopPropagation()} onSubmit={modal === 'add' ? addDriver : modal === 'vehicles' ? updateVehicles : modal === 'delete' ? deleteDriver : moveDriver}>
      <div className="queue-modal-heading"><span className="eyebrow">{modal === 'add' ? `FILA: ${branchName}` : modal === 'vehicles' ? 'ALTERAR VEÍCULOS' : modal === 'end' ? 'DESCER AO FIM DA FILA' : modal === 'delete' ? 'EXCLUIR MOTORISTA' : 'CONFIRMAR EMPENHO'}</span><button type="button" onClick={closeModal} aria-label="Fechar"><X/></button></div>
      <h2>{modal === 'add' ? 'Adicionar motorista' : modal === 'vehicles' ? 'Editar carro e carreta' : modal === 'end' ? 'Justificar descida ao fim' : modal === 'delete' ? 'Excluir motorista da fila?' : modal === 'confirm' ? 'Confirmar empenho' : 'Justificar empenho'}</h2>
      {modal === 'add' ? <><p>O motorista será incluído no final da fila de {branchName}.</p>
        <label>Nome completo<input autoFocus required minLength={2} maxLength={160} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do motorista" autoComplete="off"/></label>
        {suggestions.length > 0 && <div className="queue-suggestions"><small>Nomes encontrados no ESL (opcional)</small>{suggestions.slice(0, 6).map((s, i) => <button type="button" key={`${s.name}-${i}`} onClick={() => { setNewName(s.name); if (s.plate) setNewPlate(s.plate); setSuggestions([]) }}>{s.name}<span>{s.plate || 'Sem placa'}</span></button>)}</div>}
        {suggestionError && <small className="queue-helper">Sugestões do ESL indisponíveis. O cadastro manual continua disponível.</small>}
        <label>Carro / Cavalo (opcional)<input list="queue-add-plates" maxLength={20} value={newPlate} onChange={e => setNewPlate(e.target.value.toUpperCase())} placeholder="ABC1D23"/></label>
        <label>Carreta (opcional)<input list="queue-add-plates" maxLength={20} value={trailPlate} onChange={e => setTrailPlate(e.target.value.toUpperCase())} placeholder="DEF4G56"/></label>
        <datalist id="queue-add-plates">{Object.values(fleet).map(m => <option key={m.plate} value={m.plate}/>)}</datalist>
      </> : modal === 'vehicles' ? <><p>Selecione ou informe as placas. O vínculo próprio/terceiro é consultado no cadastro de frota.</p><label>Placa do carro / cavalo<input value={newPlate} list="queue-plates" maxLength={20} onChange={e => setNewPlate(e.target.value.toUpperCase())}/></label><label>Placa da carreta<input value={trailPlate} list="queue-plates" maxLength={20} onChange={e => setTrailPlate(e.target.value.toUpperCase())}/></label><datalist id="queue-plates">{Object.values(fleet).map(m => <option key={m.plate} value={m.plate}/>)}</datalist></> : modal === 'delete' ? <><p>Deseja realmente excluir <strong>{selected?.name}</strong> desta fila?</p><p>Os demais motoristas serão reposicionados. Esta ação não cria histórico de exclusão.</p></> : <><p><strong>{selected?.name}</strong> está na posição {selected?.position} de {branchName}.</p>
        <p>{modal === 'confirm' ? 'Ao confirmar, o empenho será registrado com data e horário e o motorista irá para o fim da fila.' : modal === 'end' ? 'Esta ação move o motorista manualmente para o final da fila. Informe a justificativa.' : 'Você está empenhando alguém fora da ordem. O motorista irá para o final da fila após justificar.'}</p>
        {modal !== 'confirm' && <label>Justificativa (mínimo 10 caracteres)<textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Por que a ordem foi alterada?"/></label>}
      </>}
      {formError && <p className="queue-form-error" role="alert">{formError}</p>}
      <div className="queue-modal-actions"><button type="button" onClick={closeModal} disabled={busy}>Cancelar</button><button type="submit" disabled={busy || (modal === 'add' ? newName.trim().length < 2 : modal === 'vehicles' || modal === 'confirm' || modal === 'delete' ? false : reason.trim().length < 10)}>{busy ? 'Salvando...' : modal === 'add' ? 'Cadastrar no final' : modal === 'vehicles' ? 'Salvar placas' : modal === 'end' ? 'Confirmar descida ao fim' : modal === 'delete' ? 'Excluir da fila' : 'Confirmar empenho'}</button></div>
    </form></div>}
  </div>
}
