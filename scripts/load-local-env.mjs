import { loadEnvFile } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadLocalEnv() {
  for (const path of [resolve(repoRoot, '.env'), resolve(repoRoot, 'back-end/.env')]) {
    try {
      loadEnvFile(path)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}
