export const challengeKinds = new Set([
  'spawn',
  'target',
  'checkpoint',
  'danger_zone',
  'sensor_region',
  'collectible',
  'push_object',
  'target_zone',
])

function legacyChallenge(entry, index) {
  const type = String(entry.type || '')
  const name = String(entry.name || '').toLowerCase()
  const color = String(entry.material?.color || '').toLowerCase()
  let kind = type === 'fossbot' ? 'spawn' : null
  if (type === 'base') {
    if (name.includes('object target zone')) kind = 'target_zone'
    else if (name.includes('checkpoint') || color === '#1e88e5' || color === 'blue') kind = 'checkpoint'
    else if (name.includes('danger') || name.includes('no-go') || color === '#e53935' || color === 'red') kind = 'danger_zone'
    else if (name.includes('sensor') || color === '#00acc1' || color === 'cyan') kind = 'sensor_region'
    else if (name.includes('target') || name.includes('goal') || color === '#43a047' || color === 'green') kind = 'target'
  }
  if (name.includes('collectible') || name.includes('gem')) kind = 'collectible'
  if (name.includes('push object') || name.includes('pushable')) kind = 'push_object'
  if (!kind) return null
  const slug = String(entry.name || (kind === 'spawn' ? 'robot-spawn' : kind))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || kind
  return {
    markerId: `${slug}-${index + 1}`,
    kind,
    order: kind === 'checkpoint' ? index + 1 : undefined,
    pickupRadius: kind === 'collectible' ? 0.28 : undefined,
  }
}

export function challengeForEntry(entry, index) {
  if (entry.hidden === true || entry.disabled === true) return null
  const value = entry.challenge
  if (value && typeof value === 'object' && !Array.isArray(value)
      && typeof value.markerId === 'string' && challengeKinds.has(value.kind)) {
    return {
      markerId: value.markerId,
      kind: value.kind,
      order: typeof value.order === 'number' ? value.order : undefined,
      pickupRadius: typeof value.pickupRadius === 'number' ? value.pickupRadius : undefined,
    }
  }
  return legacyChallenge(entry, index)
}

export function isMissionIncidentCollision(otherBodyHandle, missionMarkers) {
  if (otherBodyHandle === null || otherBodyHandle === undefined) return true
  return !missionMarkers.some((marker) =>
    marker.kind === 'push_object' && marker.body?.handle === otherBodyHandle)
}
