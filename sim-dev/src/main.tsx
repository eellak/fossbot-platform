import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// StrictMode intentionally double-fires effects, which causes two concurrent
// async robot model loads before either completes — resulting in two robots.
// The simulator uses module-level singletons that don't tolerate double-mount.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
