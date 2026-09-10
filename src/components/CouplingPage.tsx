import { useEffect, useMemo, useState } from 'react'
import { Container, Search, Truck, UserRound, ArrowRight, CalendarClock } from 'lucide-react'
import { motion } from 'framer-motion'
import { getTrailerHistory } from '../services/api'
import type { TrailerHistoryResponse, TrailerHistoryRow } from '../types'

function dateText(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR')
}

type TractorGroup = {
  tractorPlate: string
  trailers: TrailerHistoryRow[]
  lastSeen: string | null
}

export default function CouplingPage() {
  const [data, setData] = useState<TrailerHistoryResponse>({ current: [], history: [] })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedTractor, setSelectedTractor] = useState('')

  useEffect(() => {
    getTrailerHistory()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo<TractorGroup[]>(() => {
    const map = new Map<string, TrailerHistoryRow[]>()
    for (const row of data.current) {
      const key = row.tractorPlate || 'SEM CAVALO'
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }

    return [...map.entries()]
      .map(([tractorPlate, trailers]) => ({
        tractorPlate,
        trailers: trailers.sort((a, b) => a.trailerPlate.localeCompare(b.trailerPlate)),
        lastSeen: trailers[0]?.departureAt || trailers[0]?.date || null
      }))
      .sort((a, b) => {
        if (a.tractorPlate === 'SEM CAVALO') return 1
        if (b.tractorPlate === 'SEM CAVALO') return -1
        return a.tractorPlate.localeCompare(b.tractorPlate)
      })
  }, [data.current])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return groups
    return groups.filter(group =>
      [group.tractorPlate, ...group.trailers.map(t => `${t.trailerPlate} ${t.driver} ${t.manifestNumber}`)]
        .join(' ')
        .toUpperCase()
        .includes(q)
    )
  }, [groups, query])

  useEffect(() => {
    if (!filteredGroups.length) {
      setSelectedTractor('')
      return
    }
    if (!selectedTractor || !filteredGroups.some(group => group.tractorPlate === selectedTractor)) {
      setSelectedTractor(filteredGroups[0].tractorPlate)
    }
  }, [filteredGroups, selectedTractor])

  const activeGroup = filteredGroups.find(group => group.tractorPlate === selectedTractor) || null

  const detailRows = useMemo(() => {
    if (!activeGroup) return []
    const trailerSet = new Set(activeGroup.trailers.map(row => row.trailerPlate))
    return data.history.filter(row => row.tractorPlate === activeGroup.tractorPlate || trailerSet.has(row.trailerPlate))
  }, [activeGroup, data.history])

  return (
    <div className="history-page">
      <header className="coupling-hero">
        <div className="brand-area">
          <img src="/transmassa-logo.png" alt="Transmassa"/>
          <div>
            <span>TRANSMASSA · CAVALOS E CARRETAS</span>
            <h1>Histórico de acoplamentos</h1>
            <p>Menu lateral com os cavalos. Ao clicar, você vê as carretas acopladas embaixo e a tabelinha do histórico.</p>
          </div>
        </div>
        <a href="/">Ir para o painel</a>
      </header>

      <main className="history-shell">
        <aside className="tractor-sidebar">
          <div className="sidebar-head">
            <div>
              <span>CAVALOS</span>
              <h2>{filteredGroups.length} veículo(s)</h2>
            </div>
            <label className="history-search compact">
              <Search/>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cavalo ou carreta"/>
            </label>
          </div>

          <div className="tractor-list">
            {loading ? (
              <div className="history-empty">Carregando acoplamentos...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="history-empty">Nenhum cavalo encontrado.</div>
            ) : filteredGroups.map(group => (
              <motion.button
                key={group.tractorPlate}
                className={`tractor-item ${group.tractorPlate === selectedTractor ? 'active' : ''}`}
                onClick={() => setSelectedTractor(group.tractorPlate)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="tractor-item-title">
                  <Truck/>
                  <strong>{group.tractorPlate}</strong>
                </div>
                <small>{group.trailers.length} carreta(s) acoplada(s)</small>
                <div className="tractor-tags">
                  {group.trailers.slice(0, 3).map(trailer => <span key={trailer.trailerPlate}>{trailer.trailerPlate}</span>)}
                  {group.trailers.length > 3 && <span>+{group.trailers.length - 3}</span>}
                </div>
              </motion.button>
            ))}
          </div>
        </aside>

        <section className="tractor-details">
          {!activeGroup ? (
            <div className="history-empty">Selecione um cavalo no menu lateral.</div>
          ) : (
            <>
              <div className="details-hero">
                <div>
                  <span>CAVALO SELECIONADO</span>
                  <h2>{activeGroup.tractorPlate}</h2>
                  <p>Último avistamento: {dateText(activeGroup.lastSeen)}</p>
                </div>
                <div className="details-kpi">
                  <strong>{activeGroup.trailers.length}</strong>
                  <small>carreta(s) acoplada(s)</small>
                </div>
              </div>

              <div className="attached-trailers-box">
                <div className="section-title-row">
                  <h3>Carretas acopladas agora</h3>
                  <small>Baseado no último manifesto de cada carreta</small>
                </div>
                <div className="attached-trailers-grid">
                  {activeGroup.trailers.map((row, i) => (
                    <motion.article
                      key={`${row.trailerPlate}-${i}`}
                      className="attached-trailer-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.18) }}
                    >
                      <div className="plate-pair">
                        <div className="plate-box trailer"><Container/><strong>{row.trailerPlate}</strong></div>
                        <ArrowRight className="pair-arrow"/>
                        <div className="plate-box tractor"><Truck/><strong>{row.tractorPlate || '—'}</strong></div>
                      </div>
                      <div className="attached-meta">
                        <span><UserRound/> {row.driver || 'Motorista não informado'}</span>
                        <span><CalendarClock/> Manifesto {row.manifestNumber}</span>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>

              <section className="history-table-section">
                <div className="history-table-head">
                  <div>
                    <span>TABELA</span>
                    <h2>Histórico do cavalo e das carretas</h2>
                  </div>
                </div>

                <div className="history-table coupling-table">
                  <div className="history-row history-header coupling-header">
                    <span>CARRETA</span><span>CAVALO</span><span>MANIFESTO</span><span>MOTORISTA</span><span>SAÍDA</span><span>CHEGADA</span><span>STATUS</span>
                  </div>
                  {detailRows.map((row, index) => (
                    <motion.div
                      className={`history-row coupling-data-row ${row.current ? 'latest' : ''}`}
                      key={`${row.manifestId}-${row.trailerPlate}-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <strong>{row.trailerPlate}</strong>
                      <strong>{row.tractorPlate || '—'}</strong>
                      <span>{row.manifestNumber}</span>
                      <span>{row.driver || '—'}</span>
                      <span>{dateText(row.departureAt || row.date)}</span>
                      <span>{dateText(row.arrivalAt)}</span>
                      <span>{row.status || '—'}</span>
                    </motion.div>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
