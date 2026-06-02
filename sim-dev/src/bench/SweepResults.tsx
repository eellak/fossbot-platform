import React, { useEffect } from 'react'
import { Btn } from '../ui'
import type { StageResult, SweepResults } from './types'
import { deltaPct, fpsColor, deltaColor, CAM_KEYS } from './stats'

function toMd(paired: Array<{ stage: string; k: StageResult; p: StageResult | undefined }>, kinematic: StageResult[], physics: StageResult[]): string {
  const avgNum = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const avgK = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(kinematic.map(r => r[key][phase].fps.avg)))
  const avgP = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(physics.map(r => r[key][phase].fps.avg)))

  const header =
    '| Stage | ' +
    CAM_KEYS.flatMap(c => [`${c} idle kin`, `${c} idle phys`, `${c} idle Δ%`, `${c} move kin`, `${c} move phys`, `${c} move Δ%`]).join(' | ') +
    ' |'
  const sep = '|' + Array(1 + CAM_KEYS.length * 6).fill('---|').join('')
  const rows = paired.map(({ stage, k, p }) => {
    const cells = CAM_KEYS.flatMap(c => {
      const ki = k[c].idle.fps.avg
      const pi = p?.[c].idle.fps.avg ?? 0
      const km = k[c].moving.fps.avg
      const pm = p?.[c].moving.fps.avg ?? 0
      return [ki, pi, deltaPct(ki, pi), km, pm, deltaPct(km, pm)]
    })
    return `| ${stage} | ${cells.join(' | ')} |`
  })
  const avgCells = CAM_KEYS.flatMap(c => {
    const ki = avgK(c, 'idle'); const pi = avgP(c, 'idle')
    const km = avgK(c, 'moving'); const pm = avgP(c, 'moving')
    return [ki, pi, deltaPct(ki, pi), km, pm, deltaPct(km, pm)]
  })
  const avgRow = `| **Average** | ${avgCells.join(' | ')} |`
  return [header, sep, ...rows, avgRow].join('\n')
}

export function SweepResultsView({ results, onClose }: { results: SweepResults; onClose: () => void }) {
  const { kinematic, physics } = results

  const paired = kinematic.map(k => {
    const p = physics.find(x => x.stage === k.stage)
    return { stage: k.stage, k, p }
  })

  const avgNum = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const avgK = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(kinematic.map(r => r[key][phase].fps.avg)))
  const avgP = (key: 'orbit' | 'follow' | 'top', phase: 'idle' | 'moving') =>
    Math.round(avgNum(physics.map(r => r[key][phase].fps.avg)))

  const md = toMd(paired, kinematic, physics)
  useEffect(() => { console.log(md) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const thGroup = (label: string) => (
    <th colSpan={6} style={{ padding: '4px 10px', textAlign: 'center', color: '#888', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
      {label}
    </th>
  )
  const thSub = (label: string) => (
    <th style={{ padding: '3px 8px', textAlign: 'right', color: '#555', borderBottom: '1px solid #222', fontSize: 10 }}>{label}</th>
  )

  const cellCamPhase = (kinFps: number, physFps: number) => {
    const d = deltaPct(kinFps, physFps)
    return <>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: fpsColor(kinFps) }}>{kinFps}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: fpsColor(physFps) }}>{physFps}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: deltaColor(d), fontWeight: 'bold' }}>{d > 0 ? '+' : ''}{d.toFixed(1)}%</td>
    </>
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #444', borderRadius: 6,
        padding: '20px 24px', maxWidth: '98vw', maxHeight: '92vh', overflowX: 'auto', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: 12, color: '#ccc',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 'bold' }}>Kinematic vs Physics — FPS sweep</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => navigator.clipboard.writeText(md)} title="Copy as Markdown table">📋 copy md</Btn>
            <Btn onClick={onClose} accent title="Close">✕ close</Btn>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th rowSpan={3} style={{ padding: '4px 12px 4px 0', textAlign: 'left', color: '#666', borderBottom: '1px solid #222' }}>Stage</th>
              {CAM_KEYS.map(c => <React.Fragment key={c}>{thGroup(c)}</React.Fragment>)}
            </tr>
            <tr>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                <th colSpan={3} style={{ padding: '3px 6px', color: '#777', borderBottom: '1px solid #222', borderLeft: '1px solid #333', fontSize: 11 }}>idle</th>
                <th colSpan={3} style={{ padding: '3px 6px', color: '#777', borderBottom: '1px solid #222', borderLeft: '1px solid #333', fontSize: 11 }}>moving</th>
              </React.Fragment>)}
            </tr>
            <tr>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                {thSub('kin')}{thSub('phys')}{thSub('Δ')}
                {thSub('kin')}{thSub('phys')}{thSub('Δ')}
              </React.Fragment>)}
            </tr>
          </thead>
          <tbody>
            {paired.map(({ stage, k, p }) => (
              <tr key={stage} style={{ borderBottom: '1px solid #1e1e1e' }}>
                <td style={{ padding: '4px 12px 4px 0', color: '#ddd' }}>{stage}</td>
                {CAM_KEYS.map(c => <React.Fragment key={c}>
                  {cellCamPhase(k[c].idle.fps.avg, p?.[c].idle.fps.avg ?? 0)}
                  {cellCamPhase(k[c].moving.fps.avg, p?.[c].moving.fps.avg ?? 0)}
                </React.Fragment>)}
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #555', background: '#222' }}>
              <td style={{ padding: '4px 12px 4px 0', color: '#fff', fontWeight: 'bold' }}>Average</td>
              {CAM_KEYS.map(c => <React.Fragment key={c}>
                {cellCamPhase(avgK(c, 'idle'), avgP(c, 'idle'))}
                {cellCamPhase(avgK(c, 'moving'), avgP(c, 'moving'))}
              </React.Fragment>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
