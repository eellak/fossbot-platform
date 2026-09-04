export interface StageAssetResolverOptions {
  /** Base URL for bundled simulator assets (for legacy js-simulator paths). */
  publicAssetBaseUrl?: string
  /** Base URL for stage-owned relative assets, e.g. a GitHub raw repo root. */
  stageAssetBaseUrl?: string | null
}

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '')
}

function normalizeRelativeAssetPath(value: string): string {
  return trimLeadingSlash(value.replace(/^\.\//, ''))
}

export function isAbsoluteAssetUrl(value: string): boolean {
  return ABSOLUTE_URL_RE.test(value)
}

export function resolveStageAssetUrl(url: string, options: StageAssetResolverOptions = {}): string {
  if (!url) return url
  if (isAbsoluteAssetUrl(url)) return url

  const publicBase = options.publicAssetBaseUrl ? trimTrailingSlash(options.publicAssetBaseUrl) : ''
  if (url.startsWith('/js-simulator/')) {
    return publicBase ? `${publicBase}${url.slice('/js-simulator'.length)}` : url
  }
  if (url.startsWith('js-simulator/')) {
    return publicBase ? `${publicBase}/${url.slice('js-simulator/'.length)}` : url
  }
  if (url.startsWith('/')) return url

  const stageBase = options.stageAssetBaseUrl?.trim()
  if (!stageBase) return url
  return `${trimTrailingSlash(stageBase)}/${normalizeRelativeAssetPath(url)}`
}

export function createStageAssetResolver(options: StageAssetResolverOptions = {}): (url: string) => string {
  return (url: string) => resolveStageAssetUrl(url, options)
}

export function stageAssetBaseUrlFromStageUrl(stageUrl: string): string | undefined {
  const trimmed = stageUrl.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    const pathname = url.pathname
    const lastSlash = pathname.lastIndexOf('/')
    if (lastSlash < 0) return undefined
    url.pathname = pathname.slice(0, lastSlash + 1)
    url.search = ''
    url.hash = ''
    return isAbsoluteAssetUrl(trimmed) ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    const lastSlash = trimmed.lastIndexOf('/')
    return lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : undefined
  }
}
