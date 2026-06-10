import type { SavedPosition } from './positionPresets'

const STORAGE_KEY = 'fossbot-position-presets-v1'

interface PresetsData {
  [stageName: string]: SavedPosition[]
}

function loadAll(): PresetsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data: PresetsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Stage-scoped position storage backed by localStorage.
 * Switching stages loads presets for the new stage; switching away persists
 * the previous stage's presets before clearing the in-memory map.
 */
export class PositionStore {
  private positions: Map<string, SavedPosition> = new Map()
  private currentStage: string = ''

  setStage(stageName: string) {
    if (stageName === this.currentStage) return

    // Persist current stage's presets before switching
    if (this.currentStage && this.positions.size > 0) {
      const all = loadAll()
      all[this.currentStage] = Array.from(this.positions.values())
      saveAll(all)
    }

    this.currentStage = stageName
    this.positions.clear()

    // Load presets for the new stage
    const all = loadAll()
    const saved = all[stageName]
    if (saved) {
      for (const entry of saved) {
        if (entry.name && entry.position && entry.rotation) {
          this.positions.set(entry.name, entry)
        }
      }
    }
  }

  save(name: string, position: SavedPosition['position'], rotation: SavedPosition['rotation']) {
    this.positions.set(name, { name, position, rotation })
    this.persist()
  }

  load(name: string): SavedPosition | undefined {
    return this.positions.get(name)
  }

  remove(name: string) {
    this.positions.delete(name)
    this.persist()
  }

  list(): string[] {
    return Array.from(this.positions.keys())
  }

  clear() {
    this.positions.clear()
    this.persist()
  }

  private persist() {
    if (!this.currentStage) return
    const all = loadAll()
    all[this.currentStage] = Array.from(this.positions.values())
    saveAll(all)
  }
}
