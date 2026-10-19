type OperationSource = {
  service?: string | null
  coletas?: number | string | null
  entregas?: number | string | null
  distribuicoes?: number | string | null
  transferencias?: number | string | null
}

export const DISTRIBUTION_SERVICE = 'Distribuição/Lotação'
export const TRANSFER_SERVICE = 'Transferência'
export const COLLECTION_SERVICE = 'Coleta'
export const OTHER_SERVICE = 'Sem serviço'
export type OperationKind = 'DISTRIBUTION' | 'TRANSFER' | 'COLLECTION' | 'OTHER'

function amount(value: number | string | null | undefined): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalized(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function operationKind(source?: OperationSource | null): OperationKind {
  if (!source) return 'OTHER'

  const hasDistribution =
    amount(source.entregas) > 0 ||
    amount(source.distribuicoes) > 0
  const hasTransfer = amount(source.transferencias) > 0
  const hasCollection = amount(source.coletas) > 0

  if (hasDistribution) return 'DISTRIBUTION'
  if (hasTransfer) return 'TRANSFER'
  if (hasCollection) return 'COLLECTION'

  const raw = String(source.service || '').trim()
  const comparable = normalized(raw)

  if (
    comparable.includes('distribui') ||
    comparable.includes('lotacao')
  ) return 'DISTRIBUTION'

  if (comparable.includes('transfer')) return 'TRANSFER'
  if (comparable.includes('coleta')) return 'COLLECTION'
  return 'OTHER'
}

export function operationLabelFromKind(kind: OperationKind): string {
  if (kind === 'DISTRIBUTION') return DISTRIBUTION_SERVICE
  if (kind === 'TRANSFER') return TRANSFER_SERVICE
  if (kind === 'COLLECTION') return COLLECTION_SERVICE
  return OTHER_SERVICE
}

export function operationKindFromOverride(value?: string | null): OperationKind | null {
  const comparable = normalized(value)
  if (!comparable) return null
  if (comparable.includes('distribui') || comparable.includes('lotacao')) return 'DISTRIBUTION'
  if (comparable.includes('transfer')) return 'TRANSFER'
  if (comparable.includes('coleta')) return 'COLLECTION'
  if (comparable.includes('sem servico')) return 'OTHER'
  return null
}

/**
 * Regra operacional de exibição:
 * Distribuição/Lotação > Transferência > Coleta.
 * Assim, se o caminhão tiver coleta e distribuição no mesmo manifesto,
 * a visão principal considera Distribuição/Lotação.
 */
export function operationLabel(source?: OperationSource | null, override?: string | null): string {
  return operationLabelFromKind(operationKindFromOverride(override) || operationKind(source))
}
