import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import type { EditorStage, EditorStageObject, StageBuilderMode, StageSemanticKind, Vec3 } from 'src/components/stage-builder/types';
import { downloadStageJson, makeLocalStageId, stageRecordFromImportedJson } from 'src/components/stage-builder/localStages';
import { StageBuilderScene, type StageBuilderTransformMode } from 'src/components/stage-builder/StageBuilderScene';
import { configToEditorStage, createDemoEditorStage, DEFAULT_STAGE_FLOOR, DEFAULT_STAGE_METADATA, editorStageToRecord } from 'src/components/stage-builder/serialize';
import {
  defaultStageBuilderPreferences,
  readStageBuilderPreferences,
  type StageBuilderPreferences,
  writeStageBuilderPreferences,
} from 'src/components/stage-builder/stageBuilderPreferences';
import { createCatalogObject, displayObjectType } from 'src/components/stage-builder/stageBuilderCatalog';
import { getSnapSettings, snapLabel } from 'src/components/stage-builder/stageBuilderSnapping';
import { blockingValidationResults, validateStageBuilderStage } from 'src/components/stage-builder/stageBuilderValidation';
import { cloneStage, selectedCentroid, translateObject } from 'src/components/stage-builder/stageBuilderGeometry';
import { canRedo, canUndo, createStageBuilderHistory, pushStageHistory, redoStageHistory, undoStageHistory, type StageBuilderHistory } from 'src/components/stage-builder/stageBuilderHistory';
import { builtInStageBuilderPrefabs, type StageBuilderPrefab } from 'src/components/stage-builder/stageBuilderPrefabs';
import { EditorTopBar } from 'src/components/stage-builder/EditorTopBar';
import { EditorLeftPanel } from 'src/components/stage-builder/EditorLeftPanel';
import type { HierarchyDropTarget } from 'src/components/stage-builder/StageSceneHierarchy';
import { EditorViewportToolRail } from 'src/components/stage-builder/EditorViewportToolRail';
import { EditorRightInspector, type InspectorTab } from 'src/components/stage-builder/EditorRightInspector';
import { clearStageBuilderDraft, draftToEditorStage, readStageBuilderDraft, stageFingerprint, writeStageBuilderDraft, type StageBuilderDraft } from 'src/components/stage-builder/stageBuilderDrafts';
import { writeStageBuilderRunHandoff } from 'src/components/stage-builder/stageBuilderRunHandoff';
import { editorColors } from 'src/components/stage-builder/stageBuilderEditorTheme';

