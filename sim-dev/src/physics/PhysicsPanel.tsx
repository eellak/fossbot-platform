import React from 'react'
import { Toggle } from '../ui'

export interface PhysicsOptions {
  collisionEnabled: boolean
  debugWireframes: boolean
  lockRollPitch: boolean
  gravityEnabled: boolean
}

interface Props {
  physicsOn: boolean
  physicsReady: boolean
  benchRunning: boolean
  panelOpen: boolean
  options: PhysicsOptions
  onTogglePhysics: () => void
  onTogglePanel: () => void
  onChangeOption: <K extends keyof PhysicsOptions>(key: K, value: PhysicsOptions[K]) => void
}

interface OptionRowProps {
  label: string
  description: string
  checked: boolean
  restartRequired?: boolean
  onChange: (v: boolean) => void
}

function OptionRow({ label, description, checked, restartRequired, onChange }: OptionRowProps) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', cursor: 'pointer',
      borderBottom: '1px solid #222',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: '#6f6', cursor: 'pointer' }}
      />
      <span style={{ flex: 1 }}>
        <span style={{ color: '#ccc', fontFamily: 'monospace', fontSize: 12 }}>{label}</span>
        {restartRequired && (
          <span style={{ color: '#555', fontFamily: 'monospace', fontSize: 10, marginLeft: 6 }}>↺</span>
        )}
        <br />
        <span style={{ color: '#555', fontFamily: 'monospace', fontSize: 10 }}>{description}</span>
      </span>
    </label>
  )
}

export function PhysicsPanel({
  physicsOn, physicsReady, benchRunning, panelOpen,
  options, onTogglePhysics, onTogglePanel, onChangeOption,
}: Props) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Main toggle */}
      <Toggle
        active={physicsOn}
        onClick={() => !benchRunning && onTogglePhysics()}
        title={physicsOn ? 'Disable Cannon-es physics' : 'Enable Cannon-es physics'}
      >
        ⚛ physics{physicsOn && !physicsReady ? '…' : ''}
      </Toggle>

      {/* Expand button */}
      <button
        onClick={() => !benchRunning && onTogglePanel()}
        title="Physics options"
        style={{
          background: panelOpen ? '#1a3a1a' : '#2a2a2a',
          color: panelOpen ? '#6f6' : '#555',
          border: `1px solid ${panelOpen ? '#363' : '#444'}`,
          borderLeft: 'none',
          borderRadius: '0 4px 4px 0',
          padding: '3px 7px',
          fontFamily: 'monospace', fontSize: 12,
          cursor: benchRunning ? 'not-allowed' : 'pointer',
          alignSelf: 'stretch',
        }}
      >
        {panelOpen ? '▴' : '▾'}
      </button>

      {/* Dropdown panel */}
      {panelOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: '#1a1a1a', border: '1px solid #444', borderRadius: 6,
          padding: '8px 12px', minWidth: 220, zIndex: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: '#666', fontFamily: 'monospace', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
            PHYSICS OPTIONS  <span style={{ color: '#333' }}>↺ = restart</span>
          </div>
          <OptionRow
            label="collision shapes"
            description="mirror stage objects to Cannon bodies"
            checked={options.collisionEnabled}
            restartRequired
            onChange={v => onChangeOption('collisionEnabled', v)}
          />
          <OptionRow
            label="debug wireframes"
            description="show Cannon body outlines"
            checked={options.debugWireframes}
            restartRequired
            onChange={v => onChangeOption('debugWireframes', v)}
          />
          <OptionRow
            label="lock pitch / roll"
            description="prevent robot from tipping over"
            checked={options.lockRollPitch}
            onChange={v => onChangeOption('lockRollPitch', v)}
          />
          <OptionRow
            label="gravity"
            description="9.82 m/s² downward"
            checked={options.gravityEnabled}
            onChange={v => onChangeOption('gravityEnabled', v)}
          />
        </div>
      )}
    </div>
  )
}
