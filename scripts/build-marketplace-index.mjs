#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const validationStates = new Set(['validated', 'unvalidated', 'error'])
const requiredFields = ['repoOwner', 'repoName', 'repoUrl', 'defaultBranch', 'commitSha', 'title', 'author', 'badges', 'publishedAt', 'updatedAt']

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    indexPath: 'index.json',
    validateStageRepos: false,
    writeEntryValidation: false,
    checkRun: false,
    failOnError: false,
    changedStageFiles: false,
  }
  let positionalRoot = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--validate-stage-repos') options.validateStageRepos = true
    else if (arg === '--write-entry-validation') options.writeEntryValidation = true
    else if (arg === '--check-run') options.checkRun = true
    else if (arg === '--fail-on-error') options.failOnError = true
    else if (arg === '--changed-stage-files') options.changedStageFiles = true
    else if (arg === '--root') options.root = argv[++index] || options.root
    else if (arg === '--index') options.indexPath = argv[++index] || options.indexPath
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/build-marketplace-index.mjs [root] [options]\n\nOptions:\n  --validate-stage-repos    Revalidate each entry's pinned revision and check its source branch\n  --write-entry-validation  Write validation and source-status metadata back to entries\n  --check-run               Create a GitHub check run when GitHub Actions env is present\n  --fail-on-error           Exit non-zero when pinned revision validation errors are found\n  --changed-stage-files     Validate only stage entry JSON files changed against the PR base branch\n  --index <path>            Output index path relative to root (default: index.json)`)
      process.exit(0)
    } else if (!arg.startsWith('--') && !positionalRoot) {
      options.root = arg
      positionalRoot = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

async function* walk(dir) {
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile() && entry.name.endsWith('.json')) yield path
  }
}

async function changedStageEntryPaths(root) {
  const baseRef = process.env.GITHUB_BASE_REF
  if (!baseRef) return null
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], { cwd: root })
    return new Set(stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('stages/') && line.endsWith('.json')))
  } catch (error) {
    console.warn(`Could not determine changed stage files; validating all entries. ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

function requireField(entry, field, file) {
  if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
    throw new Error(`${file}: missing ${field}`)
  }
}

function validateEntry(entry, file) {
  if (entry.marketplaceVersion !== 1) throw new Error(`${file}: marketplaceVersion must be 1`)
  for (const field of requiredFields) requireField(entry, field, file)
  if (!entry.repoName.startsWith('fossbot-')) throw new Error(`${file}: repoName must start with fossbot-`)
  if (!Array.isArray(entry.tags)) throw new Error(`${file}: tags must be an array`)
  if (typeof entry.badges?.verified !== 'boolean') throw new Error(`${file}: badges.verified must be a boolean`)
  if (!validationStates.has(entry.badges?.validation)) throw new Error(`${file}: invalid badges.validation`)
  if (entry.validation) {
    if (!validationStates.has(entry.validation.state)) throw new Error(`${file}: invalid validation.state`)
    if (entry.validation.state !== entry.badges.validation) throw new Error(`${file}: validation.state must match badges.validation`)
  }
  if (entry.verification && entry.verification.verified !== entry.badges.verified) {
    throw new Error(`${file}: verification.verified must match badges.verified`)
  }
  if (entry.sourceStatus && !['current', 'changes_ready_to_publish', 'unavailable', 'invalid'].includes(entry.sourceStatus.state)) {
    throw new Error(`${file}: invalid sourceStatus.state`)
  }
}

function githubHeaders() {
  const token = process.env.FOSSBOT_MARKETPLACE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'fossbot-marketplace-validation',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function githubJson(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || 'GET',
    headers: { ...githubHeaders(), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = payload?.message || `${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return payload
}

function encodePath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/')
}

async function readRepoJson(owner, repo, ref, path) {
  const payload = await githubJson(`/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`)
  if (payload?.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new Error(`${path} is missing or is not base64 content`)
  }
  return JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'))
}

function verifyManifest(manifest, entry) {
  if (manifest.kind !== 'fossbot-stage') throw new Error('fossbot.json kind must be fossbot-stage')
  const storage = manifest.storage || {}
  if (storage.repoOwner && String(storage.repoOwner).toLowerCase() !== String(entry.repoOwner).toLowerCase()) {
    throw new Error('fossbot.json storage.repoOwner does not match entry repoOwner')
  }
  if (storage.repoName && String(storage.repoName).toLowerCase() !== String(entry.repoName).toLowerCase()) {
    throw new Error('fossbot.json storage.repoName does not match entry repoName')
  }
}

async function validateStageRepo(entry) {
  try {
    const repo = await githubJson(`/repos/${entry.repoOwner}/${entry.repoName}`)
    if (repo.private) throw new Error('Stage repository must be public')

    const branch = await githubJson(`/repos/${entry.repoOwner}/${entry.repoName}/commits/${encodeURIComponent(entry.defaultBranch)}`)
    const branchSha = branch?.sha
    if (!branchSha) throw new Error(`Could not resolve ${entry.defaultBranch}`)
    const sourceStatus = branchSha === entry.commitSha
      ? { state: 'current', sourceCommitSha: branchSha, message: 'The source repository matches the published revision.' }
      : { state: 'changes_ready_to_publish', sourceCommitSha: branchSha, message: 'The source repository has changes that are not yet published.' }

    const [stage, manifest] = await Promise.all([
      readRepoJson(entry.repoOwner, entry.repoName, entry.commitSha, 'stage.json'),
      readRepoJson(entry.repoOwner, entry.repoName, entry.commitSha, 'fossbot.json'),
    ])
    if (!stage || typeof stage !== 'object' || !stage.config) throw new Error('stage.json must contain a FOSSBot stage record with config')
    verifyManifest(manifest, entry)
    return { state: 'validated', message: 'Published stage commit passed marketplace validation.', sourceStatus }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'error',
      message,
      sourceStatus: {
        state: /not found|private|denied|404|403/i.test(message) ? 'unavailable' : 'invalid',
        sourceCommitSha: null,
        message,
      },
    }
  }
}

