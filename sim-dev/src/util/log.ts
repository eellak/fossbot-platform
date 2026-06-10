/**
 * Namespaced debug logger.
 *
 * Channels are silent by default. Enable them at runtime via localStorage:
 *
 *   localStorage.setItem('simv2.debug', 'physics,sync')   // enable specific channels
 *   localStorage.setItem('simv2.debug', '*')              // enable all channels
 *   localStorage.removeItem('simv2.debug')                // silence everything
 *
 * Errors and warnings should keep using `console.error` / `console.warn` so
 * they always surface — this logger is only for verbose diagnostic output.
 */

type ChannelName = 'physics' | 'sync' | 'world' | 'robot'

function readEnabled(): { all: boolean; set: Set<string> } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('simv2.debug') : null
    if (!raw) return { all: false, set: new Set() }
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    return { all: parts.includes('*'), set: new Set(parts) }
  } catch {
    return { all: false, set: new Set() }
  }
}

const enabled = readEnabled()

function make(channel: ChannelName) {
  const tag = `[${channel}]`
  return (...args: unknown[]) => {
    if (enabled.all || enabled.set.has(channel)) console.log(tag, ...args)
  }
}

export const log = {
  physics: make('physics'),
  sync: make('sync'),
  world: make('world'),
  robot: make('robot'),
}

export function isLogEnabled(channel: ChannelName): boolean {
  return enabled.all || enabled.set.has(channel)
}
