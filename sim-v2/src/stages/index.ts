/**
 * Stage registry — populates from JSON files under `sim-v2/public/stages/`
 * via Vite's `import.meta.glob` (eager) so stage data is bundled at build
 * time. The keys of `STAGES` are stage names like `stage_object`, matching
 * the V1 js-simulator naming.
 */
const modules = import.meta.glob('../../public/stages/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown[]>

export type StageName = string
export type RawStageEntry = Record<string, unknown>

export const STAGES: Record<StageName, RawStageEntry[]> = {}

for (const [path, data] of Object.entries(modules)) {
  const match = path.match(/(stage_[a-z_]+)\.json$/)
  if (match) STAGES[match[1]] = data as RawStageEntry[]
}

export const STAGE_NAMES: StageName[] = Object.keys(STAGES).sort()

export const DEFAULT_STAGE: StageName = 'stage_object'

export { loadStage, type StageHandle } from './loader'
