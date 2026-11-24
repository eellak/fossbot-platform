import { FossbotSimulator } from './FossbotSimulator'
import type { SimEngineConfig } from './engine/types'
import { useRef, useState } from 'react'
import type { FossbotSimulatorHandle } from './FossbotSimulator'
import type { StageLoadError } from './stages/stageFormatCore'

export function App({ config }: { config?: Partial<SimEngineConfig> } = {}) {
  const simulator = useRef<FossbotSimulatorHandle>(null)
  const [error, setError] = useState<StageLoadError | null>(null)
  return (
    <>
    <FossbotSimulator
      ref={simulator}
      onLoadError={setError}
      config={config}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
    {error && <div role="alert" style={{ position: 'absolute', inset: '16px 16px auto', padding: 16, background: '#1a1a1a', color: 'white', fontFamily: 'system-ui', overflowWrap: 'anywhere' }}>
      <p>{error.message}</p>
      <button type="button" onClick={() => { void simulator.current?.retryStageLoad().catch(() => {}) }}>Retry stage load</button>
    </div>}
    </>
  )
}
