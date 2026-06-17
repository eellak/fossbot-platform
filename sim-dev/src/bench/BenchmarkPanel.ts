import { stringify } from 'yaml'
import { STAGE_NAMES } from '../stages'
import { makeDraggable } from '../ui/dragUtils'
import { cloneBenchmarkPreset, loadBenchmarkPresets } from './configs'
import { formatBenchmarkMarkdown } from './runner'
import type { BenchmarkMode, BenchmarkPreset, BenchmarkResults } from './types'

export interface BenchmarkPanelHandlers {
  run: (mode: BenchmarkMode, preset: BenchmarkPreset, onStatus: (text: string) => void) => Promise<BenchmarkResults>
  runBoth: (preset: BenchmarkPreset, onStatus: (text: string) => void) => Promise<BenchmarkResults>
}

export interface BenchmarkPanelHandle {
  resetPosition: () => void
  dispose: () => void
}

interface StageDraft {
  stage: string
  idleMs: number
  moveMs: number
  cameraMode: BenchmarkPreset['config']['cameraMode']
  driveMode: NonNullable<BenchmarkPreset['config']['stageOverrides'][number]['driveMode']>
  movement: number
}

export function createBenchmarkPanel(
  container: HTMLElement,
  handlers: BenchmarkPanelHandlers,
): BenchmarkPanelHandle {
  const style = document.createElement('style')
  style.textContent = `
@keyframes benchmark-run-pulse {
  0%, 100% { opacity: 0.48; transform: scale(0.86); }
  50% { opacity: 1; transform: scale(1); }
}
`
  container.appendChild(style)

  const panel = document.createElement('div')
  panel.title = 'Benchmark'
  panel.style.position = 'absolute'
  panel.style.top = '8px'
  panel.style.left = '464px'
  panel.style.zIndex = '11'
  panel.style.display = 'grid'
  panel.style.gap = '6px'
  panel.style.padding = '8px'
  panel.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  panel.style.borderRadius = '6px'
  panel.style.background = 'rgba(0, 0, 0, 0.72)'
  panel.style.width = '180px'
  panel.style.cursor = 'grab'
  panel.style.userSelect = 'none'
  container.appendChild(panel)

  const runIndicator = document.createElement('span')
  runIndicator.title = 'Benchmark idle'
  runIndicator.style.width = '10px'
  runIndicator.style.height = '10px'
  runIndicator.style.borderRadius = '999px'
  runIndicator.style.background = 'rgba(148, 163, 184, 0.82)'
  runIndicator.style.border = '1px solid rgba(255, 255, 255, 0.24)'
  runIndicator.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.28)'
  runIndicator.style.pointerEvents = 'none'
  runIndicator.style.flex = '0 0 auto'

  const dragHandle = makeDraggable({ el: panel, storageKey: 'fossbot-benchmark-panel-pos' })

  const title = document.createElement('div')
  title.style.display = 'flex'
  title.style.alignItems = 'center'
  title.style.justifyContent = 'space-between'
  title.style.gap = '8px'
  title.style.color = '#ffffff'
  title.style.font = '700 12px sans-serif'
  title.style.letterSpacing = '0.02em'
  title.style.padding = '0 2px 2px'
  title.style.textAlign = 'left'
  panel.appendChild(title)

  const titleLabel = document.createElement('div')
  titleLabel.style.display = 'flex'
  titleLabel.style.alignItems = 'center'
  titleLabel.style.gap = '7px'
  title.appendChild(titleLabel)

  titleLabel.appendChild(runIndicator)

  const titleText = document.createElement('span')
  titleText.textContent = 'Benchmark'
  titleLabel.appendChild(titleText)

  let collapsed = true
  const collapseBtn = document.createElement('button')
  collapseBtn.type = 'button'
  collapseBtn.textContent = '▸'
  collapseBtn.title = 'Expand benchmark panel'
  collapseBtn.style.width = '20px'
  collapseBtn.style.height = '20px'
  collapseBtn.style.padding = '0'
  collapseBtn.style.border = '0'
  collapseBtn.style.borderRadius = '4px'
  collapseBtn.style.background = 'transparent'
  collapseBtn.style.color = '#ffffff'
  collapseBtn.style.font = '700 14px sans-serif'
  collapseBtn.style.lineHeight = '20px'
  collapseBtn.style.cursor = 'pointer'
  title.appendChild(collapseBtn)

  const status = document.createElement('div')
  status.textContent = 'Idle'
  status.style.color = '#b8c6d3'
  status.style.font = '500 11px sans-serif'
  status.style.minHeight = '16px'
  status.style.padding = '0 2px'
  panel.appendChild(status)

  const presets = loadBenchmarkPresets()
  let selectedPreset = presets[0] ? cloneBenchmarkPreset(presets[0]) : null
  let stageDrafts: StageDraft[] = []

  const presetSelect = document.createElement('select')
  presetSelect.style.padding = '6px 8px'
  presetSelect.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  presetSelect.style.borderRadius = '4px'
  presetSelect.style.background = 'rgba(255, 255, 255, 0.08)'
  presetSelect.style.color = '#ffffff'
  presetSelect.style.font = '600 12px sans-serif'
  presetSelect.style.cursor = 'pointer'
  presetSelect.style.gridColumn = '1 / -1'
  for (const preset of presets) {
    const option = document.createElement('option')
    option.value = preset.id
    option.textContent = preset.title
    presetSelect.appendChild(option)
  }
  presetSelect.value = selectedPreset?.id ?? ''
  panel.appendChild(presetSelect)

  const presetSummary = document.createElement('div')
  presetSummary.style.color = '#93a0ac'
  presetSummary.style.font = '500 10px/1.4 sans-serif'
  presetSummary.style.padding = '0 2px'
  presetSummary.style.minHeight = '42px'
  presetSummary.style.whiteSpace = 'pre-line'
  panel.appendChild(presetSummary)

  const stageHeader = document.createElement('div')
  stageHeader.textContent = 'Stage sequence and overrides'
  stageHeader.style.color = '#ffffff'
  stageHeader.style.font = '700 11px sans-serif'
  stageHeader.style.padding = '0 2px'
  panel.appendChild(stageHeader)

  const stageEditor = document.createElement('div')
  stageEditor.style.display = 'grid'
  stageEditor.style.gap = '10px'
  panel.appendChild(stageEditor)

  const makeButton = (label: string, onClick: () => void, parent: HTMLElement = panel) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.padding = '6px 8px'
    button.style.border = '1px solid rgba(255, 255, 255, 0.18)'
    button.style.borderRadius = '4px'
    button.style.background = 'rgba(255, 255, 255, 0.08)'
    button.style.color = '#ffffff'
    button.style.font = '600 12px sans-serif'
    button.style.cursor = 'pointer'
    button.addEventListener('click', onClick)
    parent.appendChild(button)
    return button
  }

  let running = false
  let overlay: HTMLDivElement | null = null

  const setStatus = (text: string) => {
    status.textContent = text
  }

  const renderPresetSummary = () => {
    if (!selectedPreset) {
      presetSummary.textContent = '(no benchmark configs found)'
      return
    }
    const c = selectedPreset.config
    presetSummary.textContent = [
      selectedPreset.description ?? '(no description)',
      `stages: ${c.stages.length}`,
      `default idle/move: ${c.idleMs}/${c.moveMs} ms`,
      `default warmup: ${c.warmupMs} ms`,
      `default camera: ${c.cameraMode}`,
      `stage overrides: ${c.stageOverrides.length}`,
    ].join('\n')
  }

  const syncPresetFromDrafts = () => {
    if (!selectedPreset) return
    selectedPreset.config.stages = stageDrafts.map((draft) => draft.stage)
    selectedPreset.config.stageOverrides = stageDrafts.map((draft, index) => ({
      index,
      idleMs: draft.idleMs,
      moveMs: draft.moveMs,
      cameraMode: draft.cameraMode,
      driveMode: draft.driveMode,
      movement: draft.movement,
    }))
    renderPresetSummary()
  }

  const buildStageDrafts = () => {
    if (!selectedPreset) return []
    return selectedPreset.config.stages.map((stage, index) => {
      const override = selectedPreset!.config.stageOverrides.find((o) => o.index === index)
      return {
        stage,
        idleMs: override?.idleMs ?? selectedPreset!.config.idleMs,
        moveMs: override?.moveMs ?? selectedPreset!.config.moveMs,
        cameraMode: override?.cameraMode ?? selectedPreset!.config.cameraMode,
        driveMode: override?.driveMode ?? 'fixed',
        movement: override?.movement ?? selectedPreset!.config.movement,
      }
    })
  }

  const insertStage = (index: number, stage: string) => {
    if (!selectedPreset) return
    stageDrafts.splice(index, 0, {
      stage,
      idleMs: selectedPreset.config.idleMs,
      moveMs: selectedPreset.config.moveMs,
      cameraMode: selectedPreset.config.cameraMode,
      driveMode: 'fixed',
      movement: selectedPreset.config.movement,
    })
    syncPresetFromDrafts()
    renderStageEditor()
  }

  let draggedStageIndex: number | null = null

  const moveStageDraft = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= stageDrafts.length || toIndex >= stageDrafts.length) return
    const [draft] = stageDrafts.splice(fromIndex, 1)
    stageDrafts.splice(toIndex, 0, draft)
    syncPresetFromDrafts()
    renderStageEditor()
  }

  const renderAddStageBar = () => {
    const bar = document.createElement('div')
    bar.style.display = 'grid'
    bar.style.gridTemplateColumns = '1fr 150px auto'
    bar.style.gap = '8px'
    bar.style.alignItems = 'center'
    bar.style.padding = '8px'
    bar.style.border = '1px solid rgba(255, 255, 255, 0.12)'
    bar.style.borderRadius = '6px'
    bar.style.background = 'rgba(255, 255, 255, 0.035)'

    const stageSelect = document.createElement('select')
    styleSelect(stageSelect)
    for (const stageName of STAGE_NAMES) {
      const option = document.createElement('option')
      option.value = stageName
      option.textContent = stageName
      stageSelect.appendChild(option)
    }
    bar.appendChild(stageSelect)

    const positionSelect = document.createElement('select')
    styleSelect(positionSelect)
    const endOption = document.createElement('option')
    endOption.value = String(stageDrafts.length)
    endOption.textContent = 'Add to end'
    positionSelect.appendChild(endOption)
    stageDrafts.forEach((draft, index) => {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = `Insert before ${index}`
      option.title = draft.stage
      positionSelect.appendChild(option)
    })
    bar.appendChild(positionSelect)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.textContent = '+ Stage'
    styleActionButton(addBtn)
    addBtn.addEventListener('click', () => insertStage(Number(positionSelect.value), stageSelect.value))
    bar.appendChild(addBtn)

    return bar
  }

  const renderStageEditor = () => {
    stageEditor.innerHTML = ''
    if (!selectedPreset) return

    stageEditor.appendChild(renderAddStageBar())

    const table = document.createElement('div')
    table.style.display = 'grid'
    table.style.gap = '4px'
    table.style.padding = '8px'
    table.style.border = '1px solid rgba(255, 255, 255, 0.10)'
    table.style.borderRadius = '6px'
    table.style.background = 'rgba(0, 0, 0, 0.18)'

    const header = document.createElement('div')
    header.style.display = 'grid'
    header.style.gridTemplateColumns = '42px 1fr 96px 94px 94px 120px 110px'
    header.style.gap = '8px'
    header.style.padding = '0 4px 4px'
    header.style.color = '#aab4bf'
    header.style.font = '700 10px sans-serif'
    for (const label of ['Slot', 'Stage', 'Camera', 'Idle ms', 'Move ms', 'Movement', 'Actions']) {
      const cell = document.createElement('div')
      cell.textContent = label
      header.appendChild(cell)
    }
    table.appendChild(header)

    stageDrafts.forEach((draft, index) => {
      const row = document.createElement('div')
      row.style.display = 'grid'
      row.style.gridTemplateColumns = '42px 1fr 96px 94px 94px 120px 110px'
      row.style.gap = '8px'
      row.style.alignItems = 'center'
      row.style.padding = '6px 4px'
      row.style.borderTop = index === 0 ? '0' : '1px solid rgba(255, 255, 255, 0.08)'
      row.addEventListener('dragover', (event) => {
        if (draggedStageIndex == null || draggedStageIndex === index) return
        event.preventDefault()
        row.style.background = 'rgba(120, 180, 255, 0.10)'
      })
      row.addEventListener('dragleave', () => {
        row.style.background = ''
      })
      row.addEventListener('drop', (event) => {
        row.style.background = ''
        if (draggedStageIndex == null) return
        event.preventDefault()
        moveStageDraft(draggedStageIndex, index)
        draggedStageIndex = null
      })

      const slot = document.createElement('div')
      slot.textContent = `☰ ${index}`
      slot.title = 'Drag to reorder. Overrides move with this sequence slot.'
      slot.draggable = true
      slot.style.color = '#d6dde5'
      slot.style.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace'
      slot.style.textAlign = 'center'
      slot.style.cursor = 'grab'
      slot.addEventListener('mousedown', (event) => event.stopPropagation())
      slot.addEventListener('dragstart', (event) => {
        draggedStageIndex = index
        slot.style.cursor = 'grabbing'
        row.style.opacity = '0.55'
        event.dataTransfer?.setData('text/plain', String(index))
        event.dataTransfer?.setDragImage(row, 24, 18)
      })
      slot.addEventListener('dragend', () => {
        draggedStageIndex = null
        slot.style.cursor = 'grab'
        row.style.opacity = '1'
      })
      row.appendChild(slot)

      const stageSelect = document.createElement('select')
      styleSelect(stageSelect)
      for (const stageName of STAGE_NAMES) {
        const option = document.createElement('option')
        option.value = stageName
        option.textContent = stageName
        stageSelect.appendChild(option)
      }
      stageSelect.value = draft.stage
      stageSelect.title = 'Stage in this sequence slot'
      stageSelect.addEventListener('change', () => {
        draft.stage = stageSelect.value
        syncPresetFromDrafts()
      })
      row.appendChild(stageSelect)

      const cameraInput = document.createElement('select')
      styleSelect(cameraInput)
      for (const mode of ['orbit', 'follow', 'top'] as const) {
        const option = document.createElement('option')
        option.value = mode
        option.textContent = mode
        cameraInput.appendChild(option)
      }
      cameraInput.value = draft.cameraMode
      cameraInput.addEventListener('change', () => {
        draft.cameraMode = cameraInput.value as typeof draft.cameraMode
        syncPresetFromDrafts()
      })
      row.appendChild(cameraInput)

      const idleInput = makeNumberInput(draft.idleMs, 0, 600000, 50, (value) => {
        draft.idleMs = value
        syncPresetFromDrafts()
      })
      idleInput.title = 'idleMs'
      row.appendChild(idleInput)

      const moveInput = makeNumberInput(draft.moveMs, 0, 600000, 50, (value) => {
        draft.moveMs = value
        syncPresetFromDrafts()
      })
      moveInput.title = 'moveMs'
      row.appendChild(moveInput)

      const movementInput = makeNumberInput(draft.movement, -1, 1, 0.01, (value) => {
        draft.driveMode = 'fixed'
        draft.movement = value
        syncPresetFromDrafts()
      })
      movementInput.title = draft.driveMode === 'lineFollower'
        ? 'LF mode enabled; edit to return to fixed movement'
        : 'movement (-1 reverse, 1 full forward)'
      movementInput.style.opacity = draft.driveMode === 'lineFollower' ? '0.55' : '1'
      row.appendChild(movementInput)

      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.gap = '4px'
      actions.style.justifyContent = 'flex-end'

      const lfBtn = document.createElement('button')
      lfBtn.type = 'button'
      lfBtn.textContent = 'LF'
      lfBtn.title = 'Use line follower mode for the moving sample'
      styleActionButton(lfBtn)
      lfBtn.style.padding = '4px 7px'
      lfBtn.style.background = draft.driveMode === 'lineFollower'
        ? 'rgba(120, 180, 255, 0.24)'
        : 'rgba(255, 255, 255, 0.08)'
      lfBtn.addEventListener('click', () => {
        draft.driveMode = draft.driveMode === 'lineFollower' ? 'fixed' : 'lineFollower'
        renderStageEditor()
        syncPresetFromDrafts()
      })
      actions.appendChild(lfBtn)

      const resetBtn = document.createElement('button')
      resetBtn.type = 'button'
      resetBtn.textContent = '↺'
      resetBtn.title = 'Reset this stage to the preset defaults'
      styleActionButton(resetBtn)
      resetBtn.style.padding = '4px 7px'
      resetBtn.addEventListener('click', () => {
        draft.idleMs = selectedPreset!.config.idleMs
        draft.moveMs = selectedPreset!.config.moveMs
        draft.cameraMode = selectedPreset!.config.cameraMode
        draft.driveMode = 'fixed'
        draft.movement = selectedPreset!.config.movement
        renderStageEditor()
        syncPresetFromDrafts()
      })
      actions.appendChild(resetBtn)

      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.textContent = '×'
      removeBtn.title = 'Remove this stage from the sequence'
      styleActionButton(removeBtn)
      removeBtn.style.padding = '4px 8px'
      removeBtn.addEventListener('click', () => {
        stageDrafts.splice(index, 1)
        syncPresetFromDrafts()
        renderStageEditor()
      })
      actions.appendChild(removeBtn)

      row.appendChild(actions)
      table.appendChild(row)
    })

    stageEditor.appendChild(table)
  }

  const refreshSelectedPreset = () => {
    if (!selectedPreset) {
      stageDrafts = []
      renderPresetSummary()
      renderStageEditor()
      return
    }
    stageDrafts = buildStageDrafts()
    renderPresetSummary()
    renderStageEditor()
  }

  presetSelect.addEventListener('change', () => {
    const next = presets.find((p) => p.id === presetSelect.value)
    if (!next) return
    selectedPreset = cloneBenchmarkPreset(next)
    refreshSelectedPreset()
  })
  refreshSelectedPreset()

  const setRunning = (value: boolean) => {
    running = value
    runIndicator.title = value ? 'Benchmark running' : 'Benchmark idle'
    runIndicator.style.background = value ? 'rgba(239, 68, 68, 0.92)' : 'rgba(148, 163, 184, 0.82)'
    runIndicator.style.animation = value ? 'benchmark-run-pulse 1.8s ease-in-out infinite' : 'none'
    runIndicator.style.boxShadow = value
      ? '0 0 0 2px rgba(0, 0, 0, 0.28), 0 0 14px rgba(239, 68, 68, 0.52)'
      : '0 0 0 2px rgba(0, 0, 0, 0.28)'
    for (const btn of [btnUser, btnDebug, btnBoth, btnCopyConfig]) {
      btn.disabled = value
      btn.style.opacity = value ? '0.5' : '1'
      btn.style.cursor = value ? 'not-allowed' : 'pointer'
    }
    presetSelect.disabled = value
    presetSelect.style.opacity = value ? '0.5' : '1'
    presetSelect.style.cursor = value ? 'not-allowed' : 'pointer'
    for (const input of stageEditor.querySelectorAll('input, select, button')) {
      const el = input as HTMLInputElement | HTMLSelectElement | HTMLButtonElement
      el.disabled = value
      el.style.opacity = value ? '0.5' : '1'
      el.style.cursor = value ? 'not-allowed' : 'pointer'
    }
  }

  const openResultsOverlay = (markdown: string, results: BenchmarkResults) => {
    if (overlay) overlay.remove()
    overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.zIndex = '100'
    overlay.style.display = 'grid'
    overlay.style.placeItems = 'center'
    overlay.style.background = 'rgba(0, 0, 0, 0.65)'
    overlay.style.pointerEvents = 'auto'

    const card = document.createElement('div')
    card.style.width = 'min(900px, 92vw)'
    card.style.maxHeight = '82vh'
    card.style.background = 'rgba(8, 12, 16, 0.98)'
    card.style.border = '1px solid rgba(255, 255, 255, 0.18)'
    card.style.borderRadius = '10px'
    card.style.padding = '16px'
    card.style.display = 'grid'
    card.style.gridTemplateRows = 'auto 1fr auto'
    card.style.gap = '10px'
    overlay.appendChild(card)

    const heading = document.createElement('div')
    heading.textContent = 'Benchmark results'
    heading.style.color = '#f3f7fb'
    heading.style.font = '700 14px sans-serif'
    card.appendChild(heading)

    const pre = document.createElement('pre')
    pre.textContent = markdown
    pre.style.margin = '0'
    pre.style.padding = '10px'
    pre.style.background = 'rgba(255, 255, 255, 0.05)'
    pre.style.border = '1px solid rgba(255, 255, 255, 0.08)'
    pre.style.borderRadius = '6px'
    pre.style.color = '#e2ecf5'
    pre.style.font = '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace'
    pre.style.overflow = 'auto'
    card.appendChild(pre)

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    actions.style.justifyContent = 'flex-end'
    card.appendChild(actions)

    const copyMarkdownBtn = document.createElement('button')
    copyMarkdownBtn.type = 'button'
    copyMarkdownBtn.textContent = 'Copy markdown'
    styleActionButton(copyMarkdownBtn)
    copyMarkdownBtn.addEventListener('click', () => copyToClipboard(markdown))
    actions.appendChild(copyMarkdownBtn)

    const copyJsonBtn = document.createElement('button')
    copyJsonBtn.type = 'button'
    copyJsonBtn.textContent = 'Copy JSON'
    styleActionButton(copyJsonBtn)
    const rawJson = JSON.stringify(results, null, 2)
    copyJsonBtn.addEventListener('click', () => copyToClipboard(rawJson))
    actions.appendChild(copyJsonBtn)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.textContent = 'Close'
    styleActionButton(closeBtn)
    closeBtn.addEventListener('click', () => {
      overlay?.remove()
      overlay = null
    })
    actions.appendChild(closeBtn)

    container.appendChild(overlay)
  }

  const runBenchmark = async (mode: BenchmarkMode | 'both') => {
    if (running) return
    if (!selectedPreset) {
      setStatus('No benchmark config loaded')
      return
    }
    setRunning(true)
    setStatus('Starting...')
    try {
      const results = mode === 'both'
        ? await handlers.runBoth(selectedPreset, setStatus)
        : await handlers.run(mode, selectedPreset, setStatus)
      const markdown = formatBenchmarkMarkdown(results)
      console.log('[bench] results', results)
      console.log('[bench] markdown\n' + markdown)
      openResultsOverlay(markdown, results)
      setStatus('Benchmark complete')
    } catch (err) {
      console.error('[bench] Benchmark failed:', err)
      setStatus('Benchmark failed — see console')
    } finally {
      setRunning(false)
    }
  }

  const copyConfig = async () => {
    if (!selectedPreset) {
      setStatus('No benchmark config loaded')
      return
    }
    syncPresetFromDrafts()
    const yaml = stringify({
      title: selectedPreset.title,
      ...(selectedPreset.description ? { description: selectedPreset.description } : {}),
      stages: selectedPreset.config.stages,
      warmupMs: selectedPreset.config.warmupMs,
      idleMs: selectedPreset.config.idleMs,
      moveMs: selectedPreset.config.moveMs,
      movement: selectedPreset.config.movement,
      cameraMode: selectedPreset.config.cameraMode,
      stageOverrides: selectedPreset.config.stageOverrides,
    })
    await copyToClipboard(yaml)
    setStatus('Copied benchmark config YAML')
  }

  const actionsGrid = document.createElement('div')
  actionsGrid.style.display = 'grid'
  actionsGrid.style.gridTemplateColumns = '1fr 1fr'
  actionsGrid.style.gap = '8px'
  panel.appendChild(actionsGrid)

  const runColumn = document.createElement('div')
  runColumn.style.display = 'grid'
  runColumn.style.gap = '6px'
  actionsGrid.appendChild(runColumn)

  const configColumn = document.createElement('div')
  configColumn.style.display = 'grid'
  configColumn.style.gap = '6px'
  configColumn.style.alignContent = 'start'
  actionsGrid.appendChild(configColumn)

  const btnUser = makeButton('Run (user)', () => runBenchmark('user'), runColumn)
  const btnDebug = makeButton('Run (debug overlay)', () => runBenchmark('debug'), runColumn)
  const btnBoth = makeButton('Run (both)', () => runBenchmark('both'), runColumn)
  const btnCopyConfig = makeButton('Copy config', () => { void copyConfig() }, configColumn)

  const note = document.createElement('div')
  note.textContent = 'Build any ordered sequence. Duplicates are allowed; overrides are by slot.'
  note.style.color = '#93a0ac'
  note.style.font = '500 10px sans-serif'
  note.style.padding = '0 2px'
  panel.appendChild(note)

  const applyCollapsed = () => {
    for (const child of Array.from(panel.children)) {
      if (child === title) continue
      ;(child as HTMLElement).style.display = collapsed ? 'none' : ''
    }
    actionsGrid.style.display = collapsed ? 'none' : 'grid'
    collapseBtn.textContent = collapsed ? '▸' : '▾'
    collapseBtn.title = collapsed ? 'Expand benchmark panel' : 'Collapse benchmark panel'
    panel.style.width = collapsed ? '180px' : '860px'
  }

  collapseBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    collapsed = !collapsed
    applyCollapsed()
  })
  applyCollapsed()

  return {
    resetPosition: () => dragHandle.resetPosition(),
    dispose() {
      overlay?.remove()
      overlay = null
      dragHandle.dispose()
      panel.remove()
      style.remove()
    },
  }
}

