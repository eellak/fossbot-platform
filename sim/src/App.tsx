import { FossbotSimulator } from './FossbotSimulator'
import type { SimEngineConfig } from './engine/types'

export function App({ config }: { config?: Partial<SimEngineConfig> } = {}) {
  return (
    <FossbotSimulator
      config={config}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
