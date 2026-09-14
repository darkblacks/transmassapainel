import type { ManifestSummary, Vehicle } from '../types'

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000

export interface VehicleAttention {
  needsAttention: boolean
  maintenanceConflict: boolean
  invalidManifestIds: Set<number>
  staleManifestIds: Set<number>
  reasons: string[]
}

function manifestId(manifest: ManifestSummary): number {
  const id = Number(manifest.id)
  return Number.isFinite(id) ? id : 0
}

export function isInvalidManifest(manifest: ManifestSummary): boolean {
  return manifest.operationallyValid === false || Boolean(manifest.inconsistency)
}

export function isManifestOlderThanFourDays(manifest: ManifestSummary, now = Date.now()): boolean {
  if (!manifest.generatedAt) return false
  const generatedAt = new Date(manifest.generatedAt).getTime()
  if (Number.isNaN(generatedAt)) return false
  return now - generatedAt > FOUR_DAYS_MS
}

export function getVehicleAttention(vehicle: Vehicle, now = Date.now()): VehicleAttention {
  const manifests = vehicle.activeManifests?.length
    ? vehicle.activeManifests
    : (vehicle.manifest ? [vehicle.manifest] : [])

  const invalidManifestIds = new Set<number>()
  const staleManifestIds = new Set<number>()
  const reasons: string[] = []

  for (const manifest of manifests) {
    const id = manifestId(manifest)

    if (isInvalidManifest(manifest)) {
      if (id) invalidManifestIds.add(id)
      reasons.push(`Manifesto #${manifest.numero || manifest.id} sem serviço / inconsistente`)
    }

    if (isManifestOlderThanFourDays(manifest, now)) {
      if (id) staleManifestIds.add(id)
      reasons.push(`Manifesto #${manifest.numero || manifest.id} aberto há mais de 4 dias`)
    }
  }

  const maintenanceConflict =
    vehicle.operationalStatus === 'MAINTENANCE' &&
    manifests.some(manifest => !isInvalidManifest(manifest))

  if (maintenanceConflict) {
    reasons.unshift('OS aberta e manifesto operacional ativo ao mesmo tempo')
  }

  for (const alert of vehicle.operationalAlerts || []) {
    if (alert?.message && !reasons.includes(alert.message)) reasons.push(alert.message)
  }

  return {
    needsAttention: reasons.length > 0,
    maintenanceConflict,
    invalidManifestIds,
    staleManifestIds,
    reasons: [...new Set(reasons)]
  }
}