function styleActionButton(button: HTMLButtonElement): void {
  button.style.padding = '6px 10px'
  button.style.border = '1px solid rgba(255, 255, 255, 0.18)'
  button.style.borderRadius = '4px'
  button.style.background = 'rgba(255, 255, 255, 0.08)'
  button.style.color = '#ffffff'
  button.style.font = '600 12px sans-serif'
  button.style.cursor = 'pointer'
}

function styleSelect(el: HTMLSelectElement): void {
  el.style.padding = '4px 6px'
  el.style.border = '1px solid rgba(255, 255, 255, 0.16)'
  el.style.borderRadius = '4px'
  el.style.background = 'rgba(255, 255, 255, 0.08)'
  el.style.color = '#ffffff'
  el.style.font = '600 11px sans-serif'
  el.style.cursor = 'pointer'
}

function makeNumberInput(
  initial: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void,
): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'number'
  input.value = String(initial)
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.style.width = '100%'
  input.style.boxSizing = 'border-box'
  input.style.padding = '4px 6px'
  input.style.border = '1px solid rgba(255, 255, 255, 0.16)'
  input.style.borderRadius = '4px'
  input.style.background = 'rgba(255, 255, 255, 0.08)'
  input.style.color = '#ffffff'
  input.style.font = '600 11px sans-serif'
  input.style.cursor = 'text'
  input.addEventListener('change', () => {
    const next = Number(input.value)
    if (Number.isFinite(next)) onChange(next)
  })
  return input
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through to execCommand
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}
