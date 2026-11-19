export type LinePoint = [number, number]
export type LineCorner = null | { mode: 'sharp' } | { mode: 'rounded'; sizing: 'auto' } | { mode: 'rounded'; sizing: 'manual'; trim: number }
export interface LineGeometry {
  points: LinePoint[]
  closed?: boolean
  curveVersion?: 1 | 2
  corners?: LineCorner[]
  width?: number
  y?: number
}
export interface LineDiagnostic {
  code: string
  message: string
  severity: 'error' | 'notice'
  pointIndex?: number
}
export interface EvaluatedLine {
  route: LinePoint[]
  diagnostics: LineDiagnostic[]
  requestedTrims: number[]
  effectiveTrims: number[]
  segmentCount: number
  runnable: boolean
}
export const LINE_CURVE_VERSION: 2
export const MAX_LINE_SEGMENTS: 4096
export function sharpLineCorners(points: readonly unknown[], closed?: boolean): LineCorner[]
export function automaticLineCorners(points: readonly unknown[], closed?: boolean): LineCorner[]
export function validateLineGeometry(line: unknown): LineDiagnostic[]
export function evaluateLineGeometry(line: unknown): EvaluatedLine
