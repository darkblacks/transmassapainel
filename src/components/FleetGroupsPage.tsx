
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, Filter, Pencil } from 'lucide-react'
import {
  addFleetBaseCode, deleteFleetMappingMember, getFleetBaseCodes, getFleetCatalog,
  getFleetMappingGroups, getFleetMappingMembers, saveFleetMappingMember
} from '../services/api'
import type { FleetBaseCode, FleetCatalogItem, FleetMappingGroup, FleetMappingMember, SessionUser } from '../types'

interface Props {
  user: SessionUser
  onBack:()=>void
  onUseMapping:(groupId:'total'|number, baseCode?:string)=>void
}

export default function FleetGroupsPage({user,onBack,onUseMapping}:Props){
  const [groups,setGroups]=useState<FleetMappingGroup[]>([])
  const [members,setMembers]=useState<FleetMappingMember[]>([])
  const [bases,setBases]=useState<FleetBaseCode[]>([])
  const [fleet,setFleet]=useState<FleetCatalogItem[]>([])
  const [selected,setSelected]=useState<number|null>(null)
  const [query,setQuery]=useState('')
  const [newBase,setNewBase]=useState('')
  const [saving,setSaving]=useState<string|null>(null)

  async function load(){
    const [g,b,f]=await Promise.all([getFleetMappingGroups(),getFleetBaseCodes(),getFleetCatalog()])
    setGroups(g.filter(x=>x.id==='total'||x.slug==='grupo-consolidado-alexandre'))
    setBases(b); setFleet(f)
  }
  useEffect(()=>{load()},[])
  async function openGroup(id:number){
    setSelected(id)
    const r=await getFleetMappingMembers(id)
    setMembers(r.members)
  }

  const sqlTypeByPlate=useMemo(()=>{
    const m=new Map<string,string>()
    for(const v of fleet)m.set(v.plate,String(v.vehicleType||'Não identificado'))
    return m
  },[fleet])

  const groupAlex=groups.find(g=>g.slug==='grupo-consolidado-alexandre')
  const filtered=useMemo(()=>{
    const q=query.toLowerCase()
    return members.filter(m=>[
      m.plate,m.driver_name,sqlTypeByPlate.get(m.plate),m.base_code
    ].some(v=>String(v||'').toLowerCase().includes(q)))
  },[members,query,sqlTypeByPlate])

  async function changeBase(m:FleetMappingMember,base:string){
    if(!selected)return
    setSaving(m.plate)
    try{
      await saveFleetMappingMember(selected,m.plate,{...m,base_code:base||null})
      setMembers(cur=>cur.map(x=>x.plate===m.plate?{...x,base_code:base||null}:x))
      await load()
    }finally{setSaving(null)}
  }

  async function remove(m:FleetMappingMember){
    if(!selected||!confirm(`Remover ${m.plate} do Grupo Consolidado Alexandre?`))return
    await deleteFleetMappingMember(selected,m.plate)
    setMembers(cur=>cur.filter(x=>x.plate!==m.plate))
    await load()
  }

  async function createBase(){
    const code=newBase.trim().toUpperCase()
    if(!code)return
    await addFleetBaseCode(code,code)
    setNewBase('')
    setBases(await getFleetBaseCodes())
  }

  return <div className="settings-page mapping-v12">
    <div className="settings-head">
      <button onClick={onBack}>← Painel</button>
      <div><span>MAPEAMENTO DE FROTA · {user.name.toUpperCase()}</span><h1>Mapeamento Alexandre</h1><p>Mapeamento define grupo e filial. Tipo do veículo continua vindo do SQL.</p></div>
    </div>

    <div className="mapping-group-grid">
      <article className="mapping-card mapping-click" onClick={()=>onUseMapping('total')}>
        <span>VISÃO GERAL</span><h2>Total</h2><strong>Todos os veículos do SQL</strong>
        <button><Filter/> Usar no painel</button>
      </article>

      {groupAlex&&<article className="mapping-card alexandre mapping-click" onClick={()=>onUseMapping(Number(groupAlex.id))}>
        <span>GRUPO MAPEADO</span><h2>Grupo Consolidado Alexandre</h2>
        <strong>{groupAlex.member_count||0} cavalos</strong>
        <div className="base-pills mapping-base-pills">
          {(groupAlex.bases||[]).map(b=><b key={b.base_code} onClick={e=>{e.stopPropagation();onUseMapping(Number(groupAlex.id),b.base_code)}}>{b.base_code} {b.total}</b>)}
        </div>
        <div className="mapping-actions">
          <button><Filter/> Filtrar no painel</button>
          <button className="edit" onClick={e=>{e.stopPropagation();openGroup(Number(groupAlex.id))}}><Pencil/> Editar mapeamento</button>
        </div>
      </article>}
    </div>

    {selected&&<section className="mapping-editor">
      <header>
        <div><span>EDIÇÃO DO GRUPO</span><h2>Grupo Consolidado Alexandre</h2><p>Base vem do mapeamento; tipo/categoria é consultado diretamente do SQL.</p></div>
        <div className="new-base"><input value={newBase} onChange={e=>setNewBase(e.target.value)} placeholder="Nova sigla, ex. SBC"/><button onClick={createBase}><Plus/>Criar sigla</button></div>
      </header>

      <div className="mapping-toolbar"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Placa, motorista, tipo SQL ou base..."/></div><strong>{members.length} veículos</strong></div>

      <div className="mapping-table">
        <div className="mapping-row head"><span>PLACA</span><span>MOTORISTA</span><span>TIPO SQL</span><span>BASE</span><span></span></div>
        {filtered.map(m=><div className="mapping-row" key={m.plate}>
          <strong>{m.plate}</strong>
          <span>{m.driver_name||'—'}</span>
          <span>{sqlTypeByPlate.get(m.plate)||'Não identificado'}</span>
          <select value={m.base_code||''} disabled={saving===m.plate} onChange={e=>changeBase(m,e.target.value)}>
            <option value="">Sem base</option>
            {bases.map(b=><option key={b.code} value={b.code}>{b.code} · {b.label}</option>)}
          </select>
          <button className="mapping-delete" onClick={()=>remove(m)} title="Remover do grupo"><Trash2/></button>
        </div>)}
      </div>
    </section>}
  </div>
}
