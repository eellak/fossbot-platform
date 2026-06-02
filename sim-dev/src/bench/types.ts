export interface StatSummary { avg: number; min: number; max: number }

export interface CamResult {
  idle: { fps: StatSummary; ms: StatSummary }
  moving: { fps: StatSummary; ms: StatSummary }
}

export interface StageResult {
  stage: string
  loadMs: number
  loaded: boolean
  orbit: CamResult
  follow: CamResult
  top: CamResult
}

export interface SweepResults {
  kinematic: StageResult[]
  physics: StageResult[]
}
