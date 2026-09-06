import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { getMaintenanceDetail, getManifestDetail } from '../services/api'
import type { MaintenanceDetail, ManifestDetail, Vehicle } from '../types'

interface Props {
  vehicle: Vehicle
}

function money(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const raw = String(value).trim()
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const number = Number(normalized.replace(/[^\d.-]/g, ''))
  return Number.isFinite(number)
    ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : raw
}

function when(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ExpandedRow({ vehicle }: Props) {
  const [manifest, setManifest] = useState<ManifestDetail | null>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setManifest(null)
    setMaintenance(null)
    setError('')

    if (vehicle.operationalStatus === 'MAINTENANCE') {
      getMaintenanceDetail(vehicle.plate)
        .then(data => alive && setMaintenance(data))
        .catch(err => alive && setError(err?.response?.data?.message || err.message))
      return () => { alive = false }
    }

    if (vehicle.manifest?.id) {
      getManifestDetail(vehicle.manifest.id)
        .then(data => alive && setManifest(data))
        .catch(err => alive && setError(err?.response?.data?.message || err.message))
    }

    return () => { alive = false }
  }, [vehicle.plate, vehicle.operationalStatus, vehicle.manifest?.id])

  if (error) return <div className="expand-error">{error}</div>

  if (vehicle.operationalStatus === 'MAINTENANCE') {
    if (!maintenance) return <div className="expand-loading">Carregando manutenção...</div>
    return (
      <div className="maintenance-expand">
        <div className="maint-cost"><span>OS</span><strong>#{maintenance.serviceOrderId || '—'}</strong></div>
        <div className="maint-cost"><span>Peças</span><strong>{money(maintenance.parts)}</strong></div>
        <div className="maint-cost"><span>M.O. própria</span><strong>{money(maintenance.laborOwn)}</strong></div>
        <div className="maint-cost"><span>M.O. terceiros</span><strong>{money(maintenance.laborThird)}</strong></div>
        <div className="maint-cost total"><span>Total da OS</span><strong>{money(maintenance.total)}</strong></div>
        <div className="maint-cost"><span>OS aberta em</span><strong>{when(maintenance.openedAt)}</strong></div>
      </div>
    )
  }

  if (!manifest) return <div className="expand-loading">Carregando notas e entregas...</div>

  return (
    <div className="manifest-expand">
      <div className="expand-title">
        <strong>Notas fiscais · Manifesto #{String(manifest.manifest.numero ?? '')}</strong>
        <span>{manifest.cache === 'HIT' ? 'cache rápido' : 'consulta atualizada'}</span>
      </div>

      <div className="nf-table-head">
        <span>NF</span><span>Pedido</span><span>Volumes</span><span>Peso</span><span>Valor</span>
      </div>

      {manifest.notasFiscais.map((nf, index) => (
        <div className="nf-table-row" key={String(nf.id ?? index)}>
          <span><FileText size={14}/> {String(nf.numero_nf ?? '—')}</span>
          <span>{String(nf.pedido ?? '—')}</span>
          <span>{String(nf.volumes ?? 0)}</span>
          <span>{Math.round(Number(nf.peso || 0)).toLocaleString('pt-BR')} kg</span>
          <span>{money(nf.valor)}</span>
        </div>
      ))}

      {!manifest.notasFiscais.length && (
        <div className="no-nf">Nenhuma NF vinculada aos fretes deste manifesto.</div>
      )}

      {!!manifest.fretes.length && (
        <div className="delivery-strip">
          {manifest.fretes.slice(0, 30).map((frete, index) => (
            <div key={String(frete.id ?? index)}>
              <strong>{String(frete.destinatario_fantasia ?? frete.destinatario_nome ?? 'Destino')}</strong>
              <span>{[frete.destinatario_cidade, frete.destinatario_uf].filter(Boolean).join('/')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
