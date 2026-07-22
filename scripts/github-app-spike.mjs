#!/usr/bin/env node

import { createServer } from 'node:http'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomBytes, createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const GITHUB_API = 'https://api.github.com'
const GITHUB_WEB = 'https://github.com'
const API_VERSION = '2022-11-28'

class GitHubApiError extends Error {
  constructor(message, response, data) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = response.status
    this.url = response.url
    this.data = data
  }
}

function usage() {
  console.log(`GitHub App stage storage spike

This script tests the risky GitHub App assumptions for FOSSBot stage storage:
  1. authorize a GitHub App user token
  2. create a public fossbot-* repo
  3. add that repo to a selected GitHub App installation
  4. write stage.json, fossbot.json, LICENSE, and assets/test.glb
  5. update stage.json with SHA conflict detection
  6. try topics and check-runs with the installation token

Usage:
  node scripts/github-app-spike.mjs [options]

Options:
  --owner <login>          GitHub user/org account that will own the repo
                           (default: authenticated GitHub user)
  --repo <name>            Repo name to create (default: fossbot-spike-<timestamp>)
  --callback-port <port>   Local OAuth callback port (default: 8787)
  --allow-all-installation Continue if the app installation is all-repositories
                           (default: fail; v1 should require selected repos)
  --delete-repo            Attempt to delete the spike repo at the end
                           (off by default; may require extra permission)
  --no-open                Print the authorization URL instead of opening browser
  -h, --help               Show this help

Required env:
  GITHUB_APP_ID
  GITHUB_APP_CLIENT_ID
  GITHUB_APP_CLIENT_SECRET
  GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH

Optional env:
  GITHUB_APP_SLUG                         Used to print install URL if /app lacks slug
  GITHUB_USER_TOKEN                       Skip browser auth and use this GitHub App user token
  GITHUB_SPIKE_OWNER                      Same as --owner
  GITHUB_SPIKE_REPO_NAME                  Same as --repo
  GITHUB_SPIKE_CALLBACK_PORT              Same as --callback-port
  GITHUB_SPIKE_ALLOW_ALL_INSTALLATION=1   Same as --allow-all-installation
  GITHUB_SPIKE_DELETE_REPO=1              Same as --delete-repo
  GITHUB_SPIKE_FORBIDDEN_REPO=owner/repo  Harmless access-denial probe
  GITHUB_SPIKE_FORBIDDEN_WRITE_REPO=owner/repo
                                           Opt-in destructive denial probe. The script
                                           tries to create then delete a temp file and
                                           expects GitHub to reject it.

Notes:
  - The script creates a public repository by default and leaves it in place.
  - The repo is created with auto_init=true so Contents API writes have a branch.
  - Production may use Git Data API for a cleaner initial commit.
`)
}

function parseArgs(argv) {
  const options = {
    owner: process.env.GITHUB_SPIKE_OWNER || '',
    repo: process.env.GITHUB_SPIKE_REPO_NAME || '',
    callbackPort: Number(process.env.GITHUB_SPIKE_CALLBACK_PORT || 8787),
    allowAllInstallation: process.env.GITHUB_SPIKE_ALLOW_ALL_INSTALLATION === '1',
    deleteRepo: process.env.GITHUB_SPIKE_DELETE_REPO === '1',
    openBrowser: true,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--owner') {
      options.owner = requiredArg(argv, ++i, '--owner')
    } else if (arg.startsWith('--owner=')) {
      options.owner = arg.slice('--owner='.length)
    } else if (arg === '--repo') {
      options.repo = requiredArg(argv, ++i, '--repo')
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length)
    } else if (arg === '--callback-port') {
      options.callbackPort = Number(requiredArg(argv, ++i, '--callback-port'))
    } else if (arg.startsWith('--callback-port=')) {
      options.callbackPort = Number(arg.slice('--callback-port='.length))
    } else if (arg === '--allow-all-installation') {
      options.allowAllInstallation = true
    } else if (arg === '--delete-repo') {
      options.deleteRepo = true
    } else if (arg === '--no-open') {
      options.openBrowser = false
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!Number.isInteger(options.callbackPort) || options.callbackPort <= 0) {
    throw new Error('--callback-port must be a positive integer')
  }

  return options
}

