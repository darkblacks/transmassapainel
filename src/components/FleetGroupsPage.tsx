import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Download, FileSpreadsheet, Filter, Pencil, Plus, Save, Search, Trash2, Truck, Upload, Users } from 'lucide-react'
import {
  createFleetMappingGroup,
  createFleetThirdParty,
  deleteFleetMappingMember,
  deleteFleetThirdParty,
  downloadFleetMappingExcel,
  getFleetBaseCodes,
  getFleetCatalog,
  getFleetMappingGroups,
  getFleetMappingMembers,
  getFleetThirdParties,
  importFleetMappingExcel,
  saveFleetMappingMember,
  updateFleetThirdParty
} from '../services/api'
import type {
  FleetBaseCode,
  FleetCatalogItem,
  FleetMappingGroup,
  FleetMappingMember,
  FleetThirdParty,
  Ownership,
  SessionUser
} from '../types'

const TYPE_GROUPS = {
  UTILITARIO: [
    'Moto',
    'Passeio',
    'Pickup',
    'Fiorino, Partner, Kangoo / Furgão Leve',
    'Kombi / Van Leve',
    'Ducato / Van'
  ],
  CAMINHAO: [
    'HR, Accelo / Caminhão Leve',
    'VUC / Caminhão Leve',
    'Toco',
    'Truck',
    'Bi-Truck',
    'Cavalo Mecânico',
    'Carreta Refrigerada'
  ]
} as const

const TYPE_OPTIONS = [...TYPE_GROUPS.UTILITARIO, ...TYPE_GROUPS.CAMINHAO] as const
type VehicleCategory = 'UTILITARIO' | 'CAMINHAO'

function normalizedVehicleType(value?: string | null): (typeof TYPE_OPTIONS)[number] {
  const raw = String(value || '').trim()
  const upper = raw.toUpperCase()

  if (TYPE_OPTIONS.includes(raw as any)) return raw as (typeof TYPE_OPTIONS)[number]
  if (upper === 'MOTO') return 'Moto'
  if (upper === 'CARRO' || upper === 'PASSEIO') return 'Passeio'
  if (upper === 'PICKUP' || upper === 'PICAPE') return 'Pickup'
  if (['FIORINO', 'PARTNER', 'KANGOO', 'FURGÃO LEVE', 'FURGAO LEVE'].includes(upper)) return 'Fiorino, Partner, Kangoo / Furgão Leve'
  if (['KOMBI', 'KOMBIE', 'VAN LEVE'].includes(upper)) return 'Kombi / Van Leve'
  if (['DUCATO', 'VAN'].includes(upper)) return 'Ducato / Van'
  if (['HR', 'ACCELO', 'ACELO', 'CAMINHÃO LEVE', 'CAMINHAO LEVE'].includes(upper)) return 'HR, Accelo / Caminhão Leve'
  if (['3/4', 'VUC', 'VUC 3/4', 'VUC / 3/4'].includes(upper)) return 'VUC / Caminhão Leve'
  if (upper === 'TOCO') return 'Toco'
  if (upper === 'TRUCK' || upper === 'BITRUCK') return upper === 'BITRUCK' ? 'Bi-Truck' : 'Truck'
  if (upper === 'BI-TRUCK' || upper === 'BI TRUCK') return 'Bi-Truck'
  if (upper === 'CAVALO' || upper === 'CAVALO MECÂNICO' || upper === 'CAVALO MECANICO') return 'Cavalo Mecânico'
  if (['CARRETA', 'CARRETA/BAÚ', 'CARRETA/BAU', 'CARRETA / BAÚ', 'CARRETA / BAU', 'CARRETA REFRIGERADA'].includes(upper)) return 'Carreta Refrigerada'

  return 'Cavalo Mecânico'
}

function vehicleCategory(type?: string | null): VehicleCategory {
  const normalized = normalizedVehicleType(type)
  return TYPE_GROUPS.UTILITARIO.includes(normalized as any) ? 'UTILITARIO' : 'CAMINHAO'
}