function userScope(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) return 'anonymous';
  if (typeof user === 'string') return user;
  return user.username || String(user.id || 'anonymous');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function emptyEditorStage(): EditorStage {
  const now = new Date().toISOString();
  return {
    id: '',
    title: 'Untitled Stage',
    description: '',
    createdAt: now,
    updatedAt: now,
    floor: clone(DEFAULT_STAGE_FLOOR),
    metadata: clone(DEFAULT_STAGE_METADATA),
    objects: [],
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element?.tagName.match(/INPUT|TEXTAREA|SELECT/) || !!element?.isContentEditable;
}

const leaveMessage = 'You have unsaved changes. A local recovery draft will be kept, but you should export JSON when you are ready to save.';

const stageBuilderPanelSizing = {
  minWidth: 240,
  maxWidth: 420,
  leftDefaultWidth: 280,
  rightDefaultWidth: 324,
  handleWidth: 10,
} as const;

type PanelResizeSide = 'left' | 'right';

type PanelResizeState = {
  side: PanelResizeSide;
  startX: number;
  startWidth: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function StatusPill({ label, value, tone = editorColors.text }: { label: string; value: string; tone?: string }) {
  return (
    <Box sx={{ height: 20, minWidth: 0, px: 0.75, display: 'inline-flex', alignItems: 'center', gap: 0.5, borderRadius: 0.75, bgcolor: 'rgba(148, 163, 184, 0.07)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
      <Typography variant="caption" sx={{ color: editorColors.textSubtle, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography variant="caption" noWrap sx={{ color: tone, fontWeight: 700, lineHeight: 1, minWidth: 0 }}>{value}</Typography>
    </Box>
  );
}

function PanelResizeHandle({ side, onPointerDown }: { side: PanelResizeSide; onPointerDown: React.PointerEventHandler<HTMLDivElement> }) {
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize left panel' : 'Resize right panel'}
      onPointerDown={onPointerDown}
      sx={{
        width: stageBuilderPanelSizing.handleWidth,
        flex: `0 0 ${stageBuilderPanelSizing.handleWidth}px`,
        height: '100%',
        mx: `-${stageBuilderPanelSizing.handleWidth / 2}px`,
        cursor: 'col-resize',
        touchAction: 'none',
        position: 'relative',
        zIndex: 2,
        display: { xs: 'none', lg: 'block' },
        bgcolor: 'transparent',
        '&:before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: '1px',
          transform: 'translateX(-50%)',
          bgcolor: editorColors.border,
          opacity: 0.9,
        },
        '&:hover': { bgcolor: 'rgba(74, 163, 255, 0.08)' },
      }}
    />
  );
}

const StageBuilderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scope = useMemo(() => userScope(user), [user]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<StageBuilderHistory>(createStageBuilderHistory());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [stage, setStage] = useState<EditorStage>(() => emptyEditorStage());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<StageBuilderMode>('edit');
  const [transformMode, setTransformMode] = useState<StageBuilderTransformMode>('translate');
  const [focusRequestNonce, setFocusRequestNonce] = useState(0);
  const [prefs, setPrefs] = useState<StageBuilderPreferences>(() => readStageBuilderPreferences(scope));
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(stageBuilderPanelSizing.leftDefaultWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(stageBuilderPanelSizing.rightDefaultWidth);
  const [panelResize, setPanelResize] = useState<PanelResizeState | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('stage');
  const [message, setMessage] = useState<string>('');
  const [lastExportFingerprint, setLastExportFingerprint] = useState(() => stageFingerprint(emptyEditorStage()));
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StageBuilderDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const prefabs = useMemo(() => builtInStageBuilderPrefabs(), []);
  const snapSettings = useMemo(() => getSnapSettings(prefs.snapPreset, prefs.rotationSnapPreset), [prefs.snapPreset, prefs.rotationSnapPreset]);
  const validationResults = useMemo(() => validateStageBuilderStage(stage), [stage]);
  const selectedObject = stage.objects.find((object) => object.id === selectedId) || null;
  const selectedGroup = selectedGroupId ? stage.metadata.groups.find((group) => group.id === selectedGroupId) || null : null;
  const selectedGroupObjectIds = selectedGroup ? selectedGroup.objectIds.filter((id) => stage.objects.some((object) => object.id === id)) : [];
  const selectedCount = selectedGroup ? selectedGroupObjectIds.length : selectedIds.length || (selectedId ? 1 : 0);
  const dirty = useMemo(() => stageFingerprint(stage) !== lastExportFingerprint, [stage, lastExportFingerprint]);
  const gridVisible = stage.metadata.gridVisible ?? true;
  const gridSize = stage.metadata.gridSize ?? 0.5;
  const studio = prefs.styleVariant === 'studio';
  const selectedStatus = selectedGroup ? selectedGroup.name : selectedObject ? selectedObject.name : selectedCount ? `${selectedCount} objects` : inspectorTab === 'stage' ? 'Stage' : 'None';
  const selectedTone = selectedGroup ? editorColors.accentText : selectedObject ? editorColors.warning : inspectorTab === 'stage' ? editorColors.accentText : editorColors.text;

  useEffect(() => {
    setPrefs(readStageBuilderPreferences(scope));
    const draft = readStageBuilderDraft(scope);
    if (draft) {
      setPendingDraft(draft);
      setDraftReady(false);
    } else {
      setPendingDraft(null);
      setDraftReady(true);
    }
  }, [scope]);

  useEffect(() => { writeStageBuilderPreferences(prefs, scope); }, [prefs, scope]);

  useEffect(() => {
    if (selectedId) setInspectorTab('object');
    else setInspectorTab((current) => current === 'object' ? 'stage' : current);
  }, [selectedId]);

  useEffect(() => {
    if (!draftReady) return;
    if (dirty) writeStageBuilderDraft(stage, scope);
    else clearStageBuilderDraft(scope);
  }, [stage, dirty, draftReady, scope]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = leaveMessage;
      return leaveMessage;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!panelResize) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - panelResize.startX;
      const nextWidth = panelResize.side === 'left'
        ? panelResize.startWidth + delta
        : panelResize.startWidth - delta;
      const clampedWidth = clamp(nextWidth, stageBuilderPanelSizing.minWidth, stageBuilderPanelSizing.maxWidth);
      if (panelResize.side === 'left') setLeftPanelWidth(clampedWidth);
      else setRightPanelWidth(clampedWidth);
    };

    const stopResizing = () => setPanelResize(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [panelResize]);

  const beginPanelResize = (side: PanelResizeSide) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setPanelResize({
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth,
    });
  };

  const bumpHistory = () => setHistoryVersion((value) => value + 1);
  const setPref = (patch: Partial<StageBuilderPreferences>) => setPrefs((current) => ({ ...current, ...patch }));

  const commitStage = (updater: (current: EditorStage) => EditorStage, options: { selectIds?: string[]; selectGroupId?: string | null; message?: string } = {}) => {
    setStage((current) => {
      historyRef.current = pushStageHistory(historyRef.current, current);
      const next = updater(cloneStage(current));
      return { ...next, updatedAt: new Date().toISOString() };
    });
    bumpHistory();
    if (options.selectIds) {
      setSelectedGroupId(null);
      setSelectedIds(options.selectIds);
      setSelectedId(options.selectIds[options.selectIds.length - 1] || null);
    }
    if ('selectGroupId' in options) {
      setSelectedGroupId(options.selectGroupId || null);
      setSelectedIds([]);
      setSelectedId(null);
      setInspectorTab('stage');
    }
    if (options.message) setMessage(options.message);
  };

  const replaceStage = (next: EditorStage, options: { undoable?: boolean; clean?: boolean; message?: string } = {}) => {
    const undoable = options.undoable ?? true;
    if (undoable) {
      setStage((current) => {
        historyRef.current = pushStageHistory(historyRef.current, current);
        return cloneStage(next);
      });
      bumpHistory();
    } else {
      setStage(cloneStage(next));
      historyRef.current = createStageBuilderHistory();
      bumpHistory();
    }
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setBuilderMode('edit');
    if (options.clean) {
      setLastExportFingerprint(stageFingerprint(next));
      setExportedAt(null);
      clearStageBuilderDraft(scope);
    }
    if (options.message) setMessage(options.message);
  };

  const confirmIfDirty = (messageText = leaveMessage): boolean => !dirty || window.confirm(messageText);

  const handleSelectionChange = (ids: string[]) => {
    const existing = ids.filter((id) => stage.objects.some((object) => object.id === id));
    setSelectedGroupId(null);
    setSelectedIds(existing);
    setSelectedId(existing[existing.length - 1] || null);
    setInspectorTab(existing.length ? 'object' : 'stage');
  };

  const handleSelect = (id: string | null) => {
    setSelectedGroupId(null);
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
    setInspectorTab(id ? 'object' : 'stage');
    if (id) setBuilderMode('edit');
  };

  const handleSelectGroup = (id: string | null) => {
    const group = id ? stage.metadata.groups.find((item) => item.id === id) : null;
    setSelectedGroupId(group ? group.id : null);
    setSelectedId(null);
    setSelectedIds([]);
    setInspectorTab('stage');
    if (group) setBuilderMode('edit');
  };

  const handleOpenStageSettings = () => {
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('stage');
    setRightPanelVisible(true);
  };

  const updateObject = (nextObject: EditorStageObject) => commitStage((current) => ({ ...current, objects: current.objects.map((object) => object.id === nextObject.id ? nextObject : object) }));

  const updateObjects = (nextObjects: EditorStageObject[]) => {
    if (!nextObjects.length) return;
    const nextById = new Map(nextObjects.map((object) => [object.id, object]));
    commitStage((current) => ({ ...current, objects: current.objects.map((object) => nextById.get(object.id) || object) }));
  };

  const patchObjects = (ids: string[], patch: Partial<EditorStageObject>) => {
    if (!ids.length) return;
    commitStage((current) => ({ ...current, objects: current.objects.map((object) => ids.includes(object.id) ? { ...object, ...patch } as EditorStageObject : object) }));
  };

  const deleteObjects = (ids: string[]) => {
    if (!ids.length) return;
    commitStage((current) => {
      const now = new Date().toISOString();
      const groups = current.metadata.groups
        .map((group) => ({ ...group, objectIds: group.objectIds.filter((objectId) => !ids.includes(objectId)), updatedAt: now }))
        .filter((group) => group.objectIds.length > 0);
      const objectGroupIds = new Map<string, string>();
      groups.forEach((group) => group.objectIds.forEach((objectId) => objectGroupIds.set(objectId, group.id)));
      return {
        ...current,
        objects: current.objects
          .filter((object) => !ids.includes(object.id))
          .map((object) => {
            const nextGroupId = objectGroupIds.get(object.id);
            if (nextGroupId) return object.groupId === nextGroupId ? object : { ...object, groupId: nextGroupId } as EditorStageObject;
            return object.groupId ? { ...object, groupId: undefined, prefabSourceId: undefined } as EditorStageObject : object;
          }),
        metadata: { ...current.metadata, groups },
      };
    }, { selectIds: selectedIds.filter((id) => !ids.includes(id)) });
  };

  const deleteSelected = () => deleteObjects(selectedGroup ? selectedGroupObjectIds : selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []));

  const duplicateObjects = (ids: string[]) => {
    const source = stage.objects.filter((object) => ids.includes(object.id));
    if (!source.length) return;
    const copies = source.map((object) => {
      const copy = translateObject(cloneStage(object), [0.5, 0, 0.5]) as EditorStageObject;
      return { ...copy, id: makeLocalStageId(), name: `${object.name} copy`, groupId: undefined } as EditorStageObject;
    });
    commitStage((current) => ({ ...current, objects: [...current.objects, ...copies] }), { selectIds: copies.map((copy) => copy.id), message: 'Duplicated selection.' });
  };

  const duplicateSelected = () => duplicateObjects(selectedGroup ? selectedGroupObjectIds : selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []));

  const addObject = (kind: StageSemanticKind) => {
    if (kind === 'floor') {
      setInspectorTab('stage');
      setMessage('Floor settings are edited in the Stage inspector.');
      return;
    }
    const id = makeLocalStageId();
    const object = createCatalogObject(kind, id, [0, 0, 0]);
    if (!object) return;
    commitStage((current) => ({
      ...current,
      objects: object.kind === 'fossbot'
        ? [...current.objects.filter((item) => item.kind !== 'fossbot'), object]
        : [...current.objects, object],
    }), { selectIds: [id], message: `${displayObjectType(object)} added at floor center.` });
  };

  const addPrefab = (prefab: StageBuilderPrefab) => {
    const center = selectedCentroid(prefab.objects);
    const delta: Vec3 = [-center[0], -center[1], -center[2]];
    const groupId = makeLocalStageId();
    const copies = prefab.objects.map((object) => {
      const copy = translateObject(cloneStage(object), delta) as EditorStageObject;
      return { ...copy, id: makeLocalStageId(), groupId, prefabSourceId: prefab.id } as EditorStageObject;
    });
    const now = new Date().toISOString();
    commitStage((current) => ({
      ...current,
      objects: [...current.objects, ...copies],
      metadata: { ...current.metadata, groups: [...current.metadata.groups, { id: groupId, name: prefab.title, objectIds: copies.map((object) => object.id), createdAt: now, updatedAt: now }] },
    }), { selectIds: copies.map((object) => object.id), message: `${prefab.title} prefab added at floor center.` });
  };

  const handleStageChange = (next: EditorStage) => commitStage(() => next);

  const handleNew = () => {
    if (!confirmIfDirty('Create a new blank stage? Unsaved changes will remain only as a recovery draft.')) return;
    const next = emptyEditorStage();
    replaceStage(next, { undoable: false, clean: true, message: 'New blank stage created.' });
  };

  const handleDemo = () => {
    if (!confirmIfDirty('Load the demo stage? Unsaved changes will remain only as a recovery draft.')) return;
    replaceStage(createDemoEditorStage(), { undoable: true, clean: false, message: 'Demo stage loaded.' });
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    if (!confirmIfDirty('Import this JSON file and replace the current stage? Unsaved changes will remain only as a recovery draft.')) {
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }
    try {
      const record = stageRecordFromImportedJson(JSON.parse(await file.text()));
      const imported = configToEditorStage(record);
      replaceStage(imported, { undoable: true, clean: true, message: 'Imported stage JSON.' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    downloadStageJson(editorStageToRecord(stage));
    setLastExportFingerprint(stageFingerprint(stage));
    setExportedAt(new Date().toISOString());
    clearStageBuilderDraft(scope);
    setMessage('Exported JSON. This is the save action for this implementation stage.');
  };

  const handleRunTest = () => {
    if (dirty && !window.confirm('Run the current unsaved stage? A recovery draft will be kept until you export JSON.')) return;
    if (dirty) writeStageBuilderDraft(stage, scope);
    const blocking = blockingValidationResults(validationResults);
    if (blocking.length) {
      setInspectorTab('validation');
      setMessage(`Fix ${blocking.length} validation error${blocking.length === 1 ? '' : 's'} before running the test simulation.`);
      return;
    }
    const handoffId = writeStageBuilderRunHandoff(editorStageToRecord(stage));
    const url = `/stage-builder/test?handoff=${encodeURIComponent(handoffId)}`;
    const opened = window.open(url, '_blank');
    if (!opened) {
      setMessage('Popup blocked. Opening the simulator in this tab instead.');
      navigate(url);
    }
  };

  const handleBack = () => {
    if (!confirmIfDirty()) return;
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  const handleOpenSettings = () => {
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('settings');
    setRightPanelVisible(true);
  };

  const undo = () => {
    const { history, stage: previous } = undoStageHistory(historyRef.current, stage);
    historyRef.current = history;
    if (previous) {
      setStage(previous);
      setSelectedId(null);
      setSelectedIds([]);
      setSelectedGroupId(null);
      bumpHistory();
    }
  };

  const redo = () => {
    const { history, stage: next } = redoStageHistory(historyRef.current, stage);
    historyRef.current = history;
    if (next) {
      setStage(next);
      setSelectedId(null);
      setSelectedIds([]);
      setSelectedGroupId(null);
      bumpHistory();
    }
  };

  const groupSelected = () => {
    const ids = selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []);
    if (ids.length < 2) return;
    const now = new Date().toISOString();
    const groupId = makeLocalStageId();
    commitStage((current) => {
      const idSet = new Set(ids);
      const groups = current.metadata.groups
        .map((group) => ({ ...group, objectIds: group.objectIds.filter((objectId) => !idSet.has(objectId)), updatedAt: group.objectIds.some((objectId) => idSet.has(objectId)) ? now : group.updatedAt }))
        .filter((group) => group.objectIds.length > 0);
      return {
        ...current,
        objects: current.objects.map((object) => idSet.has(object.id) ? { ...object, groupId } as EditorStageObject : object),
        metadata: { ...current.metadata, groups: [...groups, { id: groupId, name: `Group ${groups.length + 1}`, objectIds: ids, createdAt: now, updatedAt: now }] },
      };
    }, { selectGroupId: groupId, message: 'Grouped selected objects.' });
  };

  const handleHierarchyDrop = (draggedId: string, target: HierarchyDropTarget) => {
    if (target.type === 'object' && draggedId === target.id) return;
    const dragged = stage.objects.find((object) => object.id === draggedId);
    if (!dragged) return;

    commitStage((current) => {
      const moving = current.objects.find((object) => object.id === draggedId);
      const targetObject = target.type === 'object' ? current.objects.find((object) => object.id === target.id) : null;
      if (!moving || (target.type === 'object' && !targetObject)) return current;

      const now = new Date().toISOString();
      const existingObjectIds = new Set(current.objects.map((object) => object.id));
      let groups = current.metadata.groups
        .map((group) => ({ ...group, objectIds: group.objectIds.filter((objectId) => existingObjectIds.has(objectId)) }))
        .filter((group) => group.objectIds.length > 0);
      const groupForObject = (objectId: string) => groups.find((group) => group.objectIds.includes(objectId))?.id || null;
      const moveObject = (objects: EditorStageObject[], anchorId: string, position: 'before' | 'after') => {
        const objectToMove = objects.find((object) => object.id === draggedId);
        if (!objectToMove) return objects;
        const withoutMoving = objects.filter((object) => object.id !== draggedId);
        const anchorIndex = withoutMoving.findIndex((object) => object.id === anchorId);
        if (anchorIndex < 0) return objects;
        const insertAt = position === 'before' ? anchorIndex : anchorIndex + 1;
        return [...withoutMoving.slice(0, insertAt), objectToMove, ...withoutMoving.slice(insertAt)];
      };
      const groupAnchor = (groupId: string, position: 'before' | 'after', objects: EditorStageObject[]) => {
        const group = groups.find((item) => item.id === groupId);
        if (!group) return null;
        const members = new Set(group.objectIds);
        const orderedIds = objects.filter((object) => members.has(object.id)).map((object) => object.id);
        if (!orderedIds.length) return null;
        return position === 'before' ? orderedIds[0] : orderedIds[orderedIds.length - 1];
      };
      const insertIntoGroup = (groupId: string, anchorId?: string, position: 'before' | 'after' = 'after') => {
        groups = groups.map((group) => {
          if (group.id !== groupId) return group;
          const withoutMoving = group.objectIds.filter((objectId) => objectId !== draggedId);
          const anchorIndex = anchorId ? withoutMoving.indexOf(anchorId) : -1;
          const insertAt = anchorIndex < 0 ? withoutMoving.length : position === 'before' ? anchorIndex : anchorIndex + 1;
          return {
            ...group,
            objectIds: [...withoutMoving.slice(0, insertAt), draggedId, ...withoutMoving.slice(insertAt)],
            updatedAt: now,
          };
        });
      };

      groups = groups.map((group) => group.objectIds.includes(draggedId)
        ? { ...group, objectIds: group.objectIds.filter((objectId) => objectId !== draggedId), updatedAt: now }
        : group);

      let objects = current.objects;
      if (target.type === 'object' && targetObject) {
        const targetGroupId = groupForObject(targetObject.id);
        if (target.position === 'inside') {
          const destinationGroupId = targetGroupId || makeLocalStageId();
          if (!targetGroupId) {
            groups = [...groups, { id: destinationGroupId, name: `${targetObject.name || 'Object'} group`, objectIds: [targetObject.id], createdAt: now, updatedAt: now }];
          }
          insertIntoGroup(destinationGroupId, targetObject.id, 'after');
          objects = moveObject(objects, targetObject.id, 'after');
        } else if (targetGroupId) {
          insertIntoGroup(targetGroupId, targetObject.id, target.position);
          objects = moveObject(objects, targetObject.id, target.position);
        } else {
          objects = moveObject(objects, targetObject.id, target.position);
        }
      } else if (target.type === 'group') {
        const targetGroup = groups.find((group) => group.id === target.id);
        if (!targetGroup) return current;
        if (target.position === 'inside') {
          insertIntoGroup(target.id);
          const anchorId = groupAnchor(target.id, 'after', objects);
          if (anchorId) objects = moveObject(objects, anchorId, 'after');
        } else {
          const anchorId = groupAnchor(target.id, target.position, objects);
          if (anchorId) objects = moveObject(objects, anchorId, target.position);
        }
      }

      groups = groups.filter((group) => group.objectIds.length > 0);
      const objectGroupIds = new Map<string, string>();
      groups.forEach((group) => group.objectIds.forEach((objectId) => objectGroupIds.set(objectId, group.id)));

      return {
        ...current,
        objects: objects.map((object) => {
          const nextGroupId = objectGroupIds.get(object.id);
          if (nextGroupId) {
            if (object.groupId === nextGroupId && object.id !== draggedId) return object;
            return { ...object, groupId: nextGroupId, prefabSourceId: object.id === draggedId ? undefined : object.prefabSourceId } as EditorStageObject;
          }
          if (object.groupId || object.id === draggedId) return { ...object, groupId: undefined, prefabSourceId: object.id === draggedId ? undefined : object.prefabSourceId } as EditorStageObject;
          return object;
        }),
        metadata: { ...current.metadata, groups },
      };
    }, { selectIds: [draggedId], message: `${dragged.name} moved in hierarchy.` });
  };

  const renameGroup = (groupId: string, name: string) => {
    commitStage((current) => ({ ...current, metadata: { ...current.metadata, groups: current.metadata.groups.map((group) => group.id === groupId ? { ...group, name, updatedAt: new Date().toISOString() } : group) } }));
  };

  const toggleValidationOverride = (id: string, enabled: boolean) => {
    commitStage((current) => {
      const validationOverrides = { ...current.metadata.validationOverrides };
      if (enabled) validationOverrides[id] = true;
      else delete validationOverrides[id];
      return { ...current, metadata: { ...current.metadata, validationOverrides } };
    });
  };

  const restoreDraft = () => {
    if (!pendingDraft) return;
    const restored = draftToEditorStage(pendingDraft);
    replaceStage(restored, { undoable: false, clean: false, message: 'Recovered browser draft.' });
    setLastExportFingerprint('');
    setPendingDraft(null);
    setDraftReady(true);
  };

  const discardDraft = () => {
    clearStageBuilderDraft(scope);
    setPendingDraft(null);
    setDraftReady(true);
    setMessage('Discarded browser recovery draft.');
  };

  useEffect(() => {
    if (!prefs.keyboardShortcutsEnabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && key === 'z') { event.preventDefault(); undo(); return; }
      if (ctrl && (key === 'y' || (event.shiftKey && key === 'z'))) { event.preventDefault(); redo(); return; }
      if (ctrl && key === 'd') { event.preventDefault(); duplicateSelected(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return; }
      if (key === 'w') { setBuilderMode('edit'); setTransformMode('translate'); }
      if (key === 'e') { setBuilderMode('edit'); setTransformMode('rotate'); }
      if (key === 'r') { setBuilderMode('edit'); setTransformMode('scale'); }
      if (key === 'f') setFocusRequestNonce((value) => value + 1);
      if (key === 'g') groupSelected();
      if (key === 'escape') handleSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefs.keyboardShortcutsEnabled, stage, selectedId, selectedIds, selectedGroupId, snapSettings, historyVersion]);

  return (
    <Box ref={rootRef} sx={{ '--fossbot-box-border-radius': '0px', borderRadius: 0, width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: studio ? editorColors.viewport : '#e5e7eb' }}>
      <EditorTopBar
        stageName={stage.title}
        dirty={dirty}
        exportedAt={exportedAt}
        validationResults={validationResults}
        selectedCount={selectedCount}
        canUndo={canUndo(historyRef.current)}
        canRedo={canRedo(historyRef.current)}
        leftPanelVisible={leftPanelVisible}
        rightPanelVisible={rightPanelVisible}
        prefabs={prefabs}
        onBack={handleBack}
        onNew={handleNew}
        onDemo={handleDemo}
        onImport={() => importInputRef.current?.click()}
        onExport={handleExport}
        onRunTest={handleRunTest}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onAddKind={addObject}
        onAddPrefab={addPrefab}
        onOpenValidation={() => setInspectorTab('validation')}
        onOpenSettings={handleOpenSettings}
        onOpenStageSettings={handleOpenStageSettings}
        onToggleLeftPanel={() => setLeftPanelVisible((value) => !value)}
        onToggleRightPanel={() => setRightPanelVisible((value) => !value)}
      />
      <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => handleImportFile(event.target.files?.[0])} />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {leftPanelVisible && (
          <Box sx={{ width: leftPanelWidth, flex: '0 0 auto', minHeight: 0, display: { xs: 'none', lg: 'block' }, overflow: 'hidden' }}>
            <EditorLeftPanel
              stage={stage}
              selectedId={selectedId}
              selectedIds={selectedIds}
              selectedGroupId={selectedGroupId}
              prefabs={prefabs}
              onAddKind={addObject}
              onAddPrefab={addPrefab}
              onSelectObject={handleSelect}
              onSelectGroup={handleSelectGroup}
              onSelectionChange={handleSelectionChange}
              onObjectChange={updateObject}
              onDuplicateObjects={duplicateObjects}
              onDeleteObjects={deleteObjects}
              onHierarchyDrop={handleHierarchyDrop}
              onGroupRename={renameGroup}
              onPatchObjects={patchObjects}
            />
          </Box>
        )}
        {leftPanelVisible && <PanelResizeHandle side="left" onPointerDown={beginPanelResize('left')} />}

        <Box sx={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, position: 'relative', bgcolor: editorColors.viewport }}>
          <StageBuilderScene
            objects={stage.objects}
            groups={stage.metadata.groups}
            selectedId={selectedId}
            selectedIds={selectedIds}
            selectedGroupId={selectedGroupId}
            transformMode={transformMode}
            builderMode={builderMode}
            stageDimensions={stage.floor.dimensions}
            floorColor={stage.floor.color}
            gridVisible={gridVisible}
            gridSize={gridSize}
            snapSettings={snapSettings}
            transformSpace={prefs.transformSpace}
            controlScheme="legacyGizmo"
            lockMode={prefs.lockMode}
            styleVariant={prefs.styleVariant}
            validationResults={validationResults}
            focusRequestNonce={focusRequestNonce}
            onSelect={handleSelect}
            onSelectionChange={handleSelectionChange}
            onObjectChange={updateObject}
            onObjectsChange={updateObjects}
            onLockedSelectionAttempt={() => setMessage('Selection is locked to the current object. Change Selection behavior in Settings to select through objects.')}
          />
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
            <EditorViewportToolRail
              mode={builderMode}
              transformMode={transformMode}
              snapPreset={prefs.snapPreset}
              selectedCount={selectedCount}
              canUndo={canUndo(historyRef.current)}
              canRedo={canRedo(historyRef.current)}
              onModeChange={setBuilderMode}
              onTransformModeChange={(mode) => { setBuilderMode('edit'); setTransformMode(mode); }}
              onSnapPresetChange={(snapPreset) => {
                setPref({ snapPreset });
                commitStage((current) => ({ ...current, metadata: { ...current.metadata, defaultSnapPreset: snapPreset === 'free' || snapPreset === 'grid' ? 'medium' : snapPreset } }));
              }}
              onFocusSelected={() => setFocusRequestNonce((value) => value + 1)}
              onUndo={undo}
              onRedo={redo}
              onDelete={deleteSelected}
            />
          </Box>
        </Box>

        {rightPanelVisible && <PanelResizeHandle side="right" onPointerDown={beginPanelResize('right')} />}
        {rightPanelVisible && (
          <Box sx={{ width: rightPanelWidth, flex: '0 0 auto', minHeight: 0, display: { xs: 'none', lg: 'block' }, overflow: 'hidden' }}>
            <EditorRightInspector
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              stage={stage}
              selectedObject={selectedObject}
              selectedCount={selectedCount}
              validationResults={validationResults}
              prefs={prefs}
              onStageChange={handleStageChange}
              onObjectChange={updateObject}
              onToggleValidationOverride={toggleValidationOverride}
              onPrefsChange={setPref}
              onResetPrefs={() => setPrefs(defaultStageBuilderPreferences)}
            />
          </Box>
        )}
      </Box>

      <Box sx={{ height: 28, px: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: editorColors.topbar, color: '#cbd5e1', borderTop: '1px solid rgba(148,163,184,0.16)' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexShrink: 0 }}>
          <StatusPill label="Mode" value={builderMode === 'edit' ? transformMode : builderMode} tone={editorColors.accentText} />
          <StatusPill label="Selected" value={selectedStatus} tone={selectedTone} />
          <StatusPill label="Snap" value={snapLabel(snapSettings)} tone={snapSettings.move ? editorColors.success : editorColors.textMuted} />
          <StatusPill label="Grid" value={gridVisible ? `${gridSize} m` : 'Hidden'} tone={editorColors.text} />
        </Stack>
        <Typography variant="caption" noWrap sx={{ ml: 'auto', minWidth: 0, color: editorColors.textMuted, textAlign: 'right' }}>
          Add from Library or Add menu, then use W/E/R and inspector fields.
        </Typography>
      </Box>

      <Dialog open={!!pendingDraft && !draftReady} maxWidth="sm" fullWidth>
        <DialogTitle>Recover unsaved Stage Builder draft?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity="warning">A local browser recovery draft was found. This is only unsaved-work recovery, not project storage.</Alert>
            <Typography variant="body2">Draft saved: {pendingDraft ? new Date(pendingDraft.savedAt).toLocaleString() : ''}</Typography>
            <Typography variant="body2">Stage: {pendingDraft?.stageRecord.title || 'Untitled Stage'}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={discardDraft}>Discard Draft</Button>
          <Button variant="contained" onClick={restoreDraft}>Restore Draft</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!message} autoHideDuration={3600} onClose={() => setMessage('')} message={message} />
    </Box>
  );
};

export default StageBuilderPage;