function requiredArg(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
  return value
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function makeAppJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  }
  const input = `${base64urlJson(header)}.${base64urlJson(payload)}`
  const signer = createSign('RSA-SHA256')
  signer.update(input)
  signer.end()
  const signature = signer.sign(privateKey).toString('base64url')
  return `${input}.${signature}`
}

async function readPrivateKey() {
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    return process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH
  if (privateKeyPath) return readFile(privateKeyPath, 'utf8')
  throw new Error('Missing required env: GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH')
}

async function api(token, method, path, body, options = {}) {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  const allowed = options.allowedStatuses || []
  if (!response.ok && !allowed.includes(response.status)) {
    throw new GitHubApiError(`${method} ${path} failed with ${response.status}`, response, data)
  }
  return { response, data }
}

function logStep(title) {
  console.log(`\n== ${title}`)
}

function logOk(message) {
  console.log(`✓ ${message}`)
}

function logWarn(message) {
  console.warn(`⚠ ${message}`)
}

function logInfo(message) {
  console.log(`• ${message}`)
}

function printApiError(error) {
  if (error instanceof GitHubApiError) {
    console.error(`GitHub API error: ${error.message}`)
    console.error(`URL: ${error.url}`)
    if (error.data) console.error(JSON.stringify(error.data, null, 2))
    return
  }
  console.error(error)
}

async function openUrl(url) {
  let command
  let args
  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.unref()
  } catch {
    logWarn('Could not open browser automatically. Copy the URL below instead.')
    console.log(url)
  }
}

async function getUserTokenViaBrowser({ clientId, clientSecret, callbackPort, openBrowser }) {
  if (process.env.GITHUB_USER_TOKEN) {
    logInfo('Using GITHUB_USER_TOKEN from env; skipping browser authorization.')
    return process.env.GITHUB_USER_TOKEN
  }

  const state = randomBytes(18).toString('hex')
  const redirectUri = `http://127.0.0.1:${callbackPort}/callback`
  const authorizeUrl = new URL('/login/oauth/authorize', GITHUB_WEB)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', redirectUri)
        if (reqUrl.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const returnedState = reqUrl.searchParams.get('state')
        const returnedCode = reqUrl.searchParams.get('code')
        const returnedError = reqUrl.searchParams.get('error')
        if (returnedError) throw new Error(`GitHub authorization failed: ${returnedError}`)
        if (!returnedCode) throw new Error('GitHub callback did not include code')
        if (returnedState !== state) throw new Error('GitHub callback state mismatch')

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>FOSSBot GitHub App spike connected.</h1><p>You can return to the terminal.</p>')
        server.close()
        resolve(returnedCode)
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end(error.message)
        server.close()
        reject(error)
      }
    })

    server.on('error', reject)
    server.listen(callbackPort, '127.0.0.1', async () => {
      console.log(`Open this URL to authorize the GitHub App user token:\n${authorizeUrl.toString()}\n`)
      if (openBrowser) await openUrl(authorizeUrl.toString())
    })
  })

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await response.json()
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`GitHub token exchange failed: ${JSON.stringify(data)}`)
  }
  if (data.refresh_token) {
    logInfo('GitHub returned an expiring user token with refresh_token. Production should store the refresh token encrypted, not just the access token.')
  }
  return data.access_token
}

async function prompt(question) {
  const rl = createInterface({ input, output })
  try {
    return await rl.question(question)
  } finally {
    rl.close()
  }
}

function defaultRepoName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `fossbot-spike-${stamp}`
}

