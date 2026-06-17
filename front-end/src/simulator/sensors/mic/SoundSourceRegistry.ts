// Module-level sound-source registry. The MicProvider samples every
// registered source each tick. The buzzer self-registers while playing.
// Future stage authors will register persistent sources (e.g. beepers,
// motors). See SENSOR_MODELS.md §1.

import * as THREE from 'three'

export interface SoundSource {
  /** Stable id. Used as the registry key — registering twice replaces. */
  id: string
  /** World-space position of the source, refreshed lazily on each tick. */
  worldPos(): THREE.Vector3
  /** Source-side amplitude in [0, 1]. Distance falloff is applied by the mic. */
  currentAmplitude0to1(): number
  /** Called by the registry on shutdown so authors can release resources. */
  dispose(): void
}

export type SourceEvent =
  | { kind: 'add'; source: SoundSource }
  | { kind: 'remove'; source: SoundSource }

export type SourceListener = (e: SourceEvent) => void

const sources = new Map<string, SoundSource>()
const listeners = new Set<SourceListener>()

export function registerSource(s: SoundSource): void {
  const prev = sources.get(s.id)
  if (prev) {
    sources.delete(s.id)
    for (const l of listeners) l({ kind: 'remove', source: prev })
  }
  sources.set(s.id, s)
  for (const l of listeners) l({ kind: 'add', source: s })
}

export function unregisterSource(id: string): void {
  const s = sources.get(id)
  if (!s) return
  sources.delete(id)
  for (const l of listeners) l({ kind: 'remove', source: s })
}

export function getSources(): ReadonlyMap<string, SoundSource> {
  return sources
}

export function onChange(l: SourceListener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
