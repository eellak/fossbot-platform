import stageAnimals from './data/stage_animals.json'
import stageCones from './data/stage_cones.json'
import stageEiffel from './data/stage_eiffel.json'
import stageMaze from './data/stage_maze.json'
import stageNumbers from './data/stage_numbers.json'
import stageObject from './data/stage_object.json'
import stageRamp from './data/stage_ramp.json'
import stageWhitePaper from './data/stage_white_paper.json'
import stageWhiteRect from './data/stage_white_rect.json'

/**
 * Built-in stage registry. Stage data lives inside the simulator source so the
 * engine is bundler-neutral (CRA, Vite, tests) and no longer depends on
 * Vite-only `import.meta.glob` or on the platform's legacy public directory.
 */
export type StageName = string
export type RawStageEntry = Record<string, unknown>
export type RawStageConfig = RawStageEntry[]

export const STAGES: Record<StageName, RawStageEntry[]> = {
  stage_animals: stageAnimals as RawStageEntry[],
  stage_cones: stageCones as RawStageEntry[],
  stage_eiffel: stageEiffel as RawStageEntry[],
  stage_maze: stageMaze as RawStageEntry[],
  stage_numbers: stageNumbers as RawStageEntry[],
  stage_object: stageObject as RawStageEntry[],
  stage_ramp: stageRamp as RawStageEntry[],
  stage_white_paper: stageWhitePaper as RawStageEntry[],
  stage_white_rect: stageWhiteRect as RawStageEntry[],
}

export const STAGE_NAMES: StageName[] = Object.keys(STAGES).sort()

export const DEFAULT_STAGE: StageName = 'stage_white_rect'

export { loadStage, loadStageEntries, type StageHandle } from './loader'
export type { LineSegment } from './visuals'
