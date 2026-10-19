import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, FileText, Wrench } from 'lucide-react'
import { getMaintenanceDetail, getManifestDetail } from '../services/api'
import type { MaintenanceDetail, ManifestDetail, ManifestSummary, Vehicle } from '../types'

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
function freightAddress(frete: Record<string, unknown>): string {
  return [
    frete.destinatario_endereco,
    frete.destinatario_numero,
    frete.destinatario_complemento,
    frete.destinatario_bairro,
    frete.destinatario_cidade,
    frete.destinatario_uf
  ]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ') || 'Endereço não cadastrado'
}
function collectionAddress(coleta: Record<string, unknown>): string {
  return [
    coleta.remetente_endereco,
    coleta.remetente_numero,
    coleta.remetente_complemento,
    coleta.remetente_bairro,
    coleta.remetente_cidade,
    coleta.remetente_uf
  ]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ') || 'Endereço da coleta não cadastrado'
}
function isCollectionManifest(manifest: ManifestSummary): boolean {
  return manifest.operationContext?.kind === 'COLLECTION' ||
    String(manifest.service || '').trim().toLowerCase().includes('coleta')
}

function when(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function normalizedStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function serviceState(manifest: ManifestSummary): 'TRANSIT' | 'COMMITTED' {
  const status = normalizedStatus(manifest.status)
  return status.includes('em trânsito') || status.includes('em transito') ? 'TRANSIT' : 'COMMITTED'
}

function serviceStateText(manifest: ManifestSummary): string {
  return serviceState(manifest) === 'TRANSIT' ? 'Em trânsito' : 'Contratado'
}
export default function ExpandedRow({ vehicle }: Props) {
  const [maintenance, setMaintenance] = useState<MaintenanceDetail | null>(null)
  const [maintenanceError, setMaintenanceError] = useState('')
  const [openManifestId, setOpenManifestId] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, ManifestDetail>>({})
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [manifestError, setManifestError] = useState<Record<number, string>>({})
  const services = useMemo<ManifestSummary[]>(() => {
    if (vehicle.activeManifests?.length) return vehicle.activeManifests
    return vehicle.manifest ? [vehicle.manifest] : []
  }, [vehicle.activeManifests, vehicle.manifest])

  useEffect(() => {
    let alive = true
    setMaintenance(null)
    setMaintenanceError('')
    setOpenManifestId(null)
    setDetails({})
    setManifestError({})
    if (vehicle.operationalStatus === 'MAINTENANCE') {
      getMaintenanceDetail(vehicle.plate)
        .then(data => alive && setMaintenance(data))
        .catch(err => alive && setMaintenanceError(err?.response?.data?.message || err.message))
    }

    return () => { alive = false }
  }, [vehicle.plate, vehicle.operationalStatus])


  useEffect(() => {
    let alive = true
    const collections = services.filter(isCollectionManifest)
    Promise.allSettled(
      collections.map(async manifest => {
        const id = Number(manifest.id)
        if (!Number.isFinite(id) || details[id]) return
        const data = await getManifestDetail(id)
        if (alive) setDetails(prev => prev[id] ? prev : ({ ...prev, [id]: data }))
      })
    ).catch(() => undefined)

    return () => { alive = false }
  }, [services])
  const currentMaintenance = maintenance?.active || maintenance || vehicle.maintenance

  const maintenanceLocation = normalizedStatus(currentMaintenance?.location)
  const maintenanceLaborTotal = currentMaintenance?.laborTotal

  const maintenanceParts =
    currentMaintenance?.partsTotal ?? currentMaintenance?.parts

  const maintenanceLaborOwn =
    currentMaintenance?.laborOwn ??
    (maintenanceLocation.includes('própr') || maintenanceLocation.includes('propr')
      ? maintenanceLaborTotal
      : null)

  const maintenanceLaborThird =
    currentMaintenance?.laborThird ??
    (maintenanceLocation.includes('terceir')
      ? maintenanceLaborTotal
      : null)

  const maintenanceOs =
    currentMaintenance?.serviceOrderNumber ??
    currentMaintenance?.serviceOrderId

  async function toggleManifest(manifest: ManifestSummary) {
    const id = Number(manifest.id)
    if (!Number.isFinite(id)) return

    if (openManifestId === id) {
      setOpenManifestId(null)
      return
    }

    setOpenManifestId(id)
    if (details[id]) return
    setLoadingId(id)
    setManifestError(prev => ({ ...prev, [id]: '' }))
    try {
      const data = await getManifestDetail(id)
      setDetails(prev => ({ ...prev, [id]: data }))
    } catch (err: any) {
      setManifestError(prev => ({
        ...prev,
        [id]: err?.response?.data?.message || err?.message || 'Não foi possível carregar o manifesto.'
      }))
    } finally {
      setLoadingId(current => current === id ? null : current)
    }
  }
  return (
    <div className="vehicle-details-stack">
      {vehicle.hasInconsistency && (
        <div className="operational-inconsistency">
          <AlertTriangle size={18}/>
          <div>
            <strong>Inconsistência operacional</strong>
            <span>{vehicle.inconsistencyReason || 'Veículo em manutenção possui serviço ativo.'}</span>
          </div>
        </div>
      )}
      {vehicle.operationalStatus === 'MAINTENANCE' && (
        <section className="expanded-section">
          <div className="expanded-section-title">
            <Wrench size={16}/>
            <strong>Manutenção atual</strong>
          </div>

          {maintenanceError && <div className="expand-error">{maintenanceError}</div>}
          {!currentMaintenance && !maintenanceError && <div className="expand-loading">Carregando manutenção...</div>}
          {currentMaintenance && (
            <div className="maintenance-expand">
              <div className="maint-cost"><span>OS</span><strong>#{maintenanceOs || '—'}</strong></div>
              <div className="maint-cost"><span>Peças</span><strong>{money(maintenanceParts)}</strong></div>
              <div className="maint-cost"><span>M.O. própria</span><strong>{money(maintenanceLaborOwn)}</strong></div>
              <div className="maint-cost"><span>M.O. terceiros</span><strong>{money(maintenanceLaborThird)}</strong></div>
              <div className="maint-cost total"><span>Total da OS</span><strong>{money(currentMaintenance.total)}</strong></div>
              <div className="maint-cost"><span>OS aberta em</span><strong>{when(currentMaintenance.openedAt)}</strong></div>
            </div>
          )}
        </section>
      )}
      <section className="expanded-section active-services-section">
        <div className="expanded-section-title service-title-line">
          <div>
            <strong>Serviços ativos / contratados</strong>
            <span>{services.length} {services.length === 1 ? 'manifesto ativo' : 'manifestos ativos'}</span>
          </div>
        </div>

        {!services.length && (
          <div className="no-active-services">Nenhum serviço ativo para esta placa.</div>
        )}
        <div className="active-service-list">
          {services.map(manifest => {
            const id = Number(manifest.id)
            const open = openManifestId === id
            const detail = details[id]
            const state = serviceState(manifest)
            const collectionRows = isCollectionManifest(manifest) ? (detail?.coletas || []) : []
            const firstCollection = collectionRows[0]
            const collectionLocation = firstCollection
              ? collectionAddress(firstCollection)
              : (manifest.operationContext?.kind === 'COLLECTION'
                  ? (manifest.operationContext?.label || 'Local da coleta carregando...')
                  : '')
            const collectionName = firstCollection
              ? String(firstCollection.remetente_fantasia || firstCollection.remetente_nome || '').trim()
              : ''
            const extraCollectionCount = Math.max(0, collectionRows.length - 1)
            return (
              <div className={`active-service-card service-${state.toLowerCase()}`} key={String(manifest.id)}>
                <button className="active-service-summary" onClick={() => toggleManifest(manifest)}>
                  <span className={`service-state-badge ${state === 'TRANSIT' ? 'transit' : 'committed'}`}>
                    {serviceStateText(manifest)}
                  </span>
                  <div className="service-main-info">
                    <strong>{manifest.service || 'Serviço'} · Manifesto #{manifest.numero || manifest.id}</strong>
                    <span>{manifest.motorista || 'Motorista não informado'}</span>
                    <span>Gerado em: {when((manifest as any).generatedAt || (manifest as any).data)}</span>
                  </div>
                  <div className="service-destination-info">
                    {isCollectionManifest(manifest) ? (
                      <>
                        <strong>Coleta em: {collectionLocation || 'Local da coleta carregando...'}</strong>
                        <span>
                          {collectionName ? `${collectionName} · ` : ''}
                          {extraCollectionCount > 0 ? `+${extraCollectionCount} local(is) · ` : ''}
                          {manifest.status || 'Status não informado'}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{manifest.destinationText || manifest.operationContext?.label || 'Destino não informado'}</strong>
                        <span>{manifest.status || 'Status não informado'}</span>
                      </>
                    )}
                  </div>
                  <span className="service-expand-icon">{open ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</span>
                </button>
                {open && (
                  <div className="service-manifest-detail">
                    {loadingId === id && <div className="expand-loading">Carregando notas e entregas...</div>}
                    {manifestError[id] && <div className="expand-error">{manifestError[id]}</div>}
                    {detail && (
                      <>
                        {isCollectionManifest(manifest) && detail.coletas.length > 0 && (
                          <div className="collection-locations-block">
                            <strong>Local(is) da coleta</strong>
                            {detail.coletas.map((coleta, index) => (
                              <div key={String(coleta.numero ?? index)}>
                                <span>{String(coleta.remetente_fantasia ?? coleta.remetente_nome ?? `Coleta ${index + 1}`)}</span>
                                <b>{collectionAddress(coleta)}</b>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="expand-title">
                          <strong>Notas fiscais · Manifesto #{String(detail.manifest.numero ?? manifest.numero ?? '')}</strong>
                          <span>{detail.cache === 'HIT' ? 'cache rápido' : 'consulta atualizada'}</span>
                        </div>
                        <div className="nf-table-head">
                          <span>NF</span><span>Pedido</span><span>Volumes</span><span>Peso</span><span>Valor</span>
                        </div>
                        {detail.notasFiscais.map((nf, index) => (
                          <div className="nf-table-row" key={String(nf.id ?? index)}>
                            <span><FileText size={14}/> {String(nf.numero_nf ?? '—')}</span>
                            <span>{String(nf.pedido ?? '—')}</span>
                            <span>{String(nf.volumes ?? 0)}</span>
                            <span>{Math.round(Number(nf.peso || 0)).toLocaleString('pt-BR')} kg</span>
                            <span>{money(nf.valor)}</span>
                          </div>
                        ))}
                        {!detail.notasFiscais.length && (
                          <div className="no-nf">Nenhuma NF vinculada aos fretes deste manifesto.</div>
                        )}
                        {!!detail.fretes.length && (
                          <div className="delivery-strip">
                            {detail.fretes.slice(0, 30).map((frete, index) => (
                              <div key={String(frete.id ?? index)}>
                                <strong>{String(frete.destinatario_fantasia ?? frete.destinatario_nome ?? 'Destino')}</strong>
                                <span>{freightAddress(frete)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
