import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const simRoot = resolve(repoRoot, 'sim')
const frontendRoot = resolve(repoRoot, 'front-end')

const sourceAssets = resolve(simRoot, 'public/js-simulator')
const targetAssets = resolve(frontendRoot, 'public/simulator')
const sourceImages = resolve(simRoot, 'public/images')
const targetImages = resolve(frontendRoot, 'public/simulator/images')

// Public assets are merged, not deleted, so front-end-only additions under
// /public/simulator survive while source-of-truth assets are updated.
await mkdir(targetAssets, { recursive: true })
await cp(sourceAssets, targetAssets, { recursive: true, force: true })
await mkdir(targetImages, { recursive: true })
await cp(sourceImages, targetImages, { recursive: true, force: true })

console.log('Synced simulator assets:')
console.log(`  ${sourceAssets} -> ${targetAssets}`)
console.log(`  ${sourceImages} -> ${targetImages}`)
