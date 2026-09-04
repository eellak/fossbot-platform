import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

// `React.StrictMode` is intentionally NOT used here. It double-invokes effects
// in dev to surface cleanup bugs, but our `App.useEffect` bootstraps a one-shot
// chain (Rapier WASM init → stage load → robot load → physics body → vehicle)
// and making it idempotent would require a real refactor for little payoff in a
// single-root tool. Revisit if/when sim-v2 grows into a multi-component app.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)