import React from 'react'

export function Divider() {
  return <span style={{ width: 1, height: 18, background: '#333', flexShrink: 0 }} />
}

export function Toggle({ onClick, title, active, children }: {
  onClick: () => void; title?: string; active: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? '#1a3a1a' : '#2a2a2a',
      color: active ? '#6f6' : '#555',
      border: `1px solid ${active ? '#363' : '#444'}`,
      borderRadius: 4, padding: '3px 10px',
      fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

export function Btn({ onClick, title, accent, disabled, children }: {
  onClick: () => void; title?: string; accent?: boolean; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      background: accent ? '#3a1a1a' : '#2a2a2a',
      color: disabled ? '#444' : accent ? '#f88' : '#ccc',
      border: `1px solid ${accent ? '#633' : disabled ? '#333' : '#444'}`,
      borderRadius: 4, padding: '3px 10px',
      fontFamily: 'monospace', fontSize: 12,
      cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}