function TypeOptions() {
  return <>
    <optgroup label="UTILITÁRIOS">{TYPE_GROUPS.UTILITARIO.map(type => <option key={type} value={type}>{type}</option>)}</optgroup>
    <optgroup label="CAMINHÕES">{TYPE_GROUPS.CAMINHAO.map(type => <option key={type} value={type}>{type}</option>)}</optgroup>
  </>
}

type EditorTab = 'fleet' | 'third-parties'

interface Props {
  user: SessionUser
  onBack: () => void
  onUseMapping: (groupId: 'total' | number, baseCode?: string) => void
}

function cleanPlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

function normalizedOwnership(member: FleetMappingMember): Ownership {
  if (member.ownership === 'THIRD_PARTY' || member.ownership === 'OWN') return member.ownership
  return String(member.owner_code || '').trim() ? 'THIRD_PARTY' : 'OWN'
}

function branchLabel(base: FleetBaseCode): string {
  if (base.code === 'SP') return 'SP - São Paulo'
  if (base.code === 'RJ') return 'RJ - Rio de Janeiro'
  if (base.code === 'RB') return 'RB - Ribeirão Preto'
  return `${base.code} - ${base.label}`
}

export default function FleetGroupsPage({ user, onBack, onUseMapping }: Props) {
  const [groups, setGroups] = useState<FleetMappingGroup[]>([])
  const [members, setMembers] = useState<FleetMappingMember[]>([])
  const [bases, setBases] = useState<FleetBaseCode[]>([])
  const [fleet, setFleet] = useState<FleetCatalogItem[]>([])
  const [thirdParties, setThirdParties] = useState<FleetThirdParty[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [tab, setTab] = useState<EditorTab>('fleet')
  const [query, setQuery] = useState('')
  const [baseFilter, setBaseFilter] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [excelBusy, setExcelBusy] = useState<'export' | 'template' | 'import' | null>(null)
  const [excelImportGroupId, setExcelImportGroupId] = useState<number | null>(null)
  const importExcelRef = useRef<HTMLInputElement>(null)

  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  const [newPlate, setNewPlate] = useState('')
  const [newPlateType, setNewPlateType] = useState<(typeof TYPE_OPTIONS)[number]>('Cavalo Mecânico')
  const [newPlateBase, setNewPlateBase] = useState('SP')
  const [newPlateOwnership, setNewPlateOwnership] = useState<Ownership>('OWN')
  const [newPlateThirdPartyId, setNewPlateThirdPartyId] = useState('')

  const [newThirdPartyName, setNewThirdPartyName] = useState('')
  const [newThirdPartyCode, setNewThirdPartyCode] = useState('')

  async function load() {
    // O mapeamento não pode ficar inteiro em branco só porque um endpoint
    // auxiliar (como o catálogo geral) falhou. Carregamos cada fonte de forma
    // independente e preservamos o que estiver disponível.
    const [groupsResult, basesResult, fleetResult, thirdPartiesResult] = await Promise.allSettled([
      getFleetMappingGroups(),
      getFleetBaseCodes(),
      getFleetCatalog(),
      getFleetThirdParties()
    ])

    if (groupsResult.status === 'fulfilled') {
      const loadedGroups = groupsResult.value || []
      setGroups(loadedGroups)

      // Já abre o primeiro grupo real na entrada da tela para a frota aparecer
      // imediatamente, sem depender de clicar em "Editar frota".
      const firstRealGroup = loadedGroups.find(group => group.id !== 'total')
      if (selected == null && firstRealGroup && firstRealGroup.id !== 'total') {
        const id = Number(firstRealGroup.id)
        setSelected(id)
        try {
          const response = await getFleetMappingMembers(id)
          setMembers(response.members || [])
        } catch {
          setMembers([])
        }
      }
    }

    if (basesResult.status === 'fulfilled') {
      setBases((basesResult.value || []).filter(base => base.active !== false))
    }

    if (fleetResult.status === 'fulfilled') {
      setFleet(fleetResult.value || [])
    }

    if (thirdPartiesResult.status === 'fulfilled') {
      setThirdParties(thirdPartiesResult.value || [])
    } else {
      setThirdParties([])
    }

    if (groupsResult.status === 'rejected') {
      setNotice('Não foi possível carregar os grupos de frota.')
    }
  }

  useEffect(() => { void load() }, [])

  async function openGroup(id: number) {
    setSelected(id)
    setTab('fleet')
    setNotice('')
    const response = await getFleetMappingMembers(id)
    setMembers(response.members || [])
  }

  async function refreshMembers() {
    if (!selected) return
    const response = await getFleetMappingMembers(selected)
    setMembers(response.members || [])
  }

  const selectedGroup = groups.find(group => Number(group.id) === selected)
  const memberPlateSet = useMemo(() => new Set(members.map(member => cleanPlate(member.plate))), [members])
  const availableFleet = useMemo(() => fleet.filter(vehicle => !memberPlateSet.has(cleanPlate(vehicle.plate))), [fleet, memberPlateSet])

  const thirdPartyById = useMemo(() => {
    const map = new Map<number, FleetThirdParty>()
    thirdParties.forEach(item => map.set(item.id, item))
    return map
  }, [thirdParties])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter(member => {
      const ownership = normalizedOwnership(member)
      if (baseFilter && member.base_code !== baseFilter) return false
      if (ownershipFilter && ownership !== ownershipFilter) return false
      if (categoryFilter && vehicleCategory(member.vehicle_type) !== categoryFilter) return false
      const thirdParty = member.third_party_id ? thirdPartyById.get(Number(member.third_party_id)) : undefined
      if (!q) return true
      return [member.plate, normalizedVehicleType(member.vehicle_type), vehicleCategory(member.vehicle_type), member.base_code, ownership, thirdParty?.name, member.third_party_name]
        .some(value => String(value || '').toLowerCase().includes(q))
    })
  }, [members, query, baseFilter, ownershipFilter, categoryFilter, thirdPartyById])

  function updateLocal(plate: string, patch: Partial<FleetMappingMember>) {
    setMembers(current => current.map(member => member.plate === plate ? { ...member, ...patch } : member))
  }

  async function saveRow(member: FleetMappingMember) {
    if (!selected) return
    setSaving(member.plate)
    setNotice('')
    try {
      const ownership = normalizedOwnership(member)
      const payload: Partial<FleetMappingMember> = {
        plate: cleanPlate(member.plate),
        vehicle_type: normalizedVehicleType(member.vehicle_type),
        base_code: member.base_code || null,
        ownership,
        third_party_id: ownership === 'THIRD_PARTY' && member.third_party_id ? Number(member.third_party_id) : null,
        // Compatibilidade temporária com o backend antigo durante a migração.
        owner_code: ownership === 'THIRD_PARTY'
          ? (member.third_party_id ? thirdPartyById.get(Number(member.third_party_id))?.code || member.owner_code || null : member.owner_code || null)
          : null
      }
      const saved = await saveFleetMappingMember(selected, member.plate, payload)
      setMembers(current => current.map(item => item.plate === member.plate ? { ...item, ...payload, ...saved } : item))
      setNotice(`${member.plate} atualizado.`)
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'Não foi possível salvar a placa.')
    } finally {
      setSaving(null)
    }
  }

  async function addMember() {
    if (!selected) return
    const plate = cleanPlate(newPlate)
    if (plate.length !== 7) return setNotice('Informe uma placa válida com 7 caracteres.')
    if (memberPlateSet.has(plate)) return setNotice(`${plate} já pertence a este grupo.`)
    if (!newPlateBase) return setNotice('Selecione a filial.')
    if (newPlateOwnership === 'THIRD_PARTY' && !newPlateThirdPartyId) return setNotice('Selecione o terceiro responsável por esta placa.')

    setSaving(plate)
    try {
      const thirdParty = newPlateThirdPartyId ? thirdPartyById.get(Number(newPlateThirdPartyId)) : undefined
      await saveFleetMappingMember(selected, plate, {
        plate,
        vehicle_type: newPlateType,
        base_code: newPlateBase,
        ownership: newPlateOwnership,
        third_party_id: newPlateOwnership === 'THIRD_PARTY' ? Number(newPlateThirdPartyId) : null,
        owner_code: newPlateOwnership === 'THIRD_PARTY' ? thirdParty?.code || null : null,
        driver_name: null,
        service_override: null,
        notes: null
      })
      setNewPlate('')
      setNewPlateType('Cavalo Mecânico')
      setNewPlateOwnership('OWN')
      setNewPlateThirdPartyId('')
      setNotice(`${plate} adicionada à frota do grupo.`)
      await Promise.all([refreshMembers(), load()])
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'Não foi possível adicionar a placa.')
    } finally {
      setSaving(null)
    }
  }

  async function removeMember(member: FleetMappingMember) {
    if (!selected || !confirm(`Remover ${member.plate} deste grupo?`)) return
    setSaving(member.plate)
    try {
      await deleteFleetMappingMember(selected, member.plate)
      setMembers(current => current.filter(item => item.plate !== member.plate))
      setNotice(`${member.plate} removida do grupo.`)
      await load()
    } finally {
      setSaving(null)
    }
  }

  async function createGroup() {
    const name = newGroupName.trim()
    if (!name) return
    setCreatingGroup(true)
    setNotice('')
    try {
      const group = await createFleetMappingGroup(name)
      setNewGroupName('')
      await load()
      if (typeof group.id === 'number') await openGroup(group.id)
      setNotice(`Grupo ${name} criado.`)
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'O backend ainda não está aceitando criação de grupos.')
    } finally {
      setCreatingGroup(false)
    }
  }

  async function createThirdParty() {
    const name = newThirdPartyName.trim()
    const code = (newThirdPartyCode.trim() || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    if (!name || !code) return
    try {
      await createFleetThirdParty({ code, name })
      setNewThirdPartyName('')
      setNewThirdPartyCode('')
      setThirdParties(await getFleetThirdParties())
      setNotice(`${name} cadastrado como terceiro.`)
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'Não foi possível cadastrar o terceiro.')
    }
  }

  async function saveThirdParty(item: FleetThirdParty) {
    try {
      const saved = await updateFleetThirdParty(item.id, { code: item.code, name: item.name, active: item.active !== false })
      setThirdParties(current => current.map(tp => tp.id === item.id ? saved : tp))
      setNotice(`${saved.name} atualizado.`)
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'Não foi possível atualizar o terceiro.')
    }
  }

  async function removeThirdParty(item: FleetThirdParty) {
    if (!confirm(`Remover ${item.name} do cadastro de terceiros?`)) return
    try {
      await deleteFleetThirdParty(item.id)
      setThirdParties(current => current.filter(tp => tp.id !== item.id))
      setNotice(`${item.name} removido.`)
    } catch (error: any) {
      setNotice(error?.response?.data?.detail || error?.response?.data?.message || 'Não foi possível remover. Verifique se existem placas vinculadas.')
    }
  }


  function excelErrorMessage(error: any, fallback: string): string {
    const detail = error?.response?.data?.detail
    if (detail && typeof detail === 'object') {
      const errors = Array.isArray(detail.errors) ? detail.errors : []
      const message = String(detail.message || '').trim()
      if (errors.length) {
        const shown = errors.slice(0, 6).map((item: unknown) => String(item))
        const extra = errors.length > shown.length ? ` (+${errors.length - shown.length} erros)` : ''
        return `${message ? `${message} ` : ''}${shown.join(' | ')}${extra}`
      }
      if (message) return message
    }
    return String(detail || error?.response?.data?.message || error?.message || fallback)
  }

  function saveBlob(blob: Blob, filename: string) {
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(href)
  }

  async function downloadExcel(kind: 'export' | 'template', groupId: number | null = selected) {
    if (!groupId) return
    setExcelBusy(kind)
    setNotice('')
    try {
      const blob = await downloadFleetMappingExcel(groupId, kind)
      const group = groups.find(item => Number(item.id) === groupId)
      const safeName = String(group?.name || `grupo-${groupId}`).replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_')
      const filename = kind === 'template' ? `modelo_importacao_${safeName}.xlsx` : `frota_${safeName}.xlsx`
      saveBlob(blob, filename)
      const total = selected === groupId ? members.length : Number(group?.member_count || 0)
      setNotice(kind === 'template' ? 'Modelo Excel gerado. Use os valores da aba Referências.' : `${total} placas exportadas para Excel.`)
    } catch (error: any) {
      setNotice(excelErrorMessage(error, 'Não foi possível gerar o Excel.'))
    } finally {
      setExcelBusy(null)
    }
  }

  function chooseExcelImport(groupId: number) {
    setExcelImportGroupId(groupId)
    setTimeout(() => importExcelRef.current?.click(), 0)
  }

  async function importExcel(file?: File, groupId: number | null = excelImportGroupId || selected) {
    if (!groupId || !file) return
    setExcelBusy('import')
    setNotice('')
    try {
      const result = await importFleetMappingExcel(groupId, file)
      await load()
      if (selected === groupId) await refreshMembers()
      setNotice(`Importação concluída: ${result.total} placas processadas · ${result.created} novas · ${result.updated} atualizadas. Nenhuma placa ausente no arquivo foi excluída.`)
    } catch (error: any) {
      setNotice(excelErrorMessage(error, 'Não foi possível importar o Excel.'))
    } finally {
      setExcelBusy(null)
      setExcelImportGroupId(null)
      if (importExcelRef.current) importExcelRef.current.value = ''
    }
  }

  return <div className="settings-page mapping-v18">
    <div className="settings-head">
      <button onClick={onBack}>← Filiais</button>
      <div>
        <span>MAPEAMENTO DE FROTA · {user.name.toUpperCase()}</span>
        <h1>Definição da Frota</h1>
        <p>Cada placa recebe apenas tipo corrigido, filial, vínculo e terceiro. Os dados operacionais vêm do manifesto/OS.</p>
      </div>
    </div>

    <section className="mapping-topbar-v18">
      <div>
        <span>NOVO GRUPO</span>
        <strong>Crie uma frota separada quando precisar</strong>
      </div>
      <input value={newGroupName} onChange={event => setNewGroupName(event.target.value)} placeholder="Nome do novo grupo" onKeyDown={event => event.key === 'Enter' && createGroup()}/>
      <button onClick={createGroup} disabled={creatingGroup}><Plus/> Criar grupo</button>
    </section>

    <div className="mapping-group-grid-v18">
      <article className="mapping-card mapping-click" onClick={() => onUseMapping('total')}>
        <span>VISÃO GERAL</span><h2>Total</h2><strong>Todos os veículos encontrados no sistema</strong>
        <button><Filter/> Usar no painel</button>
      </article>

      {groups.filter(group => group.id !== 'total').map(group => <article className={`mapping-card mapping-click ${selected === Number(group.id) ? 'selected' : ''}`} key={String(group.id)}>
        <span>{group.is_system ? 'GRUPO PRINCIPAL' : 'GRUPO PERSONALIZADO'}</span>
        <h2>{group.name}</h2>
        <strong>{group.member_count || 0} veículos</strong>
        <div className="base-pills mapping-base-pills">
          {(group.bases || []).map(base => <b key={base.base_code} onClick={() => onUseMapping(Number(group.id), base.base_code)}>{base.base_code} {base.total}</b>)}
        </div>
        <div className="mapping-actions">
          <button onClick={() => onUseMapping(Number(group.id))}><Filter/> Painel</button>
          <button className="edit" onClick={() => openGroup(Number(group.id))}><Pencil/> Editar frota</button>
        </div>
        <div className="mapping-card-excel-actions-v23">
          <button onClick={() => downloadExcel('export', Number(group.id))} disabled={Boolean(excelBusy)} title="Exportar as placas deste grupo"><FileSpreadsheet/> Exportar Excel</button>
          <button onClick={() => downloadExcel('template', Number(group.id))} disabled={Boolean(excelBusy)} title="Baixar modelo para importação"><Download/> Modelo</button>
          <button onClick={() => chooseExcelImport(Number(group.id))} disabled={Boolean(excelBusy)} title="Importar planilha neste grupo"><Upload/> Importar</button>
        </div>
      </article>)}
    </div>

    {notice && <div className="mapping-notice mapping-global-notice">{notice}</div>}
    <input ref={importExcelRef} className="mapping-hidden-file-v22" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => void importExcel(event.target.files?.[0])}/>

    {selected && <section className="mapping-editor mapping-editor-v18">
      <header>
        <div>
          <span>EDIÇÃO DO GRUPO</span>
          <h2>{selectedGroup?.name || 'Grupo'}</h2>
          <p>{members.length} placas definidas nesta frota.</p>
        </div>
        <div className="mapping-editor-actions-v22">
          {tab === 'fleet' && <div className="mapping-excel-actions-v22">
            <button onClick={() => downloadExcel('export')} disabled={Boolean(excelBusy)} title="Exportar todas as placas deste grupo"><FileSpreadsheet/> Excel</button>
            <button onClick={() => downloadExcel('template')} disabled={Boolean(excelBusy)} title="Baixar modelo de importação"><Download/> Modelo</button>
            <button onClick={() => importExcelRef.current?.click()} disabled={Boolean(excelBusy)} title="Importar planilha para este grupo"><Upload/> Importar</button>
          </div>}
          <div className="mapping-tabs-v18">
            <button className={tab === 'fleet' ? 'active' : ''} onClick={() => setTab('fleet')}><Truck/> Frota</button>
            <button className={tab === 'third-parties' ? 'active' : ''} onClick={() => setTab('third-parties')}><Users/> Terceiros</button>
          </div>
        </div>
      </header>

      {tab === 'fleet' && <>
        <section className="mapping-add-card-v18">
          <div className="mapping-add-title"><span>ADICIONAR PLACA</span><strong>Defina a placa na sua frota</strong></div>
          <label><span>PLACA</span><input list="fleet-plates" value={newPlate} onChange={event => setNewPlate(cleanPlate(event.target.value))} placeholder="ABC1D23" maxLength={7}/></label>
          <datalist id="fleet-plates">{availableFleet.map(vehicle => <option key={vehicle.plate} value={vehicle.plate}/>)}</datalist>
          <label><span>TIPO CORRIGIDO</span><select value={newPlateType} onChange={event => setNewPlateType(event.target.value as any)}><TypeOptions/></select></label>
          <label><span>FILIAL</span><select value={newPlateBase} onChange={event => setNewPlateBase(event.target.value)}><option value="">Selecione</option>{bases.map(base => <option key={base.code} value={base.code}>{branchLabel(base)}</option>)}</select></label>
          <label><span>VÍNCULO</span><select value={newPlateOwnership} onChange={event => { const value = event.target.value as Ownership; setNewPlateOwnership(value); if (value === 'OWN') setNewPlateThirdPartyId('') }}><option value="OWN">Próprio</option><option value="THIRD_PARTY">Terceiro</option></select></label>
          <label className={newPlateOwnership === 'OWN' ? 'disabled-field' : ''}><span>TERCEIRO</span><select disabled={newPlateOwnership === 'OWN'} value={newPlateThirdPartyId} onChange={event => setNewPlateThirdPartyId(event.target.value)}><option value="">Selecione</option>{thirdParties.filter(tp => tp.active !== false).map(tp => <option value={tp.id} key={tp.id}>{tp.name}</option>)}</select></label>
          <button className="mapping-add-btn-v18" onClick={addMember} disabled={Boolean(saving)}><Plus/> Adicionar</button>
        </section>

        <div className="mapping-toolbar mapping-toolbar-v18">
          <div className="search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar placa, tipo, filial ou terceiro..."/></div>
          <select value={baseFilter} onChange={event => setBaseFilter(event.target.value)}><option value="">Todas as filiais</option>{bases.map(base => <option key={base.code} value={base.code}>{branchLabel(base)}</option>)}</select>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Todas as categorias</option><option value="UTILITARIO">Utilitários</option><option value="CAMINHAO">Caminhões</option></select>
          <select value={ownershipFilter} onChange={event => setOwnershipFilter(event.target.value)}><option value="">Todos os vínculos</option><option value="OWN">Próprio</option><option value="THIRD_PARTY">Terceiro</option></select>
          <strong>{filtered.length} de {members.length}</strong>
        </div>

        <div className="mapping-table mapping-table-v18">
          <div className="mapping-row-v18 head"><span>PLACA</span><span>TIPO CORRIGIDO</span><span>FILIAL</span><span>VÍNCULO</span><span>TERCEIRO</span><span>AÇÕES</span></div>
          {filtered.map(member => {
            const ownership = normalizedOwnership(member)
            return <div className="mapping-row-v18" key={member.plate}>
              <strong>{member.plate}</strong>
              <select value={normalizedVehicleType(member.vehicle_type)} onChange={event => updateLocal(member.plate, { vehicle_type: event.target.value })}><TypeOptions/></select>
              <select value={member.base_code || ''} onChange={event => updateLocal(member.plate, { base_code: event.target.value || null })}><option value="">Selecione</option>{bases.map(base => <option key={base.code} value={base.code}>{branchLabel(base)}</option>)}</select>
              <select value={ownership} onChange={event => { const value = event.target.value as Ownership; updateLocal(member.plate, { ownership: value, third_party_id: value === 'OWN' ? null : member.third_party_id }) }}><option value="OWN">Próprio</option><option value="THIRD_PARTY">Terceiro</option></select>
              <select disabled={ownership === 'OWN'} value={ownership === 'THIRD_PARTY' ? String(member.third_party_id || '') : ''} onChange={event => updateLocal(member.plate, { third_party_id: event.target.value ? Number(event.target.value) : null })}><option value="">Selecione o terceiro</option>{thirdParties.filter(tp => tp.active !== false).map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}</select>
              <div className="mapping-row-actions"><button className="mapping-save" disabled={saving === member.plate} onClick={() => saveRow(member)} title="Salvar"><Save/></button><button className="mapping-delete" disabled={saving === member.plate} onClick={() => removeMember(member)} title="Remover"><Trash2/></button></div>
            </div>
          })}
          {!filtered.length && <div className="mapping-empty">Nenhuma placa encontrada.</div>}
        </div>
      </>}

      {tab === 'third-parties' && <section className="third-parties-v18">
        <div className="third-party-add-v18">
          <div><span>CADASTRO DE TERCEIROS</span><strong>Empresas ou agregados que prestam serviço</strong></div>
          <input value={newThirdPartyCode} onChange={event => setNewThirdPartyCode(event.target.value.toUpperCase())} placeholder="Código (ex. ALX)" maxLength={12}/>
          <input value={newThirdPartyName} onChange={event => setNewThirdPartyName(event.target.value)} placeholder="Nome do terceiro"/>
          <button onClick={createThirdParty}><Plus/> Cadastrar</button>
        </div>

        <div className="third-party-list-v18">
          <div className="third-party-row-v18 head"><span>CÓDIGO</span><span>NOME</span><span>STATUS</span><span>AÇÕES</span></div>
          {thirdParties.map(item => <div className="third-party-row-v18" key={item.id}>
            <input value={item.code} onChange={event => setThirdParties(current => current.map(tp => tp.id === item.id ? { ...tp, code: event.target.value.toUpperCase() } : tp))}/>
            <input value={item.name} onChange={event => setThirdParties(current => current.map(tp => tp.id === item.id ? { ...tp, name: event.target.value } : tp))}/>
            <select value={item.active === false ? '0' : '1'} onChange={event => setThirdParties(current => current.map(tp => tp.id === item.id ? { ...tp, active: event.target.value === '1' } : tp))}><option value="1">Ativo</option><option value="0">Inativo</option></select>
            <div className="mapping-row-actions"><button className="mapping-save" onClick={() => saveThirdParty(item)}><Save/></button><button className="mapping-delete" onClick={() => removeThirdParty(item)}><Trash2/></button></div>
          </div>)}
          {!thirdParties.length && <div className="mapping-empty"><Building2/> Nenhum terceiro cadastrado ainda.</div>}
        </div>
      </section>}
    </section>}
  </div>
}
