import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import type { EditorStage, EditorStageObject, StageBuilderMode, StageLabelAttachment, StageSemanticKind, Vec3 } from 'src/components/stage-builder/types';
import { downloadStageJson, makeLocalStageId, stageRecordFromImportedJson } from 'src/components/stage-builder/localStages';
import { StageBuilderScene, type StageBuilderCameraView, type StageBuilderTransformMode } from 'src/components/stage-builder/StageBuilderScene';
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
import { EditorViewportCameraGizmo } from 'src/components/stage-builder/EditorViewportCameraGizmo';
import VideocamIcon from '@mui/icons-material/Videocam';
import { EditorPanelTab } from 'src/components/stage-builder/EditorPanelTab';
import { EditorRightInspector, type InspectorTab } from 'src/components/stage-builder/EditorRightInspector';
import { clearStageBuilderDraft, draftToEditorStage, readStageBuilderDraft, stageFingerprint, writeStageBuilderDraft, type StageBuilderDraft } from 'src/components/stage-builder/stageBuilderDrafts';
import { writeStageBuilderRunHandoff } from 'src/components/stage-builder/stageBuilderRunHandoff';
import { EditorThemeProvider, getEditorColors, getEditorPanelSx, getEditorTabsSx, getEditorTones, getEditorType, getInspectorPanelSx, useEditorTheme } from 'src/components/stage-builder/stageBuilderEditorTheme';
import { CUSTOM_OBJECT_DEFAULT_FIT_METERS, CUSTOM_OBJECT_DIMENSION_EPSILON, CUSTOM_OBJECT_MAX_FILE_SIZE_BYTES } from 'src/components/stage-builder/stageBuilderCustomObjects';
import { getGitHubBootstrapLinks, getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import { createStageOnProvider, listProviderStages, loadStageFromProvider, ProviderRequestError, updateStageOnProvider, type ProviderStageListItem, type ProviderStageRef } from 'src/stages/StagesApi';
import { SaveToProviderDialog, type SaveToProviderValues } from 'src/stages/SaveToProviderDialog';
import { OpenFromProviderDialog } from 'src/stages/OpenFromProviderDialog';
import { publishStageToMarketplace, MarketplaceRequestError, type PublishMarketplaceResponse } from 'src/stages/MarketplaceApi';
import { PublishToMarketplaceDialog, type PublishMarketplaceValues } from 'src/stages/PublishToMarketplaceDialog';

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
const customObjectObjLoader = new OBJLoader();
const customObjectStlLoader = new STLLoader();
const customObjectGltfLoader = new GLTFLoader();

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

function cameraPreviewName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === 'camera') return 'Stage camera';
  return trimmed;
}

function hasVisibleStageCamera(stage: EditorStage): boolean {
  return stage.objects.some((object) => object.kind === 'camera' && !object.hidden);
}

function dimensionsForObject(root: THREE.Object3D): Vec3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return [1, 1, 1];
  const size = box.getSize(new THREE.Vector3());
  return [Math.max(CUSTOM_OBJECT_DIMENSION_EPSILON, size.x), Math.max(CUSTOM_OBJECT_DIMENSION_EPSILON, size.y), Math.max(CUSTOM_OBJECT_DIMENSION_EPSILON, size.z)];
}

function scaleForMaxDimension(dimensions: Vec3, targetMeters: number): number {
  const maxDimension = Math.max(...dimensions);
  return maxDimension > 0 ? Number((targetMeters / maxDimension).toPrecision(6)) : 1;
}

function measureImportedModel(file: File, format: 'obj' | 'stl' | 'glb'): Promise<Vec3> {
  if (format === 'stl') {
    return file.arrayBuffer().then((buffer) => {
      const geometry = customObjectStlLoader.parse(buffer);
      const mesh = new THREE.Mesh(geometry);
      const dimensions = dimensionsForObject(mesh);
      geometry.dispose();
      return dimensions;
    });
  }
  if (format === 'glb') {
    return file.arrayBuffer().then((buffer) => new Promise<Vec3>((resolve, reject) => {
      customObjectGltfLoader.parse(buffer, '', (gltf) => {
        const dimensions = dimensionsForObject(gltf.scene);
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry?.dispose();
        });
        resolve(dimensions);
      }, reject);
    }));
  }
  return file.text().then((text) => {
    const root = customObjectObjLoader.parse(text);
    const dimensions = dimensionsForObject(root);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    return dimensions;
  });
}

function canAttachLabelTo(object: EditorStageObject | null | undefined): object is Extract<EditorStageObject, { kind: 'base' | 'cube' | 'cylinder' }> {
  return !!object && (object.kind === 'base' || object.kind === 'cube' || object.kind === 'cylinder');
}

function defaultLabelAttachment(parent: EditorStageObject): StageLabelAttachment {
  return {
    parentId: parent.id,
    face: parent.kind === 'base' ? 'top' : 'front',
    offset: [0, 0],
    rotation: 0,
    billboard: false,
  };
}