function applyValidation(entry, result, checkedAt) {
  entry.badges = {
    verified: Boolean(entry.badges?.verified),
    validation: result.state,
  }
  entry.validation = {
    state: result.state,
    commitSha: entry.commitSha,
    checkedAt,
    checkRunUrl: null,
    message: result.message,
  }
  entry.verification = entry.verification || {
    verified: entry.badges.verified,
    reviewedAt: null,
    reviewedBy: null,
    reviewPullRequest: null,
  }
  entry.verification.verified = entry.badges.verified
  entry.sourceStatus = {
    ...result.sourceStatus,
    checkedAt,
  }
}

function buildIndex(entries) {
  const stages = [...entries].sort((a, b) => {
    const updated = String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    if (updated) return updated
    return `${a.repoOwner}/${a.repoName}`.localeCompare(`${b.repoOwner}/${b.repoName}`)
  })
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    stages,
  }
}

function buildReport(results, schemaErrors) {
  const counts = { validated: 0, unvalidated: 0, error: 0 }
  for (const result of results) counts[result.state] += 1
  const lines = [
    `Validated: ${counts.validated}`,
    `Unvalidated: ${counts.unvalidated}`,
    `Error: ${counts.error}`,
  ]
  if (schemaErrors.length) {
    lines.push('', 'Schema errors:')
    for (const error of schemaErrors.slice(0, 20)) lines.push(`- ${error}`)
  }
  const problemResults = results.filter((result) => result.state !== 'validated')
  if (problemResults.length) {
    lines.push('', 'Stage validation details:')
    for (const result of problemResults.slice(0, 20)) lines.push(`- ${result.name}: ${result.state} — ${result.message}`)
  }
  return { counts, summary: lines.join('\n') }
}

async function createCheckRun(report, conclusion) {
  const repository = process.env.GITHUB_REPOSITORY
  const headSha = process.env.FOSSBOT_MARKETPLACE_CHECK_SHA || process.env.GITHUB_SHA
  const token = process.env.FOSSBOT_MARKETPLACE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!repository || !headSha || !token) {
    console.warn('Skipping check run: GITHUB_REPOSITORY, check SHA, or token is missing.')
    return
  }
  const outputTitle = conclusion === 'success' ? 'Marketplace validation passed' : 'Marketplace validation needs attention'
  try {
    await githubJson(`/repos/${repository}/check-runs`, {
      method: 'POST',
      body: {
        name: 'FOSSBot Marketplace Validation',
        head_sha: headSha,
        status: 'completed',
        conclusion,
        output: {
          title: outputTitle,
          summary: report.summary,
        },
      },
    })
  } catch (error) {
    console.warn(`Could not create check run: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const stagesDir = join(options.root, 'stages')
  const outPath = join(options.root, options.indexPath)
  const checkedAt = new Date().toISOString()

  let stageFiles = []
  for await (const file of walk(stagesDir)) stageFiles.push(file)
  stageFiles.sort()

  if (options.changedStageFiles) {
    const changed = await changedStageEntryPaths(options.root)
    if (changed) {
      stageFiles = stageFiles.filter((file) => changed.has(relative(options.root, file)))
      console.log(`Validating ${stageFiles.length} changed stage entr${stageFiles.length === 1 ? 'y' : 'ies'}.`)
    }
  }

  const entries = []
  const entryFiles = []
  const schemaErrors = []
  for (const file of stageFiles) {
    const displayFile = relative(options.root, file) || file
    try {
      const entry = JSON.parse(await readFile(file, 'utf8'))
      validateEntry(entry, displayFile)
      entries.push(entry)
      entryFiles.push(file)
    } catch (error) {
      schemaErrors.push(error instanceof Error ? error.message : String(error))
    }
  }

  const results = []
  if (!schemaErrors.length && options.validateStageRepos) {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const result = await validateStageRepo(entry)
      applyValidation(entry, result, checkedAt)
      results.push({ name: `${entry.repoOwner}/${entry.repoName}`, ...result })
      if (options.writeEntryValidation) {
        await writeFile(entryFiles[index], `${JSON.stringify(entry, null, 2)}\n`)
      }
    }
  } else {
    for (const entry of entries) {
      results.push({ name: `${entry.repoOwner}/${entry.repoName}`, state: entry.badges.validation, message: entry.validation?.message || 'Schema-only validation.' })
    }
  }

  if (!schemaErrors.length) {
    await writeFile(outPath, `${JSON.stringify(buildIndex(entries), null, 2)}\n`)
    console.log(`Wrote ${outPath} with ${entries.length} stage${entries.length === 1 ? '' : 's'}`)
  }

  const report = buildReport(results, schemaErrors)
  console.log(report.summary)
  const hasErrors = schemaErrors.length > 0 || report.counts.error > 0
  const conclusion = hasErrors ? 'failure' : report.counts.unvalidated > 0 ? 'neutral' : 'success'
  if (options.checkRun) await createCheckRun(report, conclusion)
  if (options.failOnError && hasErrors) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
