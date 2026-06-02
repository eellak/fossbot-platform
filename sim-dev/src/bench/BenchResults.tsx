import React, { useEffect } from 'react'
import { Btn } from '../ui'
import type { StageResult, CamResult } from './types'
import { averageResults, fpsColor, CAM_KEYS } from './stats'

function camCell(c: CamResult) {
  return <>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.idle.fps.avg) }}>{c.idle.fps.avg}</td>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.idle.fps.min) }}>{c.idle.fps.min}</td>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#777' }}>{c.idle.ms.avg}</td>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.moving.fps.avg) }}>{c.moving.fps.avg}</td>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: fpsColor(c.moving.fps.min) }}>{c.moving.fps.min}</td>
    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#777' }}>{c.moving.ms.avg}</td>
  </>
}

function toMd(allRows: StageResult[]): string {
  const h1 = '| Stage | Load ms | Orbit idle fps avg/min | Orbit idle ms | Orbit move fps avg/min | Orbit move ms | Follow idle fps avg/min | Follow idle ms | Follow move fps avg/min | Follow move ms | Top idle fps avg/min | Top idle ms | Top move fps avg/min | Top move ms |'
  const sep = allRows[0] ? '|' + Array(15).fill('---|').join('') : ''
  const rows = allRows.map(r =>
    `| ${r.stage} | ${r.loaded ? r.loadMs : r.loadMs + ' ⚠'} ` +
    CAM_KEYS.map(k =>
      `| ${r[k].idle.fps.avg}/${r[k].idle.fps.min} | ${r[k].idle.ms.avg} ` +
      `| ${r[k].moving.fps.avg}/${r[k].moving.fps.min} | ${r[k].moving.ms.avg} `
    ).join('') + '|'
  )
  return [h1, sep, ...rows].join('\n')
}

export function BenchResults({ results, onClose }: { results: StageResult[]; onClose: () => void }) {
  const averaged = averageResults(results)
  const allRows = [...results, averaged]
  const md = toMd(allRows)

  useEffect(() => { console.log(md) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const thG = (label: string) => (
    <th colSpan={6} style={{ padding: '4px 10px', textAlign: 'center', color: '#888', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
      {label}
    </th>
  )
  const thS = (label: string) => (
    <th style={{ padding: '3px 10px', textAlign: 'right', color: '#555', borderBottom: '1px solid #222' }}>{label}</th>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #444', borderRadius: 6,
        padding: '20px 24px', maxWidth: '95vw', maxHeight: '90vh', overflowX: 'auto', overflowY: 'auto',
        fontFamily: 'monospace', fontSize: 12, color: '#ccc',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#aaa', fontSize: 13, fontWeight: 'bold' }}>Benchmark Results</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => navigator.clipboard.writeText(md)} title="Copy as Markdown table">📋 copy md</Btn>
            <Btn onClick={onClose} accent title="Close">✕ close</Btn>
          </div>
        </div>

        <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ padding: '4px 12px 4px 0', textAlign: 'left', color: '#666', borderBottom: '1px solid #222' }}>Stage</th>
              <th rowSpan={2} style={{ padding: '4px 10px', textAlign: 'right', color: '#666', borderBottom: '1px solid #222' }}>Load ms</th>
              {thG('orbit')} {thG('follow')} {thG('top')}
            </tr>
            <tr>
              {CAM_KEYS.map(k => <React.Fragment key={k}>
                {thS('idle avg')} {thS('idle min')} {thS('idle ms')}
                {thS('move avg')} {thS('move min')} {thS('move ms')}
              </React.Fragment>)}
            </tr>
          </thead>
          <tbody>
            {allRows.map(r => {
              const isAvg = r.stage === 'Average'
              return (
                <tr key={r.stage} style={isAvg ? { borderTop: '1px solid #555', background: '#222' } : { borderBottom: '1px solid #1e1e1e' }}>
                  <td style={{ padding: '4px 12px 4px 0', color: isAvg ? '#fff' : '#ddd', fontWeight: isAvg ? 'bold' : 'normal' }}>{r.stage}</td>
                  <td style={{ padding: '4px 10px', textAlign: 'right', color: r.loaded ? '#666' : '#f66' }}>{r.loadMs}{!r.loaded && ' ⚠'}</td>
                  {CAM_KEYS.map(k => <React.Fragment key={k}>{camCell(r[k])}</React.Fragment>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