function assertFossbotRepoName(name) {
  if (!/^fossbot-[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error(`Spike repo must start with fossbot- and use GitHub-safe characters. Got: ${name}`)
  }
}

async function createRepo(userToken, owner, userLogin, repoName) {
  const body = {
    name: repoName,
    description: 'Temporary FOSSBot GitHub App stage storage spike repo',
    private: false,
    auto_init: true,
  }
  const path = owner === userLogin ? '/user/repos' : `/orgs/${owner}/repos`
  const { data } = await api(userToken, 'POST', path, body)
  return data
}

async function listUserInstallations(userToken, appId, owner) {
  const installations = []
  let page = 1
  while (true) {
    const { data } = await api(userToken, 'GET', `/user/installations?per_page=100&page=${page}`)
    const next = Array.isArray(data?.installations) ? data.installations : []
    installations.push(...next)
    if (!next.length || next.length < 100) break
    page += 1
  }
  return installations.filter((installation) => {
    const sameApp = String(installation.app_id) === String(appId)
    const sameOwner = !owner || installation.account?.login?.toLowerCase() === owner.toLowerCase()
    return sameApp && sameOwner
  })
}

async function listInstallationRepos(userToken, installationId) {
  const repos = []
  let page = 1
  while (true) {
    const { data } = await api(userToken, 'GET', `/user/installations/${installationId}/repositories?per_page=100&page=${page}`)
    const next = Array.isArray(data?.repositories) ? data.repositories : []
    repos.push(...next)
    if (!next.length || next.length < 100) break
    page += 1
  }
  return repos
}

async function ensureSelectedInstallation({ userToken, appId, appSlug, owner, repo, allowAllInstallation }) {
  let installations = await listUserInstallations(userToken, appId, owner)

  if (!installations.length) {
    const installUrl = appSlug
      ? `${GITHUB_WEB}/apps/${appSlug}/installations/new`
      : `${GITHUB_WEB}/settings/apps`
    logWarn(`No installation found for ${owner}. Install the app for selected repositories and select ${repo.full_name}.`)
    console.log(`Install URL: ${installUrl}`)
    await openUrl(installUrl)
    await prompt('Press Enter after installing the GitHub App on the spike repo...')
    installations = await listUserInstallations(userToken, appId, owner)
  }

  if (!installations.length) {
    throw new Error(`Still no GitHub App installation found for ${owner}`)
  }
  if (installations.length > 1) {
    logWarn(`Multiple installations found for ${owner}; using installation ${installations[0].id}`)
  }

  const installation = installations[0]
  logInfo(`Using installation ${installation.id} on ${installation.account?.login} with repository_selection=${installation.repository_selection}`)

  if (installation.repository_selection === 'all' && !allowAllInstallation) {
    throw new Error('Installation has repository_selection=all. For this feature, reinstall the app with selected repositories only, or rerun with --allow-all-installation to inspect behavior.')
  }

  if (installation.repository_selection === 'selected') {
    const reposBefore = await listInstallationRepos(userToken, installation.id)
    const alreadyInstalled = reposBefore.some((candidate) => candidate.id === repo.id)
    if (!alreadyInstalled) {
      logInfo(`Adding ${repo.full_name} to selected-repository installation ${installation.id}`)
      await api(userToken, 'PUT', `/user/installations/${installation.id}/repositories/${repo.id}`)
      logOk('Added repo to GitHub App installation')
    } else {
      logOk('Repo is already in the selected GitHub App installation')
    }

    const reposAfter = await listInstallationRepos(userToken, installation.id)
    if (!reposAfter.some((candidate) => candidate.id === repo.id)) {
      throw new Error(`Repo ${repo.full_name} is still not visible in installation ${installation.id}`)
    }
  }

  return installation
}

async function createInstallationToken(appJwt, installationId, repoId) {
  const { data } = await api(appJwt, 'POST', `/app/installations/${installationId}/access_tokens`, {
    repository_ids: [repoId],
  })
  return data.token
}

function encodeContent(content) {
  if (Buffer.isBuffer(content)) return content.toString('base64')
  return Buffer.from(String(content), 'utf8').toString('base64')
}

async function getFile(owner, repoName, path, token, allowedStatuses = [404]) {
  const { response, data } = await api(token, 'GET', `/repos/${owner}/${repoName}/contents/${encodeURIComponentPath(path)}`, undefined, { allowedStatuses })
  if (response.status === 404) return null
  return data
}

function encodeURIComponentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function putFile(owner, repoName, path, content, message, token, sha) {
  const body = {
    message,
    content: encodeContent(content),
  }
  if (sha) body.sha = sha
  const { data } = await api(token, 'PUT', `/repos/${owner}/${repoName}/contents/${encodeURIComponentPath(path)}`, body)
  return data
}

async function deleteFile(owner, repoName, path, message, token, sha) {
  return api(token, 'DELETE', `/repos/${owner}/${repoName}/contents/${encodeURIComponentPath(path)}`, {
    message,
    sha,
  })
}

function sampleStageRecord() {
  const now = new Date().toISOString()
  return {
    id: 'github-app-spike',
    title: 'GitHub App Spike Stage',
    description: 'Temporary stage written by the FOSSBot GitHub App spike.',
    createdAt: now,
    updatedAt: now,
    config: [
      {
        type: 'floor',
        dimensions: [3, 3],
        material: { color: 'dodgerblue' },
        name: 'floor',
      },
      {
        type: 'base',
        dimensions: [0.5, 0.5],
        material: { color: '#43a047' },
        position: [0.8, -0.8],
        name: 'target',
      },
      {
        type: 'fossbot',
        position: [-0.8, 0, 0.8],
        orientation: [0, 2.35, 0],
      },
      {
        type: 'model',
        filename: 'assets/test.glb',
        format: 'glb',
        position: [0, 0, 0],
        scale: 1,
        name: 'dummy asset reference',
        collision: 'none',
      },
    ],
    editor: {
      version: 2,
      groups: [],
      validationOverrides: {},
      floor: {
        name: 'floor',
        dimensions: [3, 3],
        color: 'dodgerblue',
        texture: '',
        repeat: [25, 25],
        offset: [0, 0],
      },
      objects: [],
    },
  }
}

function sampleManifest(owner, repoName, userLogin) {
  return {
    manifestVersion: 1,
    schemaVersion: 2,
    kind: 'fossbot-stage',
    title: 'GitHub App Spike Stage',
    description: 'Temporary FOSSBot GitHub App stage storage spike.',
    author: {
      platformUsername: 'spike-user',
      githubUsername: userLogin,
    },
    storage: {
      provider: 'github_app',
      repoOwner: owner,
      repoName,
    },
    validation: {
      state: 'unvalidated',
      commitSha: null,
      checkedAt: null,
    },
  }
}

function ccByLicenseStub() {
  return `Creative Commons Attribution 4.0 International\n\nThis temporary spike repository is intended to use CC-BY-4.0 for FOSSBot stage content.\nReplace this stub with the full license text in production.\n`
}

async function writeStageFiles({ owner, repoName, userLogin, token }) {
  const stage = sampleStageRecord()
  const manifest = sampleManifest(owner, repoName, userLogin)
  const dummyGlb = Buffer.from('glTF\x02\x00\x00\x00fossbot-spike-dummy-binary\n', 'binary')

  const stageResult = await putFile(owner, repoName, 'stage.json', JSON.stringify(stage, null, 2), 'chore(stage): spike initial stage', token)
  await putFile(owner, repoName, 'fossbot.json', JSON.stringify(manifest, null, 2), 'chore(stage): spike manifest', token)
  await putFile(owner, repoName, 'LICENSE', ccByLicenseStub(), 'chore(stage): spike license', token)
  await putFile(owner, repoName, 'assets/test.glb', dummyGlb, 'chore(stage): spike binary asset', token)
  return stageResult
}

async function testShaConflict({ owner, repoName, token, initialSha }) {
  const remoteStage = sampleStageRecord()
  remoteStage.description = 'Remote edit used to force a stale SHA conflict.'
  const remoteResult = await putFile(
    owner,
    repoName,
    'stage.json',
    JSON.stringify(remoteStage, null, 2),
    'chore(stage): spike remote edit',
    token,
    initialSha,
  )

  const staleStage = sampleStageRecord()
  staleStage.description = 'This stale write should be rejected.'
  const staleBody = {
    message: 'chore(stage): stale write should fail',
    content: encodeContent(JSON.stringify(staleStage, null, 2)),
    sha: initialSha,
  }
  const { response, data } = await api(
    token,
    'PUT',
    `/repos/${owner}/${repoName}/contents/stage.json`,
    staleBody,
    { allowedStatuses: [409] },
  )
  if (response.status !== 409) {
    throw new Error(`Expected stale stage.json write to return 409, got ${response.status}: ${JSON.stringify(data)}`)
  }

  const finalStage = sampleStageRecord()
  finalStage.description = 'Final post-conflict stage content.'
  const finalResult = await putFile(
    owner,
    repoName,
    'stage.json',
    JSON.stringify(finalStage, null, 2),
    'chore(stage): spike final stage',
    token,
    remoteResult.content.sha,
  )
  return finalResult.commit.sha
}

async function setTopics(owner, repoName, token) {
  const { data } = await api(token, 'PUT', `/repos/${owner}/${repoName}/topics`, {
    names: ['fossbot', 'fossbot-stage', 'fossbot-spike'],
  })
  return data
}

async function createCheckRun(owner, repoName, headSha, token) {
  const { data } = await api(token, 'POST', `/repos/${owner}/${repoName}/check-runs`, {
    name: 'fossbot-stage-validation-spike',
    head_sha: headSha,
    status: 'completed',
    conclusion: 'success',
    output: {
      title: 'Spike validation passed',
      summary: 'This check run was created by the FOSSBot GitHub App spike.',
    },
  })
  return data
}

async function probeForbiddenRepo(token) {
  const target = process.env.GITHUB_SPIKE_FORBIDDEN_REPO
  if (!target) return
  const [owner, repoName] = target.split('/')
  if (!owner || !repoName) throw new Error('GITHUB_SPIKE_FORBIDDEN_REPO must be owner/repo')
  const { response } = await api(token, 'GET', `/repos/${owner}/${repoName}/installation`, undefined, { allowedStatuses: [403, 404] })
  if (response.ok) {
    logWarn(`Installation token can see installation metadata for ${target}. This may mean the repo is installed or accessible.`)
  } else {
    logOk(`Harmless forbidden repo probe rejected for ${target} with ${response.status}`)
  }
}

async function probeForbiddenWrite(token) {
  const target = process.env.GITHUB_SPIKE_FORBIDDEN_WRITE_REPO
  if (!target) return
  const [owner, repoName] = target.split('/')
  if (!owner || !repoName) throw new Error('GITHUB_SPIKE_FORBIDDEN_WRITE_REPO must be owner/repo')
  const path = `.fossbot-spike-deny-${Date.now()}.txt`
  const body = {
    message: 'chore: forbidden FOSSBot spike write probe',
    content: encodeContent('This file should not be writable by the FOSSBot installation token.\n'),
  }
  const { response, data } = await api(token, 'PUT', `/repos/${owner}/${repoName}/contents/${path}`, body, { allowedStatuses: [403, 404] })
  if (response.status === 403 || response.status === 404) {
    logOk(`Forbidden write probe rejected for ${target} with ${response.status}`)
    return
  }

  logWarn(`CRITICAL: forbidden write probe unexpectedly succeeded for ${target}. Attempting cleanup.`)
  const sha = data?.content?.sha
  if (sha) await deleteFile(owner, repoName, path, 'chore: clean forbidden FOSSBot spike write probe', token, sha)
}

async function maybeDeleteRepo(owner, repoName, token, enabled) {
  if (!enabled) {
    logInfo(`Leaving spike repo in place: https://github.com/${owner}/${repoName}`)
    return
  }
  const { response } = await api(token, 'DELETE', `/repos/${owner}/${repoName}`, undefined, { allowedStatuses: [403, 404] })
  if (response.status === 204) logOk('Deleted spike repo')
  else logWarn(`Repo deletion returned ${response.status}. Delete manually if needed: https://github.com/${owner}/${repoName}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const appId = requireEnv('GITHUB_APP_ID')
  const clientId = requireEnv('GITHUB_APP_CLIENT_ID')
  const clientSecret = requireEnv('GITHUB_APP_CLIENT_SECRET')
  const privateKey = await readPrivateKey()
  const appJwt = makeAppJwt(appId, privateKey)

  logStep('Verify GitHub App identity')
  const { data: app } = await api(appJwt, 'GET', '/app')
  const appSlug = app.slug || process.env.GITHUB_APP_SLUG || ''
  logOk(`Authenticated as GitHub App: ${app.name || app.slug || app.id}`)
  if (app.permissions) {
    logInfo(`App repository permissions: ${JSON.stringify(app.permissions)}`)
    if (app.permissions.administration !== 'write') {
      logWarn('Repo creation with a GitHub App user token requires Repository permissions → Administration: Read and write.')
    }
  }

  logStep('Authorize GitHub App user token')
  const userToken = await getUserTokenViaBrowser({
    clientId,
    clientSecret,
    callbackPort: options.callbackPort,
    openBrowser: options.openBrowser,
  })
  const { data: user } = await api(userToken, 'GET', '/user')
  logOk(`Authenticated GitHub user: @${user.login}`)

  const owner = options.owner || user.login
  const repoName = options.repo || defaultRepoName()
  assertFossbotRepoName(repoName)

  logStep('Check GitHub App installation before repo creation')
  let preInstallations = await listUserInstallations(userToken, appId, owner)
  if (!preInstallations.length) {
    const installUrl = appSlug
      ? `${GITHUB_WEB}/apps/${appSlug}/installations/new`
      : `${GITHUB_WEB}/settings/apps`
    logWarn('No GitHub App installation found on the target account.')
    logWarn('GitHub App user tokens appear to need an installation before repo creation receives repository permissions.')
    logWarn('Install the app with selected repositories. If GitHub requires selecting something, choose any existing throwaway repo for this account.')
    console.log(`Install URL: ${installUrl}`)
    await openUrl(installUrl)
    await prompt('Press Enter after installing the GitHub App on the target account...')
    preInstallations = await listUserInstallations(userToken, appId, owner)
  }
  if (!preInstallations.length) {
    throw new Error(`No GitHub App installation found for ${owner}; cannot test repo creation with app repository permissions.`)
  }
  const preInstallation = preInstallations[0]
  logOk(`Found installation ${preInstallation.id} on ${preInstallation.account?.login} with repository_selection=${preInstallation.repository_selection}`)
  if (preInstallation.repository_selection === 'all' && !options.allowAllInstallation) {
    throw new Error('Installation has repository_selection=all. Reinstall the app with selected repositories, or rerun with --allow-all-installation to inspect behavior.')
  }

  logStep('Create public fossbot-* repo with user token')
  logInfo(`Target repo: ${owner}/${repoName}`)
  let repo
  try {
    repo = await createRepo(userToken, owner, user.login, repoName)
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 403) {
      logWarn('Repo creation was rejected. Most likely causes:')
      logWarn('1. GitHub App is missing Repository permissions → Administration: Read and write.')
      logWarn('2. The target account has not installed/accepted the app with those permissions.')
      logWarn('3. The installation selected-repository grant still does not allow repo creation.')
      logWarn('4. The env vars point at a different GitHub App than the one you configured.')
    }
    throw error
  }
  logOk(`Created repo: ${repo.html_url}`)

  logStep('Ensure selected GitHub App installation can access the repo')
  const installation = await ensureSelectedInstallation({
    userToken,
    appId,
    appSlug,
    owner,
    repo,
    allowAllInstallation: options.allowAllInstallation,
  })

  logStep('Create repository-scoped installation token')
  const installationToken = await createInstallationToken(appJwt, installation.id, repo.id)
  logOk(`Created installation token scoped to ${repo.full_name}`)

  logStep('Write stage files and binary asset')
  const initialStageResult = await writeStageFiles({ owner, repoName, userLogin: user.login, token: installationToken })
  logOk('Wrote stage.json, fossbot.json, LICENSE, and assets/test.glb')

  const stageFile = await getFile(owner, repoName, 'stage.json', installationToken)
  logOk(`Read back stage.json with sha ${stageFile.sha}`)

  logStep('Test SHA conflict handling')
  const finalCommitSha = await testShaConflict({
    owner,
    repoName,
    token: installationToken,
    initialSha: initialStageResult.content.sha,
  })
  logOk('Stale stage.json update returned 409 and final update succeeded')

  logStep('Set repository topics')
  try {
    const topics = await setTopics(owner, repoName, installationToken)
    logOk(`Topics set: ${(topics.names || []).join(', ')}`)
  } catch (error) {
    logWarn('Setting topics failed. This identifies a required permission or API adjustment.')
    printApiError(error)
  }

  logStep('Create validation check run')
  try {
    const checkRun = await createCheckRun(owner, repoName, finalCommitSha, installationToken)
    logOk(`Created check run: ${checkRun.html_url || checkRun.id}`)
  } catch (error) {
    logWarn('Creating check run failed. This likely means Checks: write is missing.')
    printApiError(error)
  }

  logStep('Optional access-denial probes')
  await probeForbiddenRepo(installationToken)
  await probeForbiddenWrite(installationToken)

  logStep('Result')
  console.log(JSON.stringify({
    app: { id: app.id, slug: appSlug, name: app.name },
    user: { login: user.login, id: user.id },
    installation: {
      id: installation.id,
      account: installation.account?.login,
      repositorySelection: installation.repository_selection,
    },
    repo: {
      id: repo.id,
      fullName: repo.full_name,
      url: repo.html_url,
    },
    finalCommitSha,
  }, null, 2))

  await maybeDeleteRepo(owner, repoName, userToken, options.deleteRepo)
}

main().catch((error) => {
  printApiError(error)
  process.exit(1)
})
