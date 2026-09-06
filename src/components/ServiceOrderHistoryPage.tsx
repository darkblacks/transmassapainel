import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldAlert, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'
import { getFleetServiceOrders } from '../services/api'
import type { VehicleHistoryOs } from '../types'

type OsRow = VehicleHistoryOs & { plate: string }

function dateText(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR')
}
function n(value: unknown) {
  const x = Number(value ?? 0)
  return Number.isFinite(x) ? x : 0
}
function money(value: unknown) {
  return n(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ServiceOrderHistoryPage() {
  const [rows, setRows] = useState<OsRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const response = await getFleetServiceOrders(24)
        if (!alive) return
        if (!response.available) {
          setReason(response.reason || 'API analítica indisponível.')
          return
        }
        const finalRows = (response.rows || [])
          .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
        setRows(finalRows)
      } catch (e:any) {
        if (alive) setReason(e?.message || 'Falha ao consultar API analítica.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return rows
    return rows.filter(row => [row.os,row.plate,row.status,row.branch,row.type].join(' ').toUpperCase().includes(q))
  }, [rows, query])

  const open = filtered.filter(r => String(r.status||'').toLowerCase().includes('abert')).length
  const closed = filtered.length - open
  const totalParts = filtered.reduce((s,r)=>s+n(r.parts),0)
  const totalCost = filtered.reduce((s,r)=>s+n(r.total),0)

  return <div className="history-page">
    <header className="coupling-hero">
      <div className="brand-area"><img src="/transmassa-logo.png" alt="Transmassa"/><div>
        <span>TRANSMASSA · MANUTENÇÃO</span><h1>Histórico de OS</h1>
        <p>Fonte única: API analítica da frota (PostgreSQL).</p>
      </div></div>
      <a href="/">Ir para o painel</a>
    </header>
    <main className="history-content">
      <div className="os-kpis os-kpis-five">
        <motion.article><span>OS</span><strong>{filtered.length}</strong></motion.article>
        <motion.article><span>ABERTAS</span><strong>{open}</strong></motion.article>
        <motion.article><span>FECHADAS</span><strong>{closed}</strong></motion.article>
        <motion.article><span>PEÇAS</span><strong>{money(totalParts)}</strong></motion.article>
        <motion.article><span>CUSTO TOTAL</span><strong>{money(totalCost)}</strong></motion.article>
      </div>
      <section className="history-table-section">
        <div className="history-table-head"><div><span>MANUTENÇÃO / OS</span><h2>Ordens de serviço</h2></div>
          <label className="history-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar OS, placa, filial, tipo ou status"/></label>
        </div>
        {loading ? <div className="history-empty">Consultando histórico de OS na API...</div> : reason ?
          <div className="history-empty history-warning"><ShieldAlert/><div><strong>API analítica indisponível.</strong><p>{reason}</p></div></div> :
          <div className="os-ledger">
            <div className="os-ledger-head"><span></span><span>OS</span><span>VEÍCULO</span><span>FILIAL</span><span>DATA</span><span></span><span>TIPO</span><span>STATUS</span><span>PEÇAS</span><span>M.O. 3º</span><span>M.O. PRÓPRIA</span><span>TOTAL</span></div>
            {filtered.map((row,i)=><div className="os-ledger-block" key={`${row.plate}-${row.os}-${row.date}-${i}`}>
              <div className="os-ledger-row"><span className="expand-btn"><Wrench/></span><strong>#{row.os||'—'}</strong><strong>{row.plate}</strong><span>{row.branch||'—'}</span>
                <span>{dateText(row.date)}</span><span>—</span><span>{row.type||'—'}</span><span>{row.status||'—'}</span>
                <strong>{money(row.parts)}</strong><span>{money(row.laborThird)}</span><span>{money(row.laborOwn)}</span><strong>{money(row.total)}</strong>
              </div></div>)}
            {!filtered.length && <div className="history-empty">Nenhuma OS retornada pela API para os veículos atuais.</div>}
          </div>}
      </section>
    </main>
  </div>
}
