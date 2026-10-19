import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  WifiOff
} from 'lucide-react'
import { motion } from 'framer-motion'
import { getEslHealthSummary } from '../services/api'
import type { EslHealthSummary, EslRecentExecution, EslReportHealth, IntegrationHealthLevel } from '../types'

const DEFAULT_SUMMARY: EslHealthSummary = {
  generatedAt: new Date().toISOString(),
  overallStatus: 'unknown',
  overview: {
    headline: 'Integração ESL',
    note: 'Aguardando leitura das integrações.'
  },
  reports: []
}

const STATUS_META: Record<IntegrationHealthLevel, { label: string; tone: string; icon: typeof ShieldCheck }> = {
  healthy: { label: 'Em dia', tone: 'healthy', icon: CheckCircle2 },
  warning: { label: 'Atenção', tone: 'warning', icon: Clock3 },
  critical: { label: 'Falha', tone: 'critical', icon: AlertTriangle },
  unknown: { label: 'Sem leitura', tone: 'unknown', icon: WifiOff }
}

function levelFromReport(report: EslReportHealth): number {
  if (report.status === 'critical') return 3
  if (report.status === 'warning') return 2
  if (report.status === 'healthy') return 1
  return 0
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR')
}

function formatHour(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(seconds?: number | null): string {
  const total = Number(seconds ?? 0)
  if (!Number.isFinite(total) || total <= 0) return '—'
  if (total < 60) return `${Math.round(total)}s`
  const minutes = Math.floor(total / 60)
  const rest = Math.round(total % 60)
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

function countdownText(target?: string | null, now = Date.now()): string {
  if (!target) return '—'
  const date = new Date(target)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(diff)
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const seconds = abs % 60
  const body = hours
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return diff >= 0 ? body : 'Aguardando novo ciclo'
}

function relativeText(value?: string | null, now = Date.now()): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMinutes = Math.max(0, Math.round((now - date.getTime()) / 60000))
  if (diffMinutes < 1) return 'agora há pouco'
  if (diffMinutes < 60) return `há ${diffMinutes} min`
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  if (hours < 24) return `há ${hours}h ${String(minutes).padStart(2, '0')}m`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

function successRatio(report: EslReportHealth): number {
  const ok = Number(report.totalSuccess || 0)
  const error = Number(report.totalError || 0)
  const skipped = Number(report.totalSkipped || 0)
  const total = ok + error + skipped
  if (!total) return 0
  return (ok / total) * 100
}

function inferOverall(summary: EslHealthSummary): IntegrationHealthLevel {
  if (summary.overallStatus && summary.overallStatus !== 'unknown') return summary.overallStatus
  const worst = Math.max(0, ...summary.reports.map(levelFromReport))
  if (worst === 3) return 'critical'
  if (worst === 2) return 'warning'
  if (worst === 1) return 'healthy'
  return 'unknown'
}

function detectCadenceNote(summary: EslHealthSummary): string {
  const lines = summary.reports
    .filter(report => report.frequencyMinutes)
    .sort((a, b) => Number(a.frequencyMinutes || 9999) - Number(b.frequencyMinutes || 9999))
    .map(report => `${report.label}: ${report.frequencyMinutes} min`)
  return lines.length ? lines.join(' • ') : 'Sem cadência informada pelo backend.'
}

function reportChipText(report: EslReportHealth): string {
  const parts = []
  if (report.frequencyMinutes) parts.push(report.frequencyMinutes >= 60 ? `${Math.round(report.frequencyMinutes / 60)}h` : `${report.frequencyMinutes} min`)
  if (report.lastSuccessAt) parts.push(`última ${formatHour(report.lastSuccessAt)}`)
  return parts.join(' · ') || 'Sem detalhe'
}

function useEslHealth(pollMs = 60000) {
  const [summary, setSummary] = useState<EslHealthSummary>(DEFAULT_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  async function fetchData(silent = false) {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      setError('')
      setSummary(await getEslHealthSummary())
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Não foi possível consultar a integração ESL.')
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const poll = window.setInterval(() => { if (!document.hidden) fetchData(true) }, pollMs)
    const onVisibility = () => { if (!document.hidden) fetchData(true) }
    document.addEventListener('visibilitychange', onVisibility)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(clock)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pollMs])

  return { summary, loading, refreshing, error, now, reload: () => fetchData() }
}

function SummaryPill({ icon: Icon, label, value, strong = false }: { icon: typeof Clock3; label: string; value: string; strong?: boolean }) {
  return (
    <div className={`esl-pill ${strong ? 'strong' : ''}`}>
      <span><Icon/>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function IntegrationStatusBanner({ compact = false }: { compact?: boolean }) {
  const { summary, now } = useEslHealth(15000)
  const frequent = summary.reports.filter(report => ['fretes', 'manifestos'].includes(report.key.toLowerCase()))
  const maintenance = summary.reports.find(report => report.key.toLowerCase() === 'os')

  // Os dois relatórios fazem parte do mesmo ciclo de atualização.
  const latestCombinedSuccess = frequent
    .map(report => report.lastSuccessAt)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
  const nextCombinedCycle = frequent
    .map(report => report.nextPlannedAt)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null

  const services = [
    {
      key: 'operacional',
      title: 'Manifestos / NF & Fretes',
      lastSuccess: latestCombinedSuccess,
      nextPlanned: nextCombinedCycle,
      description: 'Ciclo operacional de fretes e manifestos ESL'
    },
    {
      key: 'manutencao',
      title: 'Manutenção',
      lastSuccess: maintenance?.lastSuccessAt,
      nextPlanned: maintenance?.nextPlannedAt,
      description: 'Ordens de serviço ESL'
    }
  ]

  return (
    <div className={`esl-inline-status esl-banner-clean ${compact ? 'esl-inline-compact' : ''}`} aria-label="Horários de sincronização ESL">
      <span className="esl-banner-heading"><RefreshCw size={15}/><span>Atualizações ESL</span></span>
      <div className="esl-banner-services">
        {services.map(service => (
          <div className="esl-banner-service" key={service.key} title={service.description}>
            <strong className="esl-banner-service-name">{service.title}</strong>
            <span className="esl-banner-metric">
              <small>Último sucesso</small>
              <b>{formatHour(service.lastSuccess)}</b>
            </span>
            <span className="esl-banner-metric esl-banner-next">
              <small>Próxima atualização</small>
              <b>{service.nextPlanned ? countdownText(service.nextPlanned, now) : '—'}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportCard({ report, now }: { report: EslReportHealth; now: number }) {
  const meta = STATUS_META[report.status]
  const ratio = Math.max(0, Math.min(100, successRatio(report)))
  return (
    <motion.article
      className={`esl-health-card tone-${meta.tone}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="esl-health-card-head">
        <div>
          <span>{report.label}</span>
          <h3>{meta.label}</h3>
        </div>
        <div className="esl-health-card-kpi">{report.frequencyMinutes ? (report.frequencyMinutes >= 60 ? `${Math.round(report.frequencyMinutes / 60)}h` : `${report.frequencyMinutes} min`) : '—'}</div>
      </div>

      <div className="esl-health-metrics">
        <div><span>Último sucesso</span><strong>{formatHour(report.lastSuccessAt)}</strong><small>{relativeText(report.lastSuccessAt, now)}</small></div>
        <div><span>Próximo previsto</span><strong>{formatHour(report.nextPlannedAt)}</strong><small>{countdownText(report.nextPlannedAt, now)}</small></div>
        <div><span>Duração média</span><strong>{formatDuration(report.avgDurationSeconds)}</strong><small>{report.processing ? 'Em processamento' : 'Ciclo médio'}</small></div>
      </div>

      <div className="esl-success-bar">
        <div className="esl-success-bar-fill" style={{ width: `${ratio}%` }}/>
      </div>

      <div className="esl-counter-grid">
        <div><span>Sucessos</span><strong>{Number(report.totalSuccess || 0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Erros</span><strong>{Number(report.totalError || 0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Pulados</span><strong>{Number(report.totalSkipped || 0).toLocaleString('pt-BR')}</strong></div>
      </div>

      {report.note && <p className="esl-health-note">{report.note}</p>}
    </motion.article>
  )
}

function RecentExecutionTable({ rows }: { rows: EslRecentExecution[] }) {
  if (!rows.length) {
    return <div className="esl-history-empty">O histórico aparecerá quando a API de integração estiver conectada.</div>
  }

  return (
    <div className="esl-history-table">
      <div className="esl-history-head">
        <span>Relatório</span>
        <span>Status</span>
        <span>Programado</span>
        <span>Início</span>
        <span>Fim</span>
        <span>Duração</span>
        <span>Linhas</span>
        <span>Alterações</span>
      </div>
      {rows.map((row, index) => (
        <div className="esl-history-row" key={`${row.report}-${row.id || index}-${row.finishedAt || row.startedAt || index}`}>
          <strong>{row.report}</strong>
          <span className={`status-pill ${String(row.status).toLowerCase()}`}>{row.status}</span>
          <span>{formatDateTime(row.scheduledAt)}</span>
          <span>{formatDateTime(row.startedAt)}</span>
          <span>{formatDateTime(row.finishedAt)}</span>
          <span>{formatDuration(row.durationSeconds)}</span>
          <span>{row.rows == null ? '—' : Number(row.rows).toLocaleString('pt-BR')}</span>
          <span>{row.changes == null ? '—' : Number(row.changes).toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  )
}

export function IntegrationHealthPage({
  userName,
  onBack,
  onLogout
}: {
  userName: string
  onBack: () => void
  onLogout: () => void
}) {
  const { summary, loading, refreshing, error, now, reload } = useEslHealth(60000)
  const overall = inferOverall(summary)
  const meta = STATUS_META[overall]
  const Icon = meta.icon
  const lastCompletedAt = summary.overview.lastCompletedAt || summary.reports.map(r => r.lastSuccessAt).filter(Boolean).sort().slice(-1)[0] || null
  const nextPlannedAt = summary.overview.nextPlannedAt || summary.reports.map(r => r.nextPlannedAt).filter(Boolean).sort()[0] || null
  const sortedReports = [...summary.reports].sort((a, b) => levelFromReport(b) - levelFromReport(a) || String(a.label).localeCompare(String(b.label)))
  const healthyCount = sortedReports.filter(r => r.status === 'healthy').length
  const warningCount = sortedReports.filter(r => r.status === 'warning').length
  const criticalCount = sortedReports.filter(r => r.status === 'critical').length

  return (
    <div className="history-page">
      <header className="coupling-hero esl-hero">
        <div className="brand-area">
          <img src="/transmassa-logo.png" alt="Transmassa"/>
          <div>
            <span>TRANSMASSA · {userName.toUpperCase()}</span>
            <h1>Saúde da integração ESL</h1>
            <p>Monitore a última atualização, os próximos ciclos previstos e a qualidade das sincronizações do sistema.</p>
          </div>
        </div>
        <div className="esl-hero-actions">
          <button onClick={onBack}>← Voltar</button>
          <button onClick={reload}><RefreshCw className={loading || refreshing ? 'spin' : ''}/>Atualizar</button>
          <button onClick={onLogout}>Sair</button>
        </div>
      </header>

      <main className="history-content esl-page-content">
        <section className={`esl-page-summary tone-${meta.tone}`}>
          <div className="esl-page-summary-main">
            <div className="esl-page-badge"><Icon/><span>{meta.label}</span></div>
            <div>
              <span className="eyebrow">SUPERVISÃO DA INTEGRAÇÃO</span>
              <h2>{summary.overview.headline || 'Status operacional das sincronizações'}</h2>
              <p>{error || summary.overview.note || 'Os dados abaixo ajudam o usuário final a entender quando os dados realmente foram sincronizados.'}</p>
            </div>
          </div>
          <div className="esl-page-summary-kpis">
            <article><span>Última atualização útil</span><strong>{lastCompletedAt ? formatDateTime(lastCompletedAt) : '—'}</strong></article>
            <article><span>Próximo ciclo previsto</span><strong>{nextPlannedAt ? `${formatHour(nextPlannedAt)} · ${countdownText(nextPlannedAt, now)}` : '—'}</strong></article>
            <article><span>Painel consultado</span><strong>{formatDateTime(summary.generatedAt)}</strong></article>
          </div>
        </section>

        <section className="os-kpis esl-kpis-grid">
          <motion.article><span>INTEGRAÇÕES OK</span><strong>{healthyCount}</strong></motion.article>
          <motion.article><span>EM ATENÇÃO</span><strong>{warningCount}</strong></motion.article>
          <motion.article><span>COM FALHA</span><strong>{criticalCount}</strong></motion.article>
          <motion.article><span>RITMOS</span><strong>{sortedReports.length ? sortedReports.map(r => r.frequencyMinutes ? (r.frequencyMinutes >= 60 ? `${Math.round(r.frequencyMinutes / 60)}h` : `${r.frequencyMinutes}m`) : '—').join(' · ') : '—'}</strong></motion.article>
        </section>

        <section className="esl-health-grid">
          {loading && !sortedReports.length ? (
            <div className="esl-history-empty">Carregando resumo das integrações...</div>
          ) : sortedReports.length ? (
            sortedReports.map(report => <ReportCard key={report.key} report={report} now={now}/>)
          ) : (
            <div className="esl-history-empty">Aguardando dados reais da integração no backend.</div>
          )}
        </section>

        <section className="history-table-section esl-history-section">
          <div className="history-table-head">
            <div>
              <span>HISTÓRICO OPERACIONAL</span>
              <h2>Últimas execuções</h2>
            </div>
            <small className="esl-muted">A tabela ajuda o time de manutenção a validar atrasos, falhas e tempos de execução.</small>
          </div>
          <RecentExecutionTable rows={summary.recentExecutions || []}/>
        </section>
      </main>
    </div>
  )
}
