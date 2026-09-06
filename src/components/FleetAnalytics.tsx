
import { useEffect, useState } from 'react'
import {
  Fuel, ReceiptText, Wrench, Hammer, X, PackageOpen, Route, Truck,
  ArrowRightLeft, WalletCards, ClipboardList, CalendarDays, Weight
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { getVehicleInsights } from '../services/api'
import type { Vehicle, VehicleInsights } from '../types'

function money(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function number(value?: number | null, digits=0) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}
function monthLabel(v:string){ const [y,m]=v.split('-'); return `${m}/${String(y).slice(-2)}` }
function dt(v?:string|null){
  if(!v)return '—'
  const d=new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR')
}
function dateOnly(v?:string|null){
  if(!v)return '—'
  const d=new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR')
}
const Empty=({text}:{text:string})=><div className="analytics-empty">{text}</div>

export function VehicleIntelligenceDrawer({ vehicle, onClose }: { vehicle: Vehicle | null, onClose:()=>void }) {
  const [data,setData]=useState<VehicleInsights|null>(null)
  const [tab,setTab]=useState<'summary'|'manifests'|'fuel'|'os'|'services'|'parts'>('summary')
  const [loading,setLoading]=useState(false)

  useEffect(()=>{
    if(!vehicle){setData(null);return}
    let alive=true
    setLoading(true); setTab('summary')
    getVehicleInsights(vehicle.plate,24)
      .then(v=>alive&&setData(v))
      .catch(()=>alive&&setData({available:false,plate:vehicle.plate,monthly:[],fuel:[],serviceOrders:[],services:[],parts:[],manifests:[]}))
      .finally(()=>alive&&setLoading(false))
    return()=>{alive=false}
  },[vehicle?.plate])

  if(!vehicle)return null
  const o=data?.operational
  const t=data?.totals
  const counts=o?.serviceCounts

  return <div className="drawer-backdrop" onMouseDown={onClose}>
    <aside className="vehicle-drawer vehicle-drawer-v13" onMouseDown={e=>e.stopPropagation()}>
      <header className="drawer-head">
        <div>
          <span>HISTÓRICO COMPLETO DO VEÍCULO</span>
          <h2>{vehicle.plate}</h2>
          <p>{vehicle.vehicleType||'Não identificado'} · {vehicle.ownership==='THIRD_PARTY'?'Terceiro':'Próprio'}</p>
        </div>
        <button onClick={onClose}><X/></button>
      </header>

      <nav className="drawer-tabs">
        {[
          ['summary','Visão geral'],
          ['manifests','Manifestos'],
          ['fuel','Combustível'],
          ['os','OS / manutenção'],
          ['services','Serviços'],
          ['parts','Peças']
        ].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k as any)}>{l}</button>)}
      </nav>

      <div className="drawer-body">
        {loading?<Empty text="Carregando histórico..."/>:data?.available===false?
          <div className="drawer-pending"><strong>Histórico indisponível.</strong><span>Sem fallback local: aguardando resposta válida da API analítica.</span></div>
        :<>
          {tab==='summary'&&<>
            <div className="vehicle-main-kpis">
              <article><WalletCards/><span>FATURAMENTO</span><strong>{money(o?.revenue)}</strong><small>Fretes nos manifestos</small></article>
              <article><PackageOpen/><span>MERCADORIA TRANSPORTADA</span><strong>{money(o?.cargoValue)}</strong><small>{o?.cargoValue==null?'Vínculo NF ↔ manifesto em validação':'Valor total das mercadorias'}</small></article>
              <article><Route/><span>SERVIÇOS REALIZADOS</span><strong>{number(o?.servicesTotal)}</strong><small>{number(o?.manifestCount)} manifestos</small></article>
              <article><ReceiptText/><span>NF MOVIMENTADAS</span><strong>{number(o?.nfMoved)}</strong><small>Somatório documental</small></article>
              <article><Wrench/><span>MANUTENÇÃO</span><strong>{money(t?.maintenanceCost)}</strong><small>OS no período</small></article>
              <article><Fuel/><span>COMBUSTÍVEL</span><strong>{money(t?.fuelCost)}</strong><small>{number(t?.fuelLiters,0)} L · {number(t?.avgKmL,2)} km/L</small></article>
            </div>

            <div className="service-breakdown-v12">
              <article><Truck/><span>Coletas</span><strong>{number(counts?.COLETA)}</strong></article>
              <article><Route/><span>Distribuições</span><strong>{number(counts?.DISTRIBUICAO)}</strong></article>
              <article><ArrowRightLeft/><span>Transferências</span><strong>{number(counts?.TRANSFERENCIA)}</strong></article>
              <article><Hammer/><span>Outros</span><strong>{number(counts?.OUTROS)}</strong></article>
            </div>

            <div className="drawer-chart">
              <div><span>24 MESES · FONTE ÚNICA API 8090</span><h3>Custo do veículo mês a mês</h3></div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data?.monthly||[]}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                  <XAxis dataKey="month" tickFormatter={monthLabel}/><YAxis/>
                  <Tooltip labelFormatter={monthLabel} formatter={(v:any)=>money(v)}/>
                  <Line type="monotone" dataKey="fuelCost" name="Combustível" strokeWidth={2.5} dot={false}/>
                  <Line type="monotone" dataKey="maintenanceCost" name="Manutenção" strokeWidth={2.5} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>}

          {tab==='manifests'&&<div className="manifest-history-v13">
            {(data?.manifests||[]).map(m=><article key={m.id}>
              <div className="manifest-history-title">
                <div><ClipboardList/><div><span>MANIFESTO</span><strong>#{m.numero}</strong></div></div>
                <b className={`manifest-status ${String(m.status||'').toLowerCase()}`}>{m.status||'—'}</b>
              </div>
              <div className="manifest-meta">
                <span><CalendarDays/> {dateOnly(m.data)}</span>
                <span><Truck/> {m.motorista||'Motorista não informado'}</span>
                <span><Weight/> {number(m.pesoKg,0)} kg</span>
              </div>
              <div className="manifest-service-badges">
                <b>{m.service}</b>
                <span>{number(m.coletas)} coleta(s)</span>
                <span>{number(m.distribuicoes)} distribuição(ões)</span>
                <span>{number(m.transferencias)} transferência(s)</span>
              </div>
              <div className="manifest-finance">
                <div><span>NF</span><strong>{number(m.qtdNf)}</strong></div>
                <div><span>Volumes</span><strong>{number(m.volumesNf)}</strong></div>
                <div><span>Destinos</span><strong>{number(m.quantidadeDestinos)}</strong></div>
                <div><span>Frete</span><strong>{money(m.totalFreight)}</strong></div>
              </div>
              <footer>
                <span>Saída: {dt(m.saida)}</span>
                <span>Chegada: {dt(m.chegada)}</span>
                <span>Carreta(s): {[m.reboque1,m.reboque2].filter(Boolean).join(' + ')||'—'}</span>
              </footer>
            </article>)}
            {!data?.manifests?.length&&<Empty text="Nenhum manifesto no período"/>}
          </div>}

          {tab==='fuel'&&<div className="history-list">
            {(data?.fuel||[]).map((r,i)=><article key={i}><Fuel/><div><strong>{dt(r.date)}</strong><span>{r.station||'Posto não informado'} · {r.fuel||'combustível'}</span></div><div className="history-values"><strong>{money(r.total)}</strong><span>{number(r.liters,2)} L · {number(r.kmL,2)} km/L</span></div></article>)}
            {!data?.fuel?.length&&<Empty text="Nenhum abastecimento no período"/>}
          </div>}

          {tab==='os'&&<div className="history-list">
            {(data?.serviceOrders||[]).map((r,i)=><article key={i}><Wrench/><div><strong>OS {r.os||'—'} · {r.status||'—'}</strong><span>{dt(r.date)} · {r.type||'Manutenção'} · {r.branch||'—'}</span></div><div className="history-values"><strong>{money(r.total)}</strong><span>{r.odometer?`Odômetro ${r.odometer}`:'—'}</span></div></article>)}
            {!data?.serviceOrders?.length&&<Empty text="Nenhuma OS no período"/>}
          </div>}

          {tab==='services'&&<div className="history-list">
            {(data?.services||[]).map((r,i)=><article key={i}><Hammer/><div><strong>{r.service||'Serviço'}</strong><span>OS {r.os||'—'} · {dt(r.date)} · {r.group||r.type||'—'}</span></div><div className="history-values"><strong>{money(r.value)}</strong></div></article>)}
            {!data?.services?.length&&<Empty text="Nenhum serviço no período"/>}
          </div>}

          {tab==='parts'&&<div className="history-list">
            {(data?.parts||[]).map((r,i)=><article key={i}><ReceiptText/><div><strong>{r.part||'Peça'}</strong><span>OS {r.os||'—'} · {dt(r.date)} · {r.group||r.type||'—'}</span></div><div className="history-values"><strong>{money(r.value)}</strong></div></article>)}
            {!data?.parts?.length&&<Empty text="Nenhuma peça no período"/>}
          </div>}
        </>}
      </div>
    </aside>
  </div>
}