function normalizeCameraMetadata(stage: EditorStage): EditorStage {
  if (!stage.metadata.lockCamera || hasVisibleStageCamera(stage)) return stage;
  return { ...stage, metadata: { ...stage.metadata, lockCamera: false } };
}

function StatusItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { colors: editorColors } = useEditorTheme();
  return (
    <Box sx={{ minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography variant="caption" sx={{ color: editorColors.textSubtle, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography variant="caption" noWrap sx={{ color: tone ?? editorColors.text, fontWeight: 750, lineHeight: 1, minWidth: 0 }}>{value}</Typography>
    </Box>
  );
}

function Keycap({ children }: { children: React.ReactNode }) {
  const { colors: editorColors } = useEditorTheme();
  return (
    <Box
      component="kbd"
      sx={{
        minWidth: 16,
        height: 16,
        px: 0.375,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${editorColors.keycapBorder}`,
        borderBottomColor: `1px solid ${editorColors.keycapBorderStrong}`,
        borderRadius: 0.375,
        bgcolor: editorColors.keycapBg,
        color: editorColors.text,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.625rem',
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}

function ShortcutHint() {
  const shortcuts = [
    ['W', 'move'],
    ['E', 'rotate'],
    ['R', 'scale'],
    ['F', 'focus'],
    ['Del', 'remove'],
  ] as const;
  const { colors: editorColors } = useEditorTheme();

  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ ml: 'auto', minWidth: 0, color: editorColors.textMuted }}>
      {shortcuts.map(([key, label]) => (
        <Stack key={key} direction="row" spacing={0.375} alignItems="center">
          <Keycap>{key}</Keycap>
          <Typography variant="caption" noWrap sx={{ color: editorColors.textMuted }}>{label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function PanelResizeHandle({ side, onPointerDown, onDoubleClick }: { side: PanelResizeSide; onPointerDown: React.PointerEventHandler<HTMLDivElement>; onDoubleClick: React.MouseEventHandler<HTMLDivElement> }) {
  const { colors: editorColors } = useEditorTheme();
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize left panel. Double-click to reset width.' : 'Resize right panel. Double-click to reset width.'}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
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
          bgcolor: editorColors.accentText,
          opacity: 0,
        },
        '&:hover': { bgcolor: `${editorColors.accent}14` },
        '&:hover:before': { opacity: 0.75 },
      }}
    />
  );
}

const StageBuilderPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const scope = useMemo(() => userScope(user), [user]);
  const [prefs, setPrefs] = useState<StageBuilderPreferences>(() => readStageBuilderPreferences(scope));
  const editorColors = useMemo(() => getEditorColors(prefs.styleVariant), [prefs.styleVariant]);
  const editorTones = useMemo(() => getEditorTones(prefs.styleVariant), [prefs.styleVariant]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const customObjectInputRef = useRef<HTMLInputElement | null>(null);
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
  const [cameraViewRequest, setCameraViewRequest] = useState<{ view: StageBuilderCameraView; nonce: number } | null>(null);
  const [lookThroughCameraId, setLookThroughCameraId] = useState<string | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const [collisionWireVisible, setCollisionWireVisible] = useState(false);
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(stageBuilderPanelSizing.leftDefaultWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(stageBuilderPanelSizing.rightDefaultWidth);
  const [panelResize, setPanelResize] = useState<PanelResizeState | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('empty');
  const [message, setMessage] = useState<string>('');
  const [lastExportFingerprint, setLastExportFingerprint] = useState(() => stageFingerprint(emptyEditorStage()));
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StageBuilderDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [providerStatus, setProviderStatus] = useState<GitHubProviderStatus | null>(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(false);
  const [saveProviderOpen, setSaveProviderOpen] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [providerErrorCode, setProviderErrorCode] = useState<string | null>(null);
  const [remoteStage, setRemoteStage] = useState<ProviderStageRef | null>(null);
  const [bootstrapRepoName, setBootstrapRepoName] = useState<string | null>(null);
  const [openProviderOpen, setOpenProviderOpen] = useState(false);
  const [providerStages, setProviderStages] = useState<ProviderStageListItem[]>([]);
  const [providerListLoading, setProviderListLoading] = useState(false);
  const [providerListError, setProviderListError] = useState('');
  const [publishMarketplaceOpen, setPublishMarketplaceOpen] = useState(false);
  const [marketplacePublishing, setMarketplacePublishing] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [marketplaceResult, setMarketplaceResult] = useState<PublishMarketplaceResponse | null>(null);

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
  const selectedStatus = selectedGroup ? selectedGroup.name : selectedObject ? selectedObject.name : selectedCount ? `${selectedCount} objects` : inspectorTab === 'stage' ? 'Stage' : 'None';
  const selectedTone = selectedGroup ? editorColors.accentText : selectedObject ? editorColors.warning : inspectorTab === 'stage' ? editorColors.accentText : editorColors.text;
  const providerLabel = remoteStage
    ? `GitHub: ${remoteStage.repoOwner}/${remoteStage.repoName}`
    : providerStatus?.connected
      ? providerStatus.selectedInstallationReady
        ? `GitHub ready as @${providerStatus.providerUsername || 'connected'}`
        : 'GitHub connected · install app on a fossbot-* repo'
      : 'Connect GitHub to save stages';
  const providerStatusValue = remoteStage?.repoName || (providerStatus?.connected ? (providerStatus.selectedInstallationReady ? 'Ready' : 'Setup') : 'Off');
  const providerStatusTone = remoteStage || providerStatus?.selectedInstallationReady ? editorColors.success : providerStatus?.connected ? editorColors.warning : editorColors.textMuted;

  const refreshProviderStatus = async () => {
    if (!token) {
      setProviderStatus(null);
      return;
    }
    setProviderStatusLoading(true);
    try {
      setProviderStatus(await getGitHubProviderStatus(token));
    } catch (error) {
      console.warn('[stage-builder] failed to read GitHub provider status', error);
      setProviderStatus(null);
    } finally {
      setProviderStatusLoading(false);
    }
  };

  useEffect(() => { refreshProviderStatus(); }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('github_error')) {
      setSaveProviderOpen(true);
      setProviderError(params.get('github_error') || 'GitHub connection failed.');
      setProviderErrorCode('provider_error');
      window.history.replaceState(null, '', window.location.pathname);
      refreshProviderStatus();
    } else if (params.get('github_connected') || params.get('github_installed')) {
      const repo = params.get('repo');
      if (repo) setBootstrapRepoName(repo);
      setSaveProviderOpen(true);
      setMessage(params.get('github_connected') ? 'GitHub connected. Continue saving when ready.' : 'GitHub App installation updated. Continue saving when ready.');
      window.history.replaceState(null, '', window.location.pathname);
      refreshProviderStatus();
    }
  }, []);

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
    else setInspectorTab((current) => current === 'object' ? 'empty' : current);
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

  const resetPanelWidth = (side: PanelResizeSide) => (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPanelResize(null);
    if (side === 'left') setLeftPanelWidth(stageBuilderPanelSizing.leftDefaultWidth);
    else setRightPanelWidth(stageBuilderPanelSizing.rightDefaultWidth);
  };

  const toggleLeftPanel = () => setLeftPanelVisible((value) => !value);
  const toggleRightPanel = () => setRightPanelVisible((value) => !value);

  const bumpHistory = () => setHistoryVersion((value) => value + 1);
  const setPref = (patch: Partial<StageBuilderPreferences>) => setPrefs((current) => ({ ...current, ...patch }));
  const requestCameraView = (view: StageBuilderCameraView) => {
    if (view === 'camera') {
      const activeCamera = stage.objects.find((o) => o.kind === 'camera' && !o.hidden);
      if (activeCamera) setLookThroughCameraId(activeCamera.id);
    } else {
      setLookThroughCameraId(null);
      setCameraViewRequest((current) => ({ view, nonce: (current?.nonce || 0) + 1 }));
    }
  };
  const requestLookThroughCamera = (object: EditorStageObject) => {
    if (object.kind !== 'camera' || object.hidden) return;
    setLookThroughCameraId(object.id);
  };
  const lookThroughCamera = lookThroughCameraId ? stage.objects.find((item) => item.id === lookThroughCameraId && item.kind === 'camera' && !item.hidden) : null;

  useEffect(() => {
    if (!lookThroughCameraId) return;
    const activeCamera = stage.objects.some((item) => item.id === lookThroughCameraId && item.kind === 'camera' && !item.hidden);
    if (!activeCamera) setLookThroughCameraId(null);
  }, [lookThroughCameraId, stage.objects]);

  const commitStage = (updater: (current: EditorStage) => EditorStage, options: { selectIds?: string[]; selectGroupId?: string | null; message?: string } = {}) => {
    setStage((current) => {
      historyRef.current = pushStageHistory(historyRef.current, current);
      const next = normalizeCameraMetadata(updater(cloneStage(current)));
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
      setInspectorTab('empty');
    }
    if (options.message) setMessage(options.message);
  };

  const replaceStage = (next: EditorStage, options: { undoable?: boolean; clean?: boolean; message?: string } = {}) => {
    const normalizedNext = normalizeCameraMetadata(cloneStage(next));
    const undoable = options.undoable ?? true;
    if (undoable) {
      setStage((current) => {
        historyRef.current = pushStageHistory(historyRef.current, current);
        return normalizedNext;
      });
      bumpHistory();
    } else {
      setStage(normalizedNext);
      historyRef.current = createStageBuilderHistory();
      bumpHistory();
    }
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('empty');
    setBuilderMode('edit');
    if (options.clean) {
      setLastExportFingerprint(stageFingerprint(normalizedNext));
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
    setInspectorTab(existing.length ? 'object' : 'empty');
  };

  const handleSelect = (id: string | null) => {
    setSelectedGroupId(null);
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
    if (id) {
      setInspectorTab('object');
      setBuilderMode('edit');
    } else {
      // Empty-click deselect: keep deliberately-opened tabs (Validation, Settings)
      // sticky, but dismiss viewport-coupled tabs (object/stage/empty).
      setInspectorTab((current) => (current === 'validation' || current === 'settings' ? current : 'empty'));
    }
  };

  const handleSelectGroup = (id: string | null) => {
    const group = id ? stage.metadata.groups.find((item) => item.id === id) : null;
    setSelectedGroupId(group ? group.id : null);
    setSelectedId(null);
    setSelectedIds([]);
    setInspectorTab('empty');
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

  const descendantIdsFor = (objects: EditorStageObject[], ids: string[]): string[] => {
    const collected = new Set(ids);
    let changed = true;
    while (changed) {
      changed = false;
      for (const object of objects) {
        if (object.parentId && collected.has(object.parentId) && !collected.has(object.id)) {
          collected.add(object.id);
          changed = true;
        }
      }
    }
    return Array.from(collected);
  };

  const deleteObjects = (ids: string[]) => {
    if (!ids.length) return;
    const idsWithChildren = descendantIdsFor(stage.objects, ids);
    commitStage((current) => {
      const now = new Date().toISOString();
      const groups = current.metadata.groups
        .map((group) => ({ ...group, objectIds: group.objectIds.filter((objectId) => !idsWithChildren.includes(objectId)), updatedAt: now }))
        .filter((group) => group.objectIds.length > 0);
      const objectGroupIds = new Map<string, string>();
      groups.forEach((group) => group.objectIds.forEach((objectId) => objectGroupIds.set(objectId, group.id)));
      return {
        ...current,
        objects: current.objects
          .filter((object) => !idsWithChildren.includes(object.id))
          .map((object) => {
            const nextGroupId = objectGroupIds.get(object.id);
            if (nextGroupId) return object.groupId === nextGroupId ? object : { ...object, groupId: nextGroupId } as EditorStageObject;
            return object.groupId ? { ...object, groupId: undefined, prefabSourceId: undefined } as EditorStageObject : object;
          }),
        metadata: { ...current.metadata, groups },
      };
    }, { selectIds: selectedIds.filter((id) => !idsWithChildren.includes(id)) });
  };

  const deleteSelected = () => deleteObjects(selectedGroup ? selectedGroupObjectIds : selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []));

  const duplicateObjects = (ids: string[]) => {
    const idsWithChildren = descendantIdsFor(stage.objects, ids);
    const source = stage.objects.filter((object) => idsWithChildren.includes(object.id));
    if (!source.length) return;
    const idMap = new Map(source.map((object) => [object.id, makeLocalStageId()]));
    const copies = source.map((object) => {
      const copy = translateObject(cloneStage(object), [object.parentId ? 0 : 0.5, 0, object.parentId ? 0 : 0.5]) as EditorStageObject;
      const nextParentId = object.parentId && idMap.has(object.parentId) ? idMap.get(object.parentId) : object.parentId;
      const nextAttachment = object.kind === 'text' && object.attachment
        ? { ...object.attachment, parentId: nextParentId || object.attachment.parentId }
        : undefined;
      return {
        ...copy,
        id: idMap.get(object.id)!,
        name: `${object.name} copy`,
        groupId: undefined,
        parentId: nextParentId,
        ...(nextAttachment ? { attachment: nextAttachment } : {}),
      } as EditorStageObject;
    });
    commitStage((current) => ({ ...current, objects: [...current.objects, ...copies] }), { selectIds: copies.filter((copy) => ids.includes(source.find((object) => idMap.get(object.id) === copy.id)?.id || '')).map((copy) => copy.id), message: 'Duplicated selection.' });
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
    const labelParent = kind === 'label' && canAttachLabelTo(selectedObject) ? selectedObject : null;
    const nextObject = labelParent && object.kind === 'text'
      ? { ...object, name: `${labelParent.name} label`, position: 'position' in labelParent ? labelParent.position : object.position, onFloor: false, parentId: labelParent.id, attachment: defaultLabelAttachment(labelParent) } as EditorStageObject
      : object;
    commitStage((current) => ({
      ...current,
      objects: nextObject.kind === 'fossbot'
        ? [...current.objects.filter((item) => item.kind !== 'fossbot'), nextObject]
        : nextObject.kind === 'camera'
          ? [...current.objects.filter((item) => item.kind !== 'camera'), nextObject]
          : [...current.objects, nextObject],
    }), { selectIds: [id], message: labelParent ? `Label attached to ${labelParent.name}.` : `${displayObjectType(nextObject)} added at floor center.` });
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

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.readAsDataURL(file);
  });

  const handleImportCustomObject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > CUSTOM_OBJECT_MAX_FILE_SIZE_BYTES) throw new Error('Custom object is too large. Keep OBJ/STL/GLB files under 10 MB for now.');
      const lowerName = file.name.toLowerCase();
      const format = lowerName.endsWith('.stl') ? 'stl' : lowerName.endsWith('.obj') ? 'obj' : lowerName.endsWith('.glb') ? 'glb' : null;
      if (!format) throw new Error('Custom object import supports OBJ, STL, and GLB files.');
      const id = makeLocalStageId();
      const nativeDimensions = await measureImportedModel(file, format);
      const object: EditorStageObject = {
        id,
        kind: 'model',
        semanticKind: 'customObject',
        name: file.name.replace(/\.(obj|stl|glb)$/i, '') || 'custom object',
        filename: await readFileAsDataUrl(file),
        format,
        originalFileName: file.name,
        position: [0, 0, 0],
        rotationY: 0,
        scale: scaleForMaxDimension(nativeDimensions, CUSTOM_OBJECT_DEFAULT_FIT_METERS),
        normalize: true,
        nativeDimensions,
        color: '#9aa8b6',
        mass: 0,
        immovable: true,
        collision: 'auto',
      };
      commitStage((current) => ({ ...current, objects: [...current.objects, object] }), {
        selectIds: [id],
        message: `${file.name} imported and fit to 0.5 m. Imported objects could have been made in another scale, so the next step is figuring out the correct scale for the object.`,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Custom object import failed.');
    } finally {
      if (customObjectInputRef.current) customObjectInputRef.current.value = '';
    }
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

  const handleProviderConnect = async () => {
    if (!token) {
      setProviderError('Sign in before connecting GitHub.');
      setProviderErrorCode('not_connected');
      return;
    }
    try {
      const url = await getGitHubLoginUrl(token);
      window.location.assign(url);
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : 'Could not start GitHub connection.');
      setProviderErrorCode(null);
    }
  };

  const handleCreateBootstrapLinks = async (slug: string) => {
    if (!token) throw new Error('Sign in before creating GitHub setup links.');
    return getGitHubBootstrapLinks(token, slug);
  };

  const handleProviderSave = async ({ slug, commitMessage }: SaveToProviderValues) => {
    if (!token) {
      setProviderError('Sign in before saving to GitHub.');
      setProviderErrorCode('not_connected');
      return;
    }
    setProviderSaving(true);
    setProviderError('');
    setProviderErrorCode(null);
    try {
      const record = editorStageToRecord(stage);
      const saved = remoteStage
        ? await updateStageOnProvider(token, {
          record,
          repoOwner: remoteStage.repoOwner,
          repoName: remoteStage.repoName,
          baseStageJsonSha: remoteStage.stageJsonSha,
          commitMessage,
        })
        : await createStageOnProvider(token, { record, slug, commitMessage });
      setRemoteStage(saved);
      setBootstrapRepoName(null);
      setLastExportFingerprint(stageFingerprint(stage));
      setExportedAt(new Date().toISOString());
      clearStageBuilderDraft(scope);
      setSaveProviderOpen(false);
      setProviderErrorCode(null);
      setMessage(`Saved to GitHub: ${saved.repoOwner}/${saved.repoName}`);
      refreshProviderStatus();
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        setProviderErrorCode(error.code || null);
        if (error.code === 'sha_conflict') {
          const shaHint = error.currentStageJsonSha ? ` Current remote stage.json SHA: ${error.currentStageJsonSha}.` : '';
          setProviderError(`${error.message}${shaHint} Open the stage from GitHub to reload it, or save this edit as a new fossbot-* repository.`);
        } else if (error.code === 'repo_not_installed' || error.code === 'no_installation') {
          setProviderError(`${error.message} Refresh GitHub status after changing the app installation.`);
        } else if (error.code === 'repo_name_taken') {
          setProviderError(`${error.message} If this is your stage repo, install the FOSSBot GitHub App on it and save again.`);
        } else if (error.code === 'token_expired' || error.code === 'not_connected') {
          setProviderError(`${error.message} Use Connect GitHub to refresh authorization.`);
          refreshProviderStatus();
        } else if (error.code === 'installation_scope_invalid') {
          setProviderError(`${error.message} Reinstall with selected repositories, then refresh status.`);
          refreshProviderStatus();
        } else {
          setProviderError(error.message);
        }
      } else {
        setProviderErrorCode(null);
        setProviderError(error instanceof Error ? error.message : 'Save to GitHub failed.');
      }
    } finally {
      setProviderSaving(false);
    }
  };

  const handlePublishMarketplace = async ({ title, description, tags, previewDataUrl, commitMessage }: PublishMarketplaceValues) => {
    if (!token) {
      setMarketplaceError('Sign in before publishing to the marketplace.');
      return;
    }
    if (!remoteStage) {
      setMarketplaceError('Save this stage to GitHub before publishing.');
      return;
    }
    setMarketplacePublishing(true);
    setMarketplaceError('');
    setMarketplaceResult(null);
    try {
      const result = await publishStageToMarketplace(token, {
        repoOwner: remoteStage.repoOwner,
        repoName: remoteStage.repoName,
        title,
        description,
        tags,
        previewDataUrl,
        commitMessage,
      });
      setMarketplaceResult(result);
      setMessage(`Marketplace PR created for ${remoteStage.repoOwner}/${remoteStage.repoName}.`);
    } catch (error) {
      if (error instanceof MarketplaceRequestError) {
        setMarketplaceError(error.message);
      } else {
        setMarketplaceError(error instanceof Error ? error.message : 'Publish to marketplace failed.');
      }
    } finally {
      setMarketplacePublishing(false);
    }
  };

  const handleOpenMarketplaceDialog = () => {
    setMarketplaceError('');
    setMarketplaceResult(null);
    setPublishMarketplaceOpen(true);
  };

  const refreshProviderStageList = async () => {
    if (!token) {
      setProviderListError('Sign in before opening from GitHub.');
      setProviderStages([]);
      return;
    }
    setProviderListLoading(true);
    setProviderListError('');
    try {
      setProviderStages(await listProviderStages(token));
    } catch (error) {
      setProviderStages([]);
      setProviderListError(error instanceof Error ? error.message : 'Could not list GitHub stages.');
    } finally {
      setProviderListLoading(false);
    }
  };

  const handleProviderOpenDialog = () => {
    setOpenProviderOpen(true);
    refreshProviderStageList();
  };

  const handleOpenProviderStage = async (item: ProviderStageListItem) => {
    if (!token) return;
    if (!confirmIfDirty('Open this GitHub stage and replace the current editor stage? Unsaved changes will remain only as a recovery draft.')) return;
    setProviderListLoading(true);
    setProviderListError('');
    try {
      const loaded = await loadStageFromProvider(token, item.repoOwner, item.repoName);
      replaceStage(configToEditorStage(loaded.record), { undoable: true, clean: true, message: 'Opened stage from GitHub.' });
      setRemoteStage({
        repoOwner: loaded.repoOwner,
        repoName: loaded.repoName,
        repoUrl: loaded.repoUrl,
        commitSha: loaded.commitSha,
        stageJsonSha: loaded.stageJsonSha,
        rawBaseUrl: loaded.rawBaseUrl,
      });
      setOpenProviderOpen(false);
    } catch (error) {
      setProviderListError(error instanceof Error ? error.message : 'Could not open GitHub stage.');
    } finally {
      setProviderListLoading(false);
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
    if (dirty) writeStageBuilderDraft(stage, scope);
    const blocking = blockingValidationResults(validationResults);
    if (blocking.length) {
      setInspectorTab('validation');
      setMessage(`Fix ${blocking.length} validation error${blocking.length === 1 ? '' : 's'} before running the test simulation.`);
      return;
    }
    const handoffId = writeStageBuilderRunHandoff(editorStageToRecord(stage), undefined, { collisionWireVisible, stageAssetBaseUrl: remoteStage?.rawBaseUrl });
    if (!handoffId) {
      setMessage('Run Test could not store this stage locally. Remove a large imported object or export JSON, then try again.');
      return;
    }
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

  const handleOpenPreviewSettings = () => {
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('previewSettings');
    setRightPanelVisible(true);
  };

  const undo = () => {
    const { history, stage: previous } = undoStageHistory(historyRef.current, stage);
    historyRef.current = history;
    if (previous) {
      setStage(normalizeCameraMetadata(previous));
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
      setStage(normalizeCameraMetadata(next));
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

      if (moving.kind === 'text' && target.position === 'inside' && targetObject && canAttachLabelTo(targetObject)) {
        return {
          ...current,
          objects: current.objects.map((object) => object.id === moving.id ? {
            ...moving,
            parentId: targetObject.id,
            groupId: undefined,
            onFloor: false,
            attachment: moving.attachment?.parentId === targetObject.id ? moving.attachment : defaultLabelAttachment(targetObject),
          } as EditorStageObject : object),
          metadata: { ...current.metadata, groups: current.metadata.groups.map((group) => ({ ...group, objectIds: group.objectIds.filter((objectId) => objectId !== moving.id) })).filter((group) => group.objectIds.length > 0) },
        };
      }

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
      if (key === 'escape') {
        if (lookThroughCameraId) setLookThroughCameraId(null);
        else handleSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefs.keyboardShortcutsEnabled, stage, selectedId, selectedIds, selectedGroupId, snapSettings, historyVersion, lookThroughCameraId]);

  return (
    <EditorThemeProvider value={useMemo(() => {
      const variant = prefs.styleVariant;
      return {
        variant,
        colors: getEditorColors(variant),
        tones: getEditorTones(variant),
        type: getEditorType(variant),
        panelSx: getEditorPanelSx(variant),
        tabsSx: getEditorTabsSx(variant),
        inspectorSx: getInspectorPanelSx(variant),
      };
    }, [prefs.styleVariant])}>
    <Box ref={rootRef} sx={{ '--fossbot-box-border-radius': '0px', borderRadius: 0, width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: editorColors.viewport }}>
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
        onBack={handleBack}
        onNew={handleNew}
        onDemo={handleDemo}
        providerLabel={providerLabel}
        providerBusy={providerSaving || providerStatusLoading}
        marketplaceBusy={marketplacePublishing}
        onImport={() => importInputRef.current?.click()}
        onExport={handleExport}
        onSaveProvider={() => { setProviderError(''); setProviderErrorCode(null); setSaveProviderOpen(true); }}
        onOpenProvider={handleProviderOpenDialog}
        onPublishMarketplace={handleOpenMarketplaceDialog}
        onRunTest={handleRunTest}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onOpenValidation={() => setInspectorTab('validation')}
        onOpenSettings={handleOpenSettings}
        onOpenStageSettings={handleOpenStageSettings}
        onOpenPreviewSettings={handleOpenPreviewSettings}
        onToggleLeftPanel={toggleLeftPanel}
        onToggleRightPanel={toggleRightPanel}
      />
      <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => handleImportFile(event.target.files?.[0])} />
      <input ref={customObjectInputRef} type="file" accept=".obj,.stl,.glb,model/obj,model/stl,model/gltf-binary,text/plain,application/sla" hidden onChange={(event) => handleImportCustomObject(event.target.files?.[0])} />

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
              onImportObject={() => customObjectInputRef.current?.click()}
              onSelectObject={handleSelect}
              onSelectGroup={handleSelectGroup}
              onSelectionChange={handleSelectionChange}
              onObjectChange={updateObject}
              onDuplicateObjects={duplicateObjects}
              onDeleteObjects={deleteObjects}
              onHierarchyDrop={handleHierarchyDrop}
              onGroupRename={renameGroup}
              onPatchObjects={patchObjects}
              onTogglePanel={toggleLeftPanel}
            />
          </Box>
        )}
        {leftPanelVisible && <PanelResizeHandle side="left" onPointerDown={beginPanelResize('left')} onDoubleClick={resetPanelWidth('left')} />}
        {!leftPanelVisible && <EditorPanelTab side="left" label="Library" onClick={toggleLeftPanel} />}

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
            skybox={stage.metadata.skybox}
            gridVisible={gridVisible}
            gridSize={gridSize}
            snapSettings={snapSettings}
            transformSpace={prefs.transformSpace}
            controlScheme="legacyGizmo"
            lockMode={prefs.lockMode}
            styleVariant={prefs.styleVariant}
            validationResults={validationResults}
            focusRequestNonce={focusRequestNonce}
            cameraViewRequest={cameraViewRequest}
            lookThroughCameraId={lookThroughCamera?.id || null}
            sensorHelpersVisible={sensorHelpersVisible}
            collisionWireVisible={collisionWireVisible}
            stageAssetBaseUrl={remoteStage?.rawBaseUrl}
            onSelect={handleSelect}
            onSelectionChange={handleSelectionChange}
            onObjectChange={updateObject}
            onObjectsChange={updateObjects}
            onLockedSelectionAttempt={() => setMessage('Selection is locked to the current object. Change Selection behavior in Settings to select through objects.')}
          />
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
            <EditorViewportToolRail
              transformMode={transformMode}
              snapPreset={prefs.snapPreset}
              selectedCount={selectedCount}
              canUndo={canUndo(historyRef.current)}
              sensorHelpersVisible={sensorHelpersVisible}
              collisionWireVisible={collisionWireVisible}
              canRedo={canRedo(historyRef.current)}
              onTransformModeChange={(mode) => { setBuilderMode('edit'); setTransformMode(mode); }}
              onSnapPresetChange={(snapPreset) => {
                setPref({ snapPreset });
                commitStage((current) => ({ ...current, metadata: { ...current.metadata, defaultSnapPreset: snapPreset === 'free' || snapPreset === 'grid' ? 'medium' : snapPreset } }));
              }}
              onSensorHelpersToggle={() => setSensorHelpersVisible((visible) => !visible)}
              onCollisionWireToggle={() => setCollisionWireVisible((visible) => !visible)}
              onFocusSelected={() => setFocusRequestNonce((value) => value + 1)}
              onUndo={undo}
              onRedo={redo}
              onDelete={deleteSelected}
            />
          </Box>
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
            <EditorViewportCameraGizmo currentView={lookThroughCameraId && lookThroughCamera ? 'camera' : (cameraViewRequest?.view || 'perspective')} hasActiveCamera={hasVisibleStageCamera(stage)} onCameraViewChange={requestCameraView} />
          </Box>
          {lookThroughCamera && lookThroughCamera.kind === 'camera' && (
            <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 6, maxWidth: 'min(420px, calc(100% - 32px))', pointerEvents: 'none' }}>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{
                  maxWidth: '100%',
                  minWidth: 0,
                  height: 34,
                  px: 1,
                  bgcolor: editorColors.glass,
                  color: editorColors.text,
                  border: `1px solid ${editorColors.border}`,
                  borderRadius: 0.75,
                  backdropFilter: 'blur(10px)',
                  pointerEvents: 'auto',
                }}
              >
                <VideocamIcon fontSize="small" sx={{ color: editorTones.camera.accent, flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ minWidth: 0, fontWeight: 800, color: editorColors.textStrong }}>Looking through {cameraPreviewName(lookThroughCamera.name)}</Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => { setLookThroughCameraId(null); setCameraViewRequest(null); }}
                  sx={{
                    flexShrink: 0,
                    minWidth: 0,
                    height: 24,
                    px: 0.75,
                    py: 0,
                    borderRadius: 0.5,
                    bgcolor: editorColors.keycapBg,
                    color: editorTones.camera.text,
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: editorColors.keycapBorder, color: editorColors.textStrong },
                    '&:focus-visible': { outline: `2px solid ${editorTones.camera.accent}`, outlineOffset: 2 },
                  }}
                >
                  Exit
                </Button>
              </Stack>
            </Box>
          )}
        </Box>

        {rightPanelVisible && <PanelResizeHandle side="right" onPointerDown={beginPanelResize('right')} onDoubleClick={resetPanelWidth('right')} />}
        {!rightPanelVisible && <EditorPanelTab side="right" label="Inspector" onClick={toggleRightPanel} />}
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
              onLookThroughCamera={requestLookThroughCamera}
              onToggleValidationOverride={toggleValidationOverride}
              onPrefsChange={setPref}
              onResetPrefs={() => setPrefs(defaultStageBuilderPreferences)}
              onTogglePanel={toggleRightPanel}
            />
          </Box>
        )}
      </Box>

      <Box sx={{ height: 28, pl: 1, pr: 1.25, display: 'flex', alignItems: 'center', gap: 2, bgcolor: editorColors.topbar, color: editorColors.keycapInk, borderTop: `1px solid ${editorColors.divider}` }}>
        <Stack direction="row" spacing={1.75} alignItems="baseline" sx={{ minWidth: 0, flexShrink: 0 }}>
          <StatusItem label="Mode" value={builderMode === 'edit' ? transformMode : builderMode} tone={editorColors.accentText} />
          <StatusItem label="Selected" value={selectedStatus} tone={selectedTone} />
          <StatusItem label="Snap" value={snapLabel(snapSettings)} tone={snapSettings.move ? editorColors.success : editorColors.textMuted} />
          <StatusItem label="Grid" value={gridVisible ? `${gridSize} m` : 'Hidden'} tone={editorColors.text} />
          <StatusItem label="GitHub" value={providerStatusValue} tone={providerStatusTone} />
          <StatusItem label="Collision" value={collisionWireVisible ? 'Wire' : 'Hidden'} tone={collisionWireVisible ? editorColors.warning : editorColors.textMuted} />
        </Stack>
        <ShortcutHint />
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

      <SaveToProviderDialog
        open={saveProviderOpen}
        stageTitle={stage.title}
        status={providerStatus}
        remoteStage={remoteStage}
        bootstrapRepoName={bootstrapRepoName}
        busy={providerSaving}
        error={providerError}
        errorCode={providerErrorCode}
        onClose={() => setSaveProviderOpen(false)}
        onConnect={handleProviderConnect}
        onRefreshStatus={refreshProviderStatus}
        onBeforeInstall={() => writeStageBuilderDraft(stage, scope)}
        onOpenFromGitHub={() => { setSaveProviderOpen(false); handleProviderOpenDialog(); }}
        onCreateBootstrapLinks={handleCreateBootstrapLinks}
        onSave={handleProviderSave}
      />

      <OpenFromProviderDialog
        open={openProviderOpen}
        stages={providerStages}
        busy={providerListLoading}
        error={providerListError}
        onClose={() => setOpenProviderOpen(false)}
        onRefresh={refreshProviderStageList}
        onOpenStage={handleOpenProviderStage}
      />

      <PublishToMarketplaceDialog
        open={publishMarketplaceOpen}
        stageTitle={stage.title}
        stageDescription={stage.description}
        remoteStage={remoteStage}
        busy={marketplacePublishing}
        error={marketplaceError}
        result={marketplaceResult}
        onClose={() => setPublishMarketplaceOpen(false)}
        onSaveToGitHub={() => { setPublishMarketplaceOpen(false); setSaveProviderOpen(true); }}
        onPublish={handlePublishMarketplace}
      />

      <Snackbar open={!!message} autoHideDuration={3600} onClose={() => setMessage('')} message={message} />
    </Box>
    </EditorThemeProvider>
  );
};

export default StageBuilderPage;
