import { SavedStagePreview } from 'src/components/stage-builder/SavedStagePreview';
import { SaveStageBeforeLeavingDialog } from 'src/components/stage-builder/SaveStageBeforeLeavingDialog';
import { useStageBuilderDeparture } from 'src/components/stage-builder/useStageBuilderDeparture';
import { sharpLineCorners } from 'src/simulator/stages/lineGeometryCore';
import { insertDrawnLinePoint, reconcileLineOperation, type LineOperation } from 'src/components/stage-builder/stageBuilderLineEditing';
import type { EditorLineObject } from 'src/components/stage-builder/types';
import { copyHierarchySelection, createHierarchyFolder, deleteHierarchyFolder, moveHierarchyRow, normalizeStageHierarchy, placeHierarchyRows, type HierarchyDrop } from 'src/components/stage-builder/stageBuilderHierarchy';
import type { StageHierarchyRow } from 'src/components/stage-builder/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { approvedThemeOptions } from 'src/theme/ApprovedTheme';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'src/authentication/AuthProvider';
import type { EditorStage, EditorStageObject, StageLabelAttachment, StageSemanticKind, Vec3 } from 'src/components/stage-builder/types';
import { downloadStageJson, downloadStageSource, makeLocalStageId, stageRecordFromImportedJson } from 'src/components/stage-builder/localStages';
import { StageBuilderScene, type StageBuilderCameraView, type StageBuilderSceneHandle, type StageBuilderTransformMode } from 'src/components/stage-builder/StageBuilderScene';
import { configToEditorStage, createDemoEditorStage, DEFAULT_STAGE_FLOOR, DEFAULT_STAGE_METADATA, editorStageToRecord } from 'src/components/stage-builder/serialize';
import {
  defaultStageBuilderPreferences,
  readStageBuilderPreferences,
  type StageBuilderPreferences,
  writeStageBuilderPreferences,
} from 'src/components/stage-builder/stageBuilderPreferences';
import { createCatalogObject, displayObjectType } from 'src/components/stage-builder/stageBuilderCatalog';
import { getSnapSettings, setStageSnapping, stageSnapMetadata } from 'src/components/stage-builder/stageBuilderSnapping';
import { blockingValidationResults, validateStageBuilderStage } from 'src/components/stage-builder/stageBuilderValidation';
import { cloneStage, objectPosition, placementFitsStage, translateObject } from 'src/components/stage-builder/stageBuilderGeometry';
import { canRedo, canUndo, createStageBuilderHistory, pushStageHistory, redoStageHistory, undoStageHistory, type StageBuilderHistory } from 'src/components/stage-builder/stageBuilderHistory';
import { builtInStageBuilderPrefabs, prefabInsertionOffset, type StageBuilderPrefab } from 'src/components/stage-builder/stageBuilderPrefabs';
import { hasFloorGeometry, placeObjectsOnFloor } from 'src/components/stage-builder/stageBuilderFloorPlacement';
import { EditorTopBar } from 'src/components/stage-builder/EditorTopBar';
import { EditorLeftPanel } from 'src/components/stage-builder/EditorLeftPanel';
import { restoreBlankStageFavourites, useLibraryShortlists, type LibraryItem } from 'src/components/stage-builder/stageBuilderRecentItems';
import { StageLineToolbar } from 'src/components/stage-builder/StageLineToolbar';
import { EditorViewportToolRail, EditorViewportSnapControls } from 'src/components/stage-builder/EditorViewportToolRail';
import { EditorViewportCameraGizmo } from 'src/components/stage-builder/EditorViewportCameraGizmo';
import VideocamIcon from '@mui/icons-material/Videocam';
import { EditorPanelTab } from 'src/components/stage-builder/EditorPanelTab';
import { EditorRightInspector, type InspectorTab } from 'src/components/stage-builder/EditorRightInspector';
import { stageFingerprint } from 'src/components/stage-builder/stageBuilderDrafts';
import { listStageRecovery, recoverySessionScope, findStageRecovery, type RecentStageDraft, recoverySourceKey, adoptLegacyDraft, clearMatchingStageRecovery, createRecoveryIdentity, discardRecoverySource, discoverStageRecovery, persistStageRecovery, sameRecoverySource, writeOriginalCheckpoint, type RecoverySources, type StageRecoverySession } from 'src/components/stage-builder/stageBuilderRecovery';
import { upgradeStageRecord, type StageMigrationDiagnostic } from 'src/components/stage-builder/stageBuilderMigration';
import { writeStageBuilderRunHandoff } from 'src/components/stage-builder/stageBuilderRunHandoff';
import { EditorThemeProvider, getEditorColors, getEditorPanelSx, getEditorTabsSx, getEditorTones, getEditorType, getInspectorPanelSx, useEditorTheme } from 'src/components/stage-builder/stageBuilderEditorTheme';
import { CUSTOM_OBJECT_DEFAULT_FIT_METERS, CUSTOM_OBJECT_DIMENSION_EPSILON, CUSTOM_OBJECT_MAX_FILE_SIZE_BYTES } from 'src/components/stage-builder/stageBuilderCustomObjects';
import { getGitHubBootstrapLinks, getGitHubLoginUrl, getGitHubProviderStatus, type GitHubProviderStatus } from 'src/stages/ProviderAuthApi';
import { createStageOnProvider, loadStageFromProvider, ProviderRequestError, updateStageOnProvider, type ProviderStageListItem, type ProviderStageRef } from 'src/stages/StagesApi';
import { SaveToProviderDialog, type SaveToProviderValues } from 'src/stages/SaveToProviderDialog';
import { OpenFromProviderDialog } from 'src/stages/OpenFromProviderDialog';
import { getMarketplaceStageStatus, publishStageToMarketplace, MarketplaceRequestError, type MarketplaceStageStatusResponse, type PublishMarketplaceResponse } from 'src/stages/MarketplaceApi';
import { PublishToMarketplaceDialog, type PublishMarketplaceValues } from 'src/stages/PublishToMarketplaceDialog';
import { invalidateLocalStages, invalidateMarketplaceFirstPage, invalidateMyMarketplaceStages, invalidateUserStages, refreshMarketplaceFirstPage, refreshMyMarketplaceStages, refreshUserStages, stageListUserKey, subscribeUserStages, userStagesSnapshot } from 'src/stages/stageListCache';
import { createLocalStage, listLocalStages, loadLocalStage, LocalStageRequestError, publishLocalStage, updateLocalStage, type LocalPublicationSubmissionSummary, type LocalStage, type LocalStageSummary } from 'src/stages/LocalStagesApi';
import { localStageRepository } from 'src/components/stage-builder/localStages';
import type { LocalStageRecord } from 'src/components/stage-builder/types';
import { OpenLocalStageDialog } from 'src/stages/OpenLocalStageDialog';
import { useFeatureFlags } from 'src/config/FeatureFlags';
import StageAuthoringAssistant from 'src/components/ai/StageAuthoringAssistant';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import { useDeleteStage } from 'src/stages/useDeleteStage';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import type { StageAuthoringTarget } from 'src/ai/suggestions/stageSuggestions';

function userScope(user: ReturnType<typeof useAuth>['user']): string {
  if (!user) return 'anonymous';
  if (typeof user === 'string') return user;
  return user.username || String(user.id || 'anonymous');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

type PendingPlacement = {
  objects: EditorStageObject[];
  title: string;
  item?: LibraryItem;
};

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

const leaveMessage = 'You have unsaved changes. Save your stage before leaving.';
const DRAFT_SAVE_DELAY_MS = 2_000;
const desktopPanelsInitiallyVisible = () => typeof window === 'undefined'
  || typeof window.matchMedia !== 'function'
  || window.matchMedia('(min-width:1200px)').matches;

type GitHubDeepLinkTarget = {
  repoOwner: string;
  repoName: string;
  label: string;
  action?: 'publish';
};

type GitHubDeepLinkLoadState = {
  status: 'idle' | 'loading' | 'error';
  repoLabel?: string;
  step?: string;
  error?: string;
};

function githubDeepLinkTargetFromLocation(): GitHubDeepLinkTarget | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('open') !== 'github') return null;
  const repoParam = params.get('repo') || '';
  const [ownerFromRepo, nameFromRepo] = repoParam.includes('/') ? repoParam.split('/', 2) : ['', ''];
  const repoOwner = ownerFromRepo || params.get('owner') || '';
  const repoName = nameFromRepo || params.get('name') || '';
  if (!repoOwner || !repoName) return null;
  return { repoOwner, repoName, label: `${repoOwner}/${repoName}`, action: params.get('action') === 'publish' ? 'publish' : undefined };
}

function localDeepLinkStageIdFromLocation(): number | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('open') !== 'local') return null;
  const stageId = Number(params.get('id'));
  return Number.isInteger(stageId) && stageId > 0 ? stageId : null;
}

function remoteStageUrlFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('open') !== 'url') return null;
  const stageUrl = params.get('url');
  if (!stageUrl) return null;
  try {
    const resolved = new URL(stageUrl, window.location.origin);
    if (resolved.protocol !== 'https:' && resolved.origin !== window.location.origin) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const GITHUB_PROVIDER_STATUS_CACHE_MS = 30_000;
const MARKETPLACE_STATUS_CACHE_MS = 45_000;

type RefreshCacheOptions = { force?: boolean };

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

function GitHubStageLoadScreen({ state, onRetry, onBack, onOpenPicker }: { state: GitHubDeepLinkLoadState; onRetry: () => void; onBack: () => void; onOpenPicker: () => void }) {
  const { colors: editorColors } = useEditorTheme();
  const loading = state.status === 'loading';
  return (
    <Box sx={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', bgcolor: editorColors.viewport, color: editorColors.text, p: 3 }}>
      <Stack spacing={2.25} sx={{ width: 'min(520px, 100%)', p: 3, border: `1px solid ${editorColors.border}`, borderRadius: 2, bgcolor: editorColors.panel }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {loading ? <CircularProgress size={30} /> : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={850}>{loading ? 'Opening stage from GitHub' : 'Could not open GitHub stage'}</Typography>
            <Typography variant="body2" sx={{ color: editorColors.textMuted, wordBreak: 'break-all' }}>{state.repoLabel || 'GitHub stage'}</Typography>
          </Box>
        </Stack>
        {loading ? (
          <Stack spacing={1}>
            {['Checking GitHub connection…', 'Loading stage.json…', 'Preparing editor…'].map((step) => {
              const active = state.step === step;
              return (
                <Stack key={step} direction="row" spacing={1} alignItems="center" sx={{ color: active ? editorColors.textStrong : editorColors.textMuted }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: active ? editorColors.accentText : editorColors.border }} />
                  <Typography variant="body2" fontWeight={active ? 800 : 500}>{step}</Typography>
                </Stack>
              );
            })}
            <Typography variant="caption" sx={{ color: editorColors.textMuted }}>Large assets may continue loading after the editor opens.</Typography>
          </Stack>
        ) : (
          <Alert severity="error">{state.error || 'The stage could not be loaded from GitHub.'}</Alert>
        )}
        {!loading && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={onRetry}>Try again</Button>
            <Button variant="outlined" onClick={onOpenPicker}>Open from GitHub…</Button>
            <Button variant="text" onClick={onBack}>Back to stages</Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

const StageBuilderPage = () => {
  const { notify } = useNotifications();
  const confirmDialog = useConfirmDialog();
  const { deleteStage, busy: deletingStage } = useDeleteStage();
  const { t } = useTranslation();
  const { user, token, isGuest } = useAuth();
  const { marketplace: marketplaceAllowed, ready: featureFlagsReady } = useFeatureFlags();
  const marketplaceEnabled = marketplaceAllowed && !isGuest;
  const navigate = useNavigate();
  const desktopPanels = useMediaQuery((theme: any) => theme.breakpoints.up('lg'));
  const scope = useMemo(() => isGuest ? 'guest' : userScope(user), [isGuest, user]);
  const guestStageIdFromUrl = useMemo(() => new URLSearchParams(window.location.search).get('guestStage'), []);
  const [guestLocalStageId, setGuestLocalStageId] = useState<string | null>(null);
  const [guestOpenLocalOpen, setGuestOpenLocalOpen] = useState(false);
  const [guestLocalStages, setGuestLocalStages] = useState<LocalStageRecord[]>([]);
  const [browserPrefs, setPrefs] = useState<StageBuilderPreferences>(() => readStageBuilderPreferences(scope));
  const platformTheme = useTheme();
  const editorVariant = browserPrefs.styleVariant === 'studio' || platformTheme.palette.mode === 'dark' ? 'studio' : 'fossbot';
  const editorMuiTheme = useMemo(() => {
    const approved = approvedThemeOptions(editorVariant === 'studio');
    return createTheme(platformTheme, { ...approved, palette: { ...approved.palette, mode: editorVariant === 'studio' ? 'dark' : 'light' } });
  }, [platformTheme, editorVariant]);
  const editorColors = useMemo(() => getEditorColors(editorVariant), [editorVariant]);
  const editorTones = useMemo(() => getEditorTones(editorVariant), [editorVariant]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const customObjectInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneHandleRef = useRef<StageBuilderSceneHandle | null>(null);
  const providerStatusCacheRef = useRef(0);
  const marketplaceStatusCacheRef = useRef<{ key: string; checkedAt: number }>({ key: '', checkedAt: 0 });
  const historyRef = useRef<StageBuilderHistory>(createStageBuilderHistory());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [stage, setStage] = useState<EditorStage>(() => emptyEditorStage());
  const [placingOnFloor, setPlacingOnFloor] = useState(false);
  const latestStageRef = useRef(stage);
  latestStageRef.current = stage;
  const openRequestRef = useRef(0);
  const stageSnap = stageSnapMetadata(stage.metadata);
  const prefs = { ...browserPrefs, snapPreset: stageSnap.defaultSnapPreset, rotationSnapPreset: stageSnap.defaultRotationSnapPreset };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PendingPlacement | null>(null);
  const [placementValid, setPlacementValid] = useState<boolean | null>(null);
  const builderMode = placement ? 'place' : 'edit';
  const [lineOperation, setLineOperation] = useState<LineOperation>({ mode: 'select' });
  const [objectPreview, setObjectPreview] = useState<EditorStageObject | null>(null);
  useEffect(() => { setLineOperation(current => reconcileLineOperation(current, stage.objects)); }, [stage.objects]);
  const [transformMode, setTransformMode] = useState<StageBuilderTransformMode>('translate');
  const [focusRequestNonce, setFocusRequestNonce] = useState(0);
  const [cameraViewRequest, setCameraViewRequest] = useState<{ view: StageBuilderCameraView; nonce: number } | null>(null);
  const [lookThroughCameraId, setLookThroughCameraId] = useState<string | null>(null);
  const [sensorHelpersVisible, setSensorHelpersVisible] = useState(false);
  const [collisionWireVisible, setCollisionWireVisible] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<'library' | 'scene'>('library');
  const [leftPanelVisible, setLeftPanelVisible] = useState(desktopPanelsInitiallyVisible);
  const [rightPanelVisible, setRightPanelVisible] = useState(desktopPanelsInitiallyVisible);
  const previousDesktopPanels = useRef(desktopPanels);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(stageBuilderPanelSizing.leftDefaultWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(stageBuilderPanelSizing.rightDefaultWidth);
  const [panelResize, setPanelResize] = useState<PanelResizeState | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('empty');
  const setMessage = useCallback((message: string) => {
    if (message) notify(message, { severity: 'info', duration: 3600 });
  }, [notify]);
  const [lastExportFingerprint, setLastExportFingerprint] = useState(() => stageFingerprint(emptyEditorStage()));
  const [appearancePreview, setAppearancePreview] = useState<EditorStage | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [leavePrompt, setLeavePrompt] = useState<{ backupFailed: boolean } | null>(null);
  const leaveAnswer = useRef<((leave: boolean) => void) | null>(null);
  const recoverySession = useRef<StageRecoverySession | null>(null);
  const { recentLibraryItems, rememberRecentItem, favouriteItems, toggleFavourite, carryLibraryItemsTo } = useLibraryShortlists(scope, recoverySession.current?.identity ?? null);
  const [recoverySources, setRecoverySources] = useState<RecoverySources>({ draft: null, original: null, matching: false });
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recentDrafts, setRecentDrafts] = useState<RecentStageDraft[]>([]);
  const [savedPreviewOpen, setSavedPreviewOpen] = useState(false);
  const [restoredSavedVersion, setRestoredSavedVersion] = useState<LocalStageRecord | null>(null);
  const [unfinishedEdits, setUnfinishedEdits] = useState<RecentStageDraft | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<'restored' | 'saved' | null>(null);
  const [recoveryWarning, setRecoveryWarning] = useState('');
  const [migrationDiagnostics, setMigrationDiagnostics] = useState<StageMigrationDiagnostic[]>([]);
  const migrationNotice = migrationDiagnostics.map(item => item.message).join(' ');
  const [rejectedSource, setRejectedSource] = useState<{ raw: string; message: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [providerStatus, setProviderStatus] = useState<GitHubProviderStatus | null>(null);
  const [localStage, setLocalStage] = useState<LocalStage | null>(null);
  const [localStageSaving, setLocalStageSaving] = useState(false);
  const [localStages, setLocalStages] = useState<LocalStageSummary[]>([]);
  const [localStagesLoading, setLocalStagesLoading] = useState(false);
  const [localStagesError, setLocalStagesError] = useState('');
  const [openLocalStageOpen, setOpenLocalStageOpen] = useState(false);
  const [providerStatusLoading, setProviderStatusLoading] = useState(false);
  const [saveProviderOpen, setSaveProviderOpen] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [providerErrorCode, setProviderErrorCode] = useState<string | null>(null);
  const [remoteStage, setRemoteStage] = useState<ProviderStageRef | null>(null);
  useEffect(() => {
    if (!draftReady) return;
    // Keep the active stage in the URL so refresh reopens it after its recovery draft is cleared on save.
    let search = '';
    if (isGuest && guestLocalStageId) {
      search = `?guestStage=${encodeURIComponent(guestLocalStageId)}`;
    } else if (localStage) {
      search = `?open=local&id=${localStage.id}`;
    } else if (remoteStage) {
      search = `?open=github&repo=${encodeURIComponent(`${remoteStage.repoOwner}/${remoteStage.repoName}`)}`;
    }
    if (window.location.search !== search) {
      window.history.replaceState(window.history.state, '', window.location.pathname + search + window.location.hash);
    }
  }, [draftReady, isGuest, guestLocalStageId, localStage, remoteStage]);
  const [bootstrapRepoName, setBootstrapRepoName] = useState<string | null>(null);
  const [openProviderOpen, setOpenProviderOpen] = useState(false);
  const [livePreviewStage, setLivePreviewStage] = useState<EditorStage | null>(null);
  const [livePreviewTarget, setLivePreviewTarget] = useState<StageAuthoringTarget | null>(null);
  const handleAssistantPreviewStageChange = useCallback((previewStage: EditorStage | null, target: StageAuthoringTarget) => {
    setLivePreviewStage(previewStage);
    setLivePreviewTarget(previewStage ? target : null);
  }, []);
  const activeStage = livePreviewStage || appearancePreview || (objectPreview ? { ...stage, objects: stage.objects.map(object => object.id === objectPreview.id ? objectPreview : object) } : stage);
  const [providerStages, setProviderStages] = useState<ProviderStageListItem[]>([]);
  const [providerListLoading, setProviderListLoading] = useState(false);
  const [providerListError, setProviderListError] = useState('');
  const [providerListWarning, setProviderListWarning] = useState(false);
  const [publishMarketplaceOpen, setPublishMarketplaceOpen] = useState(false);
  const [marketplacePublishing, setMarketplacePublishing] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [marketplaceResult, setMarketplaceResult] = useState<PublishMarketplaceResponse | null>(null);
  const [localPublicationRequest, setLocalPublicationRequest] = useState<LocalPublicationSubmissionSummary | null>(null);
  const [marketplaceStatus, setMarketplaceStatus] = useState<MarketplaceStageStatusResponse | null>(null);
  const [marketplaceStatusLoading, setMarketplaceStatusLoading] = useState(false);
  const [githubDeepLinkTarget] = useState<GitHubDeepLinkTarget | null>(() => githubDeepLinkTargetFromLocation());
  const [localDeepLinkStageId] = useState<number | null>(() => localDeepLinkStageIdFromLocation());
  const [remoteStageUrl] = useState<string | null>(() => remoteStageUrlFromLocation());
  const [githubDeepLinkRetry, setGithubDeepLinkRetry] = useState(0);
  const [githubDeepLinkLoad, setGithubDeepLinkLoad] = useState<GitHubDeepLinkLoadState>(() => {
    const target = githubDeepLinkTargetFromLocation();
    return target ? { status: 'loading', repoLabel: target.label, step: 'Checking GitHub connection…' } : { status: 'idle' };
  });
  const stageListUser = useMemo(() => stageListUserKey(user), [user]);

  const prefabs = useMemo(() => builtInStageBuilderPrefabs(), []);
  const snapSettings = useMemo(() => getSnapSettings(prefs.snapPreset, prefs.rotationSnapPreset), [prefs.snapPreset, prefs.rotationSnapPreset]);
  const validationResults = useMemo(() => validateStageBuilderStage(stage), [stage]);
  const selectedObject = activeStage.objects.find((object) => object.id === selectedId) || null;
  const selectedGroup = selectedGroupId ? stage.metadata.groups.find((group) => group.id === selectedGroupId) || null : null;
  const selectedGroupObjectIds = selectedGroup ? selectedGroup.objectIds.filter((id) => stage.objects.some((object) => object.id === id)) : [];
  const selectedCount = selectedGroup ? selectedGroupObjectIds.length : selectedIds.length || (selectedId ? 1 : 0);
  const assistantSelectedIds = selectedGroup ? selectedGroupObjectIds : selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
  const floorSelectionKey = JSON.stringify(assistantSelectedIds);
  const latestFloorSelectionRef = useRef(floorSelectionKey);
  latestFloorSelectionRef.current = floorSelectionKey;
  const currentFingerprint = useMemo(() => stageFingerprint(stage), [stage]);
  const savedLocalFingerprint = useMemo(() => localStage ? stageFingerprint(configToEditorStage(localStage.record)) : null, [localStage]);
  const dirty = currentFingerprint !== lastExportFingerprint;
  const localStageHasChanges = savedLocalFingerprint === null ? dirty : currentFingerprint !== savedLocalFingerprint;
  const gridVisible = stage.metadata.gridVisible ?? true;
  const gridSize = stage.metadata.gridSize ?? 0.5;
  const selectedStatus = selectedGroup?.name || (selectedCount > 1 ? `${selectedCount} objects` : selectedObject?.name || (inspectorTab === 'stage' ? 'Stage' : 'None'));
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
  const marketplaceResultForCurrentStage = marketplaceResult && remoteStage && marketplaceResult.entry.repoOwner === remoteStage.repoOwner && marketplaceResult.entry.repoName === remoteStage.repoName ? marketplaceResult : null;
  const marketplacePullRequest = marketplaceResultForCurrentStage?.pullRequest || (marketplaceResultForCurrentStage?.pullRequestUrl ? {
    number: marketplaceResultForCurrentStage.pullRequestNumber,
    url: marketplaceResultForCurrentStage.pullRequestUrl,
    state: marketplaceResultForCurrentStage.pullRequestState || 'open',
  } : null) || marketplaceStatus?.pullRequest || null;
  const marketplacePublishLabel = marketplaceStatus?.lifecycle.state === 'changes_ready_to_publish' ? 'Publish changes' : 'Publish stage';
  const marketplacePublishReady = marketplaceStatus?.lifecycle.state === 'changes_ready_to_publish';

  useEffect(() => {
    if (previousDesktopPanels.current && !desktopPanels) {
      setLeftPanelVisible(false);
      setRightPanelVisible(false);
    }
    previousDesktopPanels.current = desktopPanels;
  }, [desktopPanels]);

  const refreshProviderStatus = async ({ force = false }: RefreshCacheOptions = {}) => {
    if (!token || isGuest) {
      providerStatusCacheRef.current = 0;
      setProviderStatus(null);
      return;
    }
    const now = Date.now();
    if (!force && providerStatusCacheRef.current && now - providerStatusCacheRef.current < GITHUB_PROVIDER_STATUS_CACHE_MS) return;
    setProviderStatusLoading(true);
    try {
      const status = await getGitHubProviderStatus(token);
      providerStatusCacheRef.current = Date.now();
      setProviderStatus(status);
    } catch (error) {
      providerStatusCacheRef.current = 0;
      console.warn('[stage-builder] failed to read GitHub provider status', error);
      setProviderStatus(null);
    } finally {
      setProviderStatusLoading(false);
    }
  };

  const refreshMarketplaceStatus = async ({ force = false }: RefreshCacheOptions = {}) => {
    if (!marketplaceEnabled || !token || isGuest || !remoteStage || remoteStage.private) {
      marketplaceStatusCacheRef.current = { key: '', checkedAt: 0 };
      setMarketplaceStatus(null);
      setMarketplaceStatusLoading(false);
      return;
    }
    const cacheKey = `${remoteStage.repoOwner}/${remoteStage.repoName}`;
    const cached = marketplaceStatusCacheRef.current;
    const now = Date.now();
    if (!force && cached.key === cacheKey && cached.checkedAt && now - cached.checkedAt < MARKETPLACE_STATUS_CACHE_MS) return;
    setMarketplaceStatusLoading(true);
    try {
      const status = await getMarketplaceStageStatus(token, remoteStage.repoOwner, remoteStage.repoName);
      marketplaceStatusCacheRef.current = { key: cacheKey, checkedAt: Date.now() };
      setMarketplaceStatus(status);
    } catch (error) {
      marketplaceStatusCacheRef.current = { key: '', checkedAt: 0 };
      console.warn('[stage-builder] failed to read marketplace status', error);
      setMarketplaceStatus(null);
    } finally {
      setMarketplaceStatusLoading(false);
    }
  };

  useEffect(() => { refreshProviderStatus(); }, [isGuest, token]);
  useEffect(() => { refreshMarketplaceStatus(); }, [isGuest, marketplaceEnabled, token, remoteStage?.repoOwner, remoteStage?.repoName, remoteStage?.private]);

  useEffect(() => {
    if (!stageListUser) {
      setProviderStages([]);
      setProviderListLoading(false);
      setProviderListError('');
      setProviderListWarning(false);
      return undefined;
    }
    const sync = () => {
      const snapshot = userStagesSnapshot(stageListUser);
      setProviderStages(snapshot.data || []);
      setProviderListLoading(snapshot.refreshing);
      setProviderListError(snapshot.refreshError || '');
      setProviderListWarning(!!snapshot.refreshError && !!snapshot.data);
    };
    sync();
    return subscribeUserStages(stageListUser, sync);
  }, [stageListUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('github_error')) {
      setSaveProviderOpen(true);
      setProviderError(params.get('github_error') || 'GitHub connection failed.');
      setProviderErrorCode('provider_error');
      window.history.replaceState(window.history.state, '', window.location.pathname);
      refreshProviderStatus({ force: true });
    } else if (params.get('github_connected') || params.get('github_installed')) {
      const repo = params.get('repo');
      if (repo) setBootstrapRepoName(repo);
      setSaveProviderOpen(true);
      setMessage(params.get('github_connected') ? 'GitHub connected. Continue saving when ready.' : 'GitHub App installation updated. Continue saving when ready.');
      window.history.replaceState(window.history.state, '', window.location.pathname);
      refreshProviderStatus({ force: true });
    }
  }, []);

  useEffect(() => {
    if (!featureFlagsReady || !githubDeepLinkTarget) return undefined;
    if (isGuest) {
      setGithubDeepLinkLoad({ status: 'error', repoLabel: githubDeepLinkTarget.label, error: 'Guest sessions cannot open GitHub stages.' });
      return undefined;
    }
    if (!token) {
      setGithubDeepLinkLoad({
        status: 'error',
        repoLabel: githubDeepLinkTarget.label,
        error: 'Sign in before opening a GitHub stage in the editor.',
      });
      return undefined;
    }

    let cancelled = false;
    setGithubDeepLinkLoad({ status: 'loading', repoLabel: githubDeepLinkTarget.label, step: 'Checking GitHub connection…' });
    setProviderListLoading(true);
    setProviderListError('');

    const openDeepLinkedStage = async () => {
      try {
        await getGitHubProviderStatus(token);
        if (cancelled) return;
        setGithubDeepLinkLoad({ status: 'loading', repoLabel: githubDeepLinkTarget.label, step: 'Loading stage.json…' });
        await delay(220);
        const loaded = await loadStageFromProvider(token, githubDeepLinkTarget.repoOwner, githubDeepLinkTarget.repoName);
        if (cancelled) return;
        setGithubDeepLinkLoad({ status: 'loading', repoLabel: githubDeepLinkTarget.label, step: 'Preparing editor…' });
        await delay(320);
        if (cancelled) return;
        if (!(await openRecord(loaded.record, { locator: `GitHub ${loaded.repoOwner}/${loaded.repoName} @ ${loaded.commitSha}`, checkpoint: true, initial: true, message: 'Opened stage from GitHub.' }))) return;
        setRemoteStage({
          repoOwner: loaded.repoOwner,
          repoName: loaded.repoName,
          repoUrl: loaded.repoUrl,
          commitSha: loaded.commitSha,
          stageJsonSha: loaded.stageJsonSha,
          rawBaseUrl: loaded.rawBaseUrl,
          private: loaded.private,
          visibility: loaded.visibility,
        });
        setLocalStage(null);
        if (marketplaceEnabled && githubDeepLinkTarget.action === 'publish') setPublishMarketplaceOpen(true);
        setGithubDeepLinkLoad({ status: 'idle' });
      } catch (error) {
        if (!cancelled) {
          setGithubDeepLinkLoad({
            status: 'error',
            repoLabel: githubDeepLinkTarget.label,
            error: error instanceof Error ? error.message : 'Could not open GitHub stage.',
          });
        }
      } finally {
        if (!cancelled) setProviderListLoading(false);
      }
    };

    openDeepLinkedStage();
    return () => { cancelled = true; };
  }, [featureFlagsReady, githubDeepLinkRetry, githubDeepLinkTarget, isGuest, marketplaceEnabled, token]);

  useEffect(() => {
    if (!isGuest || !guestStageIdFromUrl) return;
    let cancelled = false;
    const openSaved = async () => { try {
      const record = localStageRepository.get(guestStageIdFromUrl, scope);
      if (!record) return;
      if (cancelled || !(await openRecord(record, { locator: `Browser stage ${record.id} revision ${record.updatedAt}`, initial: true, message: 'Opened stage from this browser.' }))) return;
      setGuestLocalStageId(record.id);
      setLocalStage(null);
      setRemoteStage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the local stage.');
    } };
    void openSaved();
    return () => { cancelled = true; };
  }, [guestStageIdFromUrl, isGuest, scope]);

  useEffect(() => {
    if (!localDeepLinkStageId || !token || isGuest) return;
    let cancelled = false;
    setLocalStagesLoading(true);
    loadLocalStage(token, localDeepLinkStageId)
      .then(async (loaded) => {
        if (cancelled) return;
        const action = new URLSearchParams(window.location.search).get('action');
        if (!(await openRecord(loaded.record, { locator: `Account stage ${loaded.id} revision ${loaded.revision}`, initial: true, message: 'Opened stage from your account.' }))) return;
        setLocalStage(loaded);
        setRemoteStage(null);
        if (action === 'publish') setPublishMarketplaceOpen(true);
        if (action === 'github-copy') setSaveProviderOpen(true);
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not open local stage.'); })
      .finally(() => { if (!cancelled) setLocalStagesLoading(false); });
    return () => { cancelled = true; };
  }, [isGuest, localDeepLinkStageId, token]);

  useEffect(() => {
    if (!remoteStageUrl) return;
    let cancelled = false;
    setLocalStagesLoading(true);
    fetch(remoteStageUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load stage (${response.status}).`);
        return response.text();
      })
      .then(async (raw) => {
        if (cancelled) return;
        let record;
        try { record = stageRecordFromImportedJson(JSON.parse(raw)); }
        catch (error) { await rejectStageSource(raw, remoteStageUrl, error); throw error; }
        if (!(await openRecord(record, { raw, locator: remoteStageUrl, checkpoint: true, initial: true, clean: false, message: 'Opened stage as a new editable copy.' }))) return;
        setLocalStage(null);
        setRemoteStage(null);
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not open the selected stage.'); })
      .finally(() => { if (!cancelled) setLocalStagesLoading(false); });
    return () => { cancelled = true; };
  }, [remoteStageUrl]);

  useEffect(() => {
    setPrefs(readStageBuilderPreferences(scope));
    try {
      const recent = listStageRecovery(scope);
      setRecentDrafts(recent);
      const explicitSource = !!(guestStageIdFromUrl || localDeepLinkStageId || githubDeepLinkTarget || remoteStageUrl);
      setDraftReady(false);
      const latest = recent.find(item => item.sources.draft?.value);
      if (!explicitSource && latest) {
        void resumeRecentDraft(latest);
      } else if (!explicitSource) {
        const initialRaw = JSON.stringify(editorStageToRecord(stage));
        void createRecoveryIdentity(initialRaw, 'New stage', 'unchanged').then(identity => {
          if (!recoverySession.current) {
            restoreBlankStageFavourites(scope, identity);
            recoverySession.current = { identity, sourceRaw: initialRaw, checkpoint: false, storageScope: recoverySessionScope(scope, identity) };
          }
          setDraftReady(true);
        }).catch(error => setRecoveryWarning(String(error)));
      }
    } catch (error) {
      setRecoveryWarning(`Recovery storage could not be read: ${String(error)}. Download JSON before closing.`);
      setDraftReady(true);
    }
  }, [scope]);

  useEffect(() => { writeStageBuilderPreferences(browserPrefs, scope); }, [browserPrefs, scope]);

  useEffect(() => {
    if (selectedId) setInspectorTab('object');
    else setInspectorTab((current) => current === 'object' ? 'empty' : current);
  }, [selectedId]);

  useEffect(() => {
    if (!draftReady || !dirty) return;
    const timeout = window.setTimeout(() => { persistRecovery(); }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [stage, dirty, draftReady, scope]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      persistRecovery();
      event.preventDefault();
      event.returnValue = leaveMessage;
      return leaveMessage;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, stage, scope]);

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
  const setPref = (patch: Partial<StageBuilderPreferences>) => {
    const { snapPreset, rotationSnapPreset, ...browserPatch } = patch;
    if (Object.keys(browserPatch).length) setPrefs((current) => ({ ...current, ...browserPatch }));
    if (snapPreset !== undefined || rotationSnapPreset !== undefined) {
      setStage((current) => setStageSnapping(current, snapPreset, rotationSnapPreset));
    }
  };
  const requestCameraView = (view: StageBuilderCameraView) => {
    if (view === 'camera') {
      const activeCamera = stage.objects.find((o) => o.kind === 'camera' && !o.hidden);
      if (activeCamera) { setPlacement(null); setLookThroughCameraId(activeCamera.id); }
    } else {
      setLookThroughCameraId(null);
      setCameraViewRequest((current) => ({ view, nonce: (current?.nonce || 0) + 1 }));
    }
  };
  const requestLookThroughCamera = (object: EditorStageObject) => {
    if (object.kind !== 'camera' || object.hidden) return;
    setPlacement(null);
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
      const next = normalizeStageHierarchy(normalizeCameraMetadata(updater(cloneStage(current))));
      if (stageFingerprint(next) === stageFingerprint(current)) return current;
      historyRef.current = pushStageHistory(historyRef.current, current);
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
    const normalizedNext = normalizeStageHierarchy(normalizeCameraMetadata(cloneStage(next)));
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
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
    setAppearancePreview(null);
    if (options.clean) {
      setLastExportFingerprint(stageFingerprint(normalizedNext));
      setSaveStatus(null);
    }
    if (options.message) setMessage(options.message);
  };

  const refreshRecoverySources = (refreshRecent = true) => {
    const sources = discoverStageRecovery(recoverySession.current?.storageScope ?? scope);
    setRecoverySources(sources);
    if (refreshRecent) setRecentDrafts(listStageRecovery(scope));
    return sources;
  };

  const persistRecovery = (): boolean => {
    const session = recoverySession.current;
    let reason = session ? '' : 'The recovery session is not ready.';
    const ok = !!session && persistStageRecovery(stage, session, session.storageScope ?? scope, message => { reason = message; });
    setRecoveryWarning(ok ? '' : `Recovery could not save your latest edits. ${reason} Your work is still open. Existing drafts and originals are preserved. Download JSON before closing.`);
    if (ok) refreshRecoverySources(false);
    return ok;
  };

  const releaseSavedRecovery = (session: StageRecoverySession | null, savedStage: EditorStage) => {
    if (!session) return;
    // Edits made while a remote save was in flight still need their draft.
    if (stageFingerprint(latestStageRef.current) !== stageFingerprint(savedStage) || recoverySession.current !== session) return;
    setRecoveryNotice(null);
    setRestoredSavedVersion(null);
    setUnfinishedEdits(null);
    setSavedPreviewOpen(false);
    session.checkpoint = false;
    const ok = clearMatchingStageRecovery(session.identity, session.storageScope ?? scope);
    setRecoveryWarning(ok ? '' : 'The stage was saved, but recovery cleanup failed. A redundant recovery source is retained.');
    refreshRecoverySources();
  };

  const rejectStageSource = async (raw: string, locator: string, error: unknown) => {
    setRejectedSource({ raw, message: error instanceof Error ? error.message : String(error) });
    try {
      const identity = await createRecoveryIdentity(raw, locator, 'repair-required');
      const saved = writeOriginalCheckpoint(raw, locator, identity, scope);
      if (!saved.ok) setRecoveryWarning(`The rejected source could not be stored: ${saved.error} Export the rejected source before closing.`);
      refreshRecoverySources();
    } catch (failure) { setRecoveryWarning(`The rejected source remains open but is not protected: ${String(failure)}. Export it before closing.`); }
  };

  const openRecord = async (record: LocalStageRecord, options: { locator: string; raw?: string; checkpoint?: boolean; initial?: boolean; undoable?: boolean; clean?: boolean; message?: string; recoveryItem?: RecentStageDraft }) => {
    const request = ++openRequestRef.current;
    const raw = options.raw ?? JSON.stringify(record);
    let migration;
    try {
      migration = upgradeStageRecord(record);
    } catch (error) {
      await rejectStageSource(raw, options.locator, error);
      throw error;
    }
    const identity = await createRecoveryIdentity(raw, options.locator, migration.upgraded ? 'upgraded' : 'unchanged');
    if (request !== openRequestRef.current) return false;
    const recent = listStageRecovery(scope);
    const previous = options.recoveryItem ?? findStageRecovery(recent, options.locator);
    if (previous?.sources.draft?.value) {
      const draft = previous.sources.draft.value;
      const conflict = draft.sourceLocator !== options.locator;
      const useDraft = !conflict || await confirmDialog.confirm({
        title: 'This stage has two versions',
        message: 'The saved stage changed since your unfinished edits. Which version would you like to open? Both copies will be kept.',
        confirmLabel: 'Continue my edits', cancelLabel: 'Open saved version',
      });
      if (request !== openRequestRef.current) return false;
      if (useDraft) {
        if (!await restoreRecovery('draft', previous, true)) return false;
        setRestoredSavedVersion(record);
        return true;
      }
    }
    const session: StageRecoverySession = { identity, sourceRaw: raw, checkpoint: !!options.checkpoint, storageScope: recoverySessionScope(scope, identity) };
    setRestoredSavedVersion(null);
    setRecoveryNotice(null);
    setUnfinishedEdits(null);
    setSavedPreviewOpen(false);
    recoverySession.current = session;
    if (session.checkpoint) {
      const result = writeOriginalCheckpoint(raw, record.title, identity, session.storageScope);
      setRecoveryWarning(result.ok ? '' : `Original source could not be protected: ${result.error} Download the source before closing.`);
    }
    replaceStage(configToEditorStage(migration.record), { undoable: options.undoable ?? !options.initial, clean: options.clean ?? true, message: options.message });
    setMigrationDiagnostics(migration.diagnostics);
    setRejectedSource(null);
    setDraftReady(true);
    refreshRecoverySources();
    return true;
  };

  const applyAssistantStage = async (next: EditorStage, target: StageAuthoringTarget): Promise<boolean> => {
    if (target === 'create' && !(await confirmIfDirty())) return false;
    const now = new Date().toISOString();
    if (target === 'create') {
      if (!(await openRecord(editorStageToRecord(next), { locator: 'Reviewed Buddy proposal', clean: false }))) return false;
    } else {
      replaceStage({ ...next, createdAt: stage.createdAt, updatedAt: now }, { undoable: true, clean: false });
    }
    setMessage('Reviewed Buddy proposal applied. Nothing was saved, exported, published or run.');
    if (target === 'create') {
      setLocalStage(null);
      setRemoteStage(null);
      setGuestLocalStageId(null);
    } else if (target === 'selection') {
      setSelectedIds(assistantSelectedIds);
      setSelectedId(assistantSelectedIds[assistantSelectedIds.length - 1] || null);
      setInspectorTab(assistantSelectedIds.length ? 'object' : 'empty');
    }
    return true;
  };

  const confirmIfDirty = async (): Promise<boolean> => {
    if (!dirty) return true;
    const backupFailed = !persistRecovery();
    return new Promise(resolve => {
      leaveAnswer.current?.(false);
      leaveAnswer.current = resolve;
      setLeavePrompt({ backupFailed });
    });
  };

  const finishDeparture = (leave: boolean) => {
    leaveAnswer.current?.(leave);
    leaveAnswer.current = null;
    setLeavePrompt(null);
  };
  useEffect(() => () => { leaveAnswer.current?.(false); }, []);
  const releaseDeparture = useStageBuilderDeparture(dirty, confirmIfDirty);

  const handleSelectionChange = (ids: string[]) => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    const existing = ids.filter((id) => stage.objects.some((object) => object.id === id));
    setSelectedGroupId(null);
    setSelectedIds(existing);
    setSelectedId(existing[existing.length - 1] || null);
    setInspectorTab(existing.length ? 'object' : 'empty');
  };

  const handleSelect = (id: string | null) => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    setSelectedGroupId(null);
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
    if (id) {
      setInspectorTab('object');
    } else {
      // Empty-click deselect: keep deliberately-opened tabs (Validation, Settings)
      // sticky, but dismiss viewport-coupled tabs (object/stage/empty).
      setInspectorTab((current) => (current === 'validation' || current === 'settings' ? current : 'empty'));
    }
  };

  const handleSelectGroup = (id: string | null) => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    const group = id ? stage.metadata.groups.find((item) => item.id === id) : null;
    setSelectedGroupId(group ? group.id : null);
    setSelectedId(null);
    setSelectedIds([]);
    setInspectorTab('empty');
  };

  const handleOpenStageSettings = () => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
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

  const floorSelectionIds = new Set(descendantIdsFor(stage.objects, assistantSelectedIds));
  const floorSelection = stage.objects.filter(object => floorSelectionIds.has(object.id));
  const canPlaceOnFloor = !placingOnFloor && floorSelection.some(hasFloorGeometry) && !floorSelection.some(object => object.locked);
  const placeSelectionOnFloor = async () => {
    const scene = sceneHandleRef.current;
    if (!scene || !canPlaceOnFloor) return;
    const source = stage;
    setPlacingOnFloor(true);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
    try {
      const placed = await placeObjectsOnFloor(floorSelection, scene.measureLowestPoint);
      if (sceneHandleRef.current !== scene) return;
      if (latestStageRef.current !== source || latestFloorSelectionRef.current !== floorSelectionKey) {
        setMessage('The stage or selection changed while measuring. Try Place on floor again.');
        return;
      }
      updateObjects(placed);
      setMessage(placed === floorSelection ? 'The selection is already on the floor.' : 'Selection placed on the floor.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not place the selection on the floor.');
    } finally {
      setPlacingOnFloor(false);
    }
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
    const result = copyHierarchySelection(stage, { objectIds: ids });
    if (result.stage === stage) return;
    commitStage(() => result.stage, { selectIds: result.selectedIds, message: 'Duplicated selection.' });
  };
  const duplicateGroup = (groupId: string) => {
    const result = copyHierarchySelection(stage, { groupId });
    if (result.stage === stage) return;
    commitStage(() => result.stage, { selectGroupId: result.groupId, message: 'Duplicated group and its members.' });
  };
  const duplicateSelected = () => selectedGroup ? duplicateGroup(selectedGroup.id) : duplicateObjects(selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []));

  const beginPlacement = (next: PendingPlacement) => {
    setLookThroughCameraId(null);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
    setPlacementValid(null);
    setPlacement(next);
    if (!desktopPanels) setLeftPanelVisible(false);
  };

  const placeAt = (position: Vec3) => {
    if (!placement || !placementFitsStage(placement.objects, position, stage.floor.dimensions)) return;
    const { item, title } = placement;
    const placed = placement.objects.map(object => translateObject(object, position));
    const ids = placed.map(object => object.id);
    const kind = placed[0].kind;
    commitStage(current => {
      if (item?.type === 'prefab') {
        const now = new Date().toISOString();
        const group = { id: placed[0].groupId!, name: title, objectIds: ids, createdAt: now, updatedAt: now };
        return { ...current, objects: [...current.objects, ...placed], metadata: { ...current.metadata, groups: [...current.metadata.groups, group] } };
      }
      const existing = kind === 'fossbot' || kind === 'camera' ? current.objects.filter(object => object.kind !== kind) : current.objects;
      return { ...current, objects: [...existing, ...placed] };
    }, { selectIds: ids, message: `${title} placed.` });
    if (item) rememberRecentItem(item);
    setPlacement(null);
  };

  const addObject = (kind: StageSemanticKind) => {
    if (kind === 'line') {
      handleSelect(null);
      setLookThroughCameraId(null);
      if (!desktopPanels) setLeftPanelVisible(false);
      setLineOperation({ mode: 'edit', pathId: null });
      setMessage('Click the floor to add points. Drag squares to move them or diamonds to adjust rounding. Escape finishes editing.');
      rememberRecentItem({ type: 'object', id: kind });
      return;
    }
    if (kind === 'floor') {
      handleOpenStageSettings();
      setMessage('Floor settings are edited in the Stage inspector.');
      return;
    }
    const id = makeLocalStageId();
    const object = createCatalogObject(kind, id, [0, 0, 0]);
    if (!object) return;
    const labelParent = kind === 'label' && canAttachLabelTo(selectedObject) ? selectedObject : null;
    const item: LibraryItem = { type: 'object', id: kind };
    if (labelParent && object.kind === 'text') {
      setPlacement(null);
      const label = { ...object, name: `${labelParent.name} label`, position: 'position' in labelParent ? labelParent.position : object.position, onFloor: false, parentId: labelParent.id, attachment: defaultLabelAttachment(labelParent) };
      commitStage(current => ({ ...current, objects: [...current.objects, label] }), { selectIds: [id], message: `Label attached to ${labelParent.name}.` });
      rememberRecentItem(item);
      return;
    }
    const [x, , z] = objectPosition(object);
    beginPlacement({ objects: [translateObject(object, [-x, 0, -z])], title: displayObjectType(object), item });
  };

  const appendLinePoint = (point: [number, number]) => {
    if (lineOperation.mode !== 'edit') return;
    const existing = lineOperation.pathId ? stage.objects.find(object => object.id === lineOperation.pathId && object.kind === 'line') as EditorLineObject | undefined : undefined;
    if (existing?.locked) return;
    const insertion = existing ? insertDrawnLinePoint(existing, lineOperation.pointIndex, point) : null;
    const next: EditorLineObject = insertion ? insertion.line
      : { id: makeLocalStageId(), kind: 'line', semanticKind: 'line', name: 'line path', curveVersion: 1, points: [point], corners: [null], width: 0.03, color: 'black' };
    commitStage(current => ({ ...current, objects: existing ? current.objects.map(object => object.id === next.id ? next : object) : [...current.objects, next] }), { selectIds: [next.id] });
    setLineOperation({ mode: 'edit', pathId: next.id, pointIndex: insertion?.pointIndex ?? 0 });
  };
  const changeLineOperation = (operation: LineOperation) => {
    setPlacement(null);
    setLineOperation(operation);
    setObjectPreview(null);
    setAppearancePreview(null);
    if (operation.mode !== 'select' && operation.pathId) {
      setSelectedId(operation.pathId); setSelectedIds([operation.pathId]); setSelectedGroupId(null);
    }
  };

  const addPrefab = (prefab: StageBuilderPrefab) => {
    const delta = prefabInsertionOffset(prefab);
    const groupId = makeLocalStageId();
    const copies = prefab.objects.map((object) => {
      const template = object.kind === 'line' && object.curveVersion === undefined ? { ...object, curveVersion: 1 as const, corners: sharpLineCorners(object.points) } : object;
      const copy = translateObject(cloneStage(template), delta) as EditorStageObject;
      return { ...copy, id: makeLocalStageId(), groupId, prefabSourceId: prefab.id } as EditorStageObject;
    });
    beginPlacement({ objects: copies, title: prefab.title, item: { type: 'prefab', id: prefab.id } });
  };

  const handleStageChange = (next: EditorStage) => commitStage(() => next);

  const handleNew = async () => {
    if (!(await confirmIfDirty())) return;
    const next = emptyEditorStage();
    if (!(await openRecord(editorStageToRecord(next), { locator: 'New stage', undoable: false, message: 'New blank stage created.' }))) return;
    setLocalStage(null);
    setRemoteStage(null);
    setGuestLocalStageId(null);
  };

  const handleDemo = async () => {
    if (!(await confirmIfDirty())) return;
    if (!(await openRecord(editorStageToRecord(createDemoEditorStage()), { locator: 'Built-in demo', clean: false, message: 'Demo stage loaded.' }))) return;
    setLocalStage(null);
    setRemoteStage(null);
    setGuestLocalStageId(null);
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
      beginPlacement({ objects: [object], title: object.name });
      setMessage(`${file.name} imported and fit to 0.5 m. Check its scale after placement.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Custom object import failed.');
    } finally {
      if (customObjectInputRef.current) customObjectInputRef.current.value = '';
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    if (!(await confirmIfDirty())) {
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }
    try {
      const raw = await file.text();
      let record;
      try { record = stageRecordFromImportedJson(JSON.parse(raw)); }
      catch (error) { await rejectStageSource(raw, file.name, error); throw error; }
      if (!(await openRecord(record, { raw, locator: file.name, checkpoint: true, message: 'Imported stage JSON.' }))) return;
      setLocalStage(null);
      setRemoteStage(null);
      setGuestLocalStageId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleProviderConnect = async () => {
    if (!token || isGuest) {
      setProviderError('Guest sessions cannot connect GitHub.');
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

  const handleCreateBootstrapLinks = async (slug: string, visibility: 'public' | 'private') => {
    if (!token || isGuest) throw new Error('Guest sessions cannot create GitHub setup links.');
    return getGitHubBootstrapLinks(token, slug, visibility);
  };

  const handleDeleteStage = async () => {
    if (localStageSaving || providerSaving || marketplacePublishing) return;
    const target = isGuest && guestLocalStageId
      ? { source: 'browser' as const, id: guestLocalStageId, title: stage.title }
      : localStage ? { source: 'account' as const, id: localStage.id, title: localStage.title } : null;
    if (target && await deleteStage(target)) {
      releaseDeparture();
      navigate('/dashboard', { replace: true });
    }
  };

  const handleLocalSave = async (): Promise<boolean> => {
    const savedSession = recoverySession.current;
    if (isGuest) {
      setLocalStageSaving(true);
      try {
        const record = editorStageToRecord(stage);
        const existing = guestLocalStageId ? localStageRepository.get(guestLocalStageId, scope) : undefined;
        const saved = existing
          ? localStageRepository.save({ ...record, id: existing.id, createdAt: existing.createdAt }, scope)
          : localStageRepository.create(record, scope);
        setGuestLocalStageId(saved.id);
        setLastExportFingerprint(stageFingerprint(stage));
        setSaveStatus('Saved in this browser');
        releaseSavedRecovery(savedSession, stage);
        if (savedSession && recoverySession.current === savedSession) { carryLibraryItemsTo(`Browser stage ${saved.id} revision ${saved.updatedAt}`); savedSession.checkpoint = false; savedSession.identity.sourceLocator = `Browser stage ${saved.id} revision ${saved.updatedAt}`; savedSession.sourceRaw = JSON.stringify(saved); }
        setMessage('Saved in this browser.');
        return true;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Local stage save failed.');
        return false;
      } finally {
        setLocalStageSaving(false);
      }
    }
    if (!token) {
      setMessage('Sign in before saving a stage to your account.');
      return false;
    }
    // A stage without a preview (imported, migrated, or seeded) must still be
    // able to capture one: only short-circuit when there is an existing image.
    if (localStage && !localStageHasChanges && localStage.previewUrl) {
      setMessage(`No changes to save. ${localStage.title} is already at v${localStage.revision}.`);
      return true;
    }
    setLocalStageSaving(true);
    try {
      const record = editorStageToRecord(stage);
      // Regenerate the low-res stage preview on every save. The capture falls
      // back to null when the viewport is hidden (mobile drawers) so the save
      // still succeeds with the previous preview.
      const previewDataUrl = sceneHandleRef.current?.captureStagePreview() ?? null;
      const saved = localStage
        ? await updateLocalStage(token, localStage, record, previewDataUrl)
        : await createLocalStage(token, record, previewDataUrl);
      setLocalStage(saved);
      setRemoteStage(null);
      setLastExportFingerprint(stageFingerprint(stage));
      setSaveStatus('Saved to account');
      releaseSavedRecovery(savedSession, stage);
      if (savedSession && recoverySession.current === savedSession) { carryLibraryItemsTo(`Account stage ${saved.id} revision ${saved.revision}`); savedSession.checkpoint = false; savedSession.identity.sourceLocator = `Account stage ${saved.id} revision ${saved.revision}`; savedSession.sourceRaw = JSON.stringify(saved.record); }
      // Tell the Stages panel to refetch even if it already mounted while this
      // save was in flight.
      invalidateLocalStages();
      setMessage(`Saved to your account: ${saved.title} · v${saved.revision}`);
      if (openLocalStageOpen) void refreshLocalStageList();
      return true;
    } catch (error) {
      if (error instanceof LocalStageRequestError && error.code === 'revision_conflict') {
        setMessage(`${error.message} Current revision: v${error.currentRevision || '?'}.`);
      } else {
        setMessage(error instanceof Error ? error.message : 'Local stage save failed.');
      }
      return false;
    } finally {
      setLocalStageSaving(false);
    }
  };

  const refreshLocalStageList = async () => {
    if (isGuest) {
      try {
        setGuestLocalStages(localStageRepository.list(scope));
        setGuestOpenLocalOpen(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not read browser-saved stages.');
      }
      return;
    }
    if (!token) {
      setLocalStagesError('Sign in before opening stages from your account.');
      return;
    }
    setLocalStagesLoading(true);
    setLocalStagesError('');
    try {
      setLocalStages(await listLocalStages(token));
    } catch (error) {
      setLocalStagesError(error instanceof Error ? error.message : 'Could not load your stages.');
    } finally {
      setLocalStagesLoading(false);
    }
  };

  const handleGuestOpenLocalStage = async (item: LocalStageRecord) => {
    if (!(await confirmIfDirty())) return;
    try {
      if (!(await openRecord(item, { locator: `Browser stage ${item.id} revision ${item.updatedAt}`, message: 'Opened stage from this browser.' }))) return;
      setGuestLocalStageId(item.id);
      setLocalStage(null);
      setRemoteStage(null);
      setGuestOpenLocalOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open the local stage.');
    }
  };

  const handleOpenLocalStage = async (item: LocalStageSummary) => {
    if (isGuest || !token || !(await confirmIfDirty())) return;
    setLocalStagesLoading(true);
    setLocalStagesError('');
    try {
      const loaded = await loadLocalStage(token, item.id);
      if (!(await openRecord(loaded.record, { locator: `Account stage ${loaded.id} revision ${loaded.revision}`, message: 'Opened stage from your account.' }))) return;
      setLocalStage(loaded);
      setRemoteStage(null);
      setOpenLocalStageOpen(false);
    } catch (error) {
      setLocalStagesError(error instanceof Error ? error.message : 'Could not open this stage.');
    } finally {
      setLocalStagesLoading(false);
    }
  };

  const handleProviderSave = async ({ slug, commitMessage, visibility }: SaveToProviderValues): Promise<boolean> => {
    const savedSession = recoverySession.current;
    if (!token || isGuest) {
      setProviderError('Sign in before saving to GitHub.');
      setProviderErrorCode('not_connected');
      return false;
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
        : await createStageOnProvider(token, { record, slug, commitMessage, visibility });
      setRemoteStage(saved);
      setLocalStage(null);
      if (stageListUser) {
        invalidateUserStages(stageListUser);
        await refreshUserStages(stageListUser, token, { force: true });
      }
      setBootstrapRepoName(null);
      setLastExportFingerprint(stageFingerprint(stage));
      setSaveStatus('Saved to GitHub');
      releaseSavedRecovery(savedSession, stage);
      if (savedSession && recoverySession.current === savedSession) { carryLibraryItemsTo(`GitHub ${saved.repoOwner}/${saved.repoName} @ ${saved.commitSha}`); savedSession.checkpoint = false; savedSession.identity.sourceLocator = `GitHub ${saved.repoOwner}/${saved.repoName} @ ${saved.commitSha}`; }
      setSaveProviderOpen(false);
      setProviderErrorCode(null);
      setMessage(`Saved to GitHub: ${saved.repoOwner}/${saved.repoName}`);
      refreshProviderStatus({ force: true });
      return true;
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
          refreshProviderStatus({ force: true });
        } else if (error.code === 'installation_scope_invalid') {
          setProviderError(`${error.message} Reinstall with selected repositories, then refresh status.`);
          refreshProviderStatus({ force: true });
        } else {
          setProviderError(error.message);
        }
      } else {
        setProviderErrorCode(null);
        setProviderError(error instanceof Error ? error.message : 'Save to GitHub failed.');
      }
      return false;
    } finally {
      setProviderSaving(false);
    }
  };

  const handlePublishMarketplace = async ({ title, description, tags, previewDataUrl, sharingLicense, commitMessage }: PublishMarketplaceValues) => {
    if (!marketplaceEnabled || isGuest) return;
    if (!token) {
      setMarketplaceError('Sign in before publishing to the marketplace.');
      return;
    }
    if (!localStage && !remoteStage) {
      setMarketplaceError('Save this stage to your account or GitHub before publishing.');
      return;
    }
    if (localStage ? localStageHasChanges : dirty) {
      setMarketplaceError('Save the latest editor changes before publishing.');
      return;
    }
    setMarketplacePublishing(true);
    setMarketplaceError('');
    setMarketplaceResult(null);
    setLocalPublicationRequest(null);
    try {
      if (localStage) {
        const response = await publishLocalStage(token, localStage, { title, description, tags, previewDataUrl, sharingLicense });
        setLocalPublicationRequest(response.submission);
        setLocalStage(await loadLocalStage(token, localStage.id));
        setMessage(`Publication review requested for ${localStage.title}.`);
        return;
      }
      const result = await publishStageToMarketplace(token, {
        repoOwner: remoteStage!.repoOwner,
        repoName: remoteStage!.repoName,
        title,
        description,
        tags,
        previewDataUrl,
        sharingLicense,
        commitMessage,
      });
      setMarketplaceResult(result);
      const sourceOwner = remoteStage!.repoOwner;
      const sourceName = remoteStage!.repoName;
      setMarketplaceStatus({
        repoOwner: sourceOwner,
        repoName: sourceName,
        entryPath: result.entryPath,
        entry: result.entry,
        lifecycle: {
          state: 'published_current',
          message: 'Your changes were submitted for marketplace review.',
          publishedCommitSha: result.entry.commitSha,
          sourceCommitSha: result.entry.commitSha,
        },
        pullRequest: result.pullRequest || (result.pullRequestUrl ? {
          number: result.pullRequestNumber,
          url: result.pullRequestUrl,
          state: result.pullRequestState || 'open',
        } : null),
        rawBaseUrl: result.rawBaseUrl,
      });
      marketplaceStatusCacheRef.current = { key: `${sourceOwner}/${sourceName}`, checkedAt: Date.now() };
      invalidateMarketplaceFirstPage();
      if (stageListUser) invalidateMyMarketplaceStages(stageListUser);
      await refreshMarketplaceFirstPage(token, { force: true });
      if (stageListUser) await refreshMyMarketplaceStages(stageListUser, token, { force: true });
      setMessage(`Marketplace PR created for ${remoteStage!.repoOwner}/${remoteStage!.repoName}.`);
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
    if (!marketplaceEnabled) return;
    setMarketplaceError('');
    setMarketplaceResult(null);
    setLocalPublicationRequest(null);
    setPublishMarketplaceOpen(true);
  };

  const refreshProviderStageList = async ({ force = false }: RefreshCacheOptions = {}) => {
    if (isGuest) {
      setProviderListError('Guest sessions cannot open GitHub stages.');
      setProviderStages([]);
      return;
    }
    if (!token || !stageListUser) {
      setProviderListError('Sign in before opening from GitHub.');
      setProviderListWarning(false);
      setProviderStages([]);
      return;
    }
    await refreshUserStages(stageListUser, token, { force });
  };

  const handleProviderOpenDialog = () => {
    if (isGuest) {
      setMessage('Guest sessions cannot open GitHub stages.');
      return;
    }
    setOpenProviderOpen(true);
    refreshProviderStageList();
  };

  const handleOpenProviderStage = async (item: ProviderStageListItem) => {
    if (!token) return;
    if (!(await confirmIfDirty())) return;
    setProviderListLoading(true);
    setProviderListError('');
    setProviderListWarning(false);
    try {
      const loaded = await loadStageFromProvider(token, item.repoOwner, item.repoName);
      if (!(await openRecord(loaded.record, { locator: `GitHub ${loaded.repoOwner}/${loaded.repoName} @ ${loaded.commitSha}`, checkpoint: true, message: 'Opened stage from GitHub.' }))) return;
      setRemoteStage({
        repoOwner: loaded.repoOwner,
        repoName: loaded.repoName,
        repoUrl: loaded.repoUrl,
        commitSha: loaded.commitSha,
        stageJsonSha: loaded.stageJsonSha,
        rawBaseUrl: loaded.rawBaseUrl,
        private: loaded.private,
        visibility: loaded.visibility,
      });
      setLocalStage(null);
      setOpenProviderOpen(false);
    } catch (error) {
      setProviderListError(error instanceof Error ? error.message : 'Could not open GitHub stage.');
      setProviderListWarning(false);
    } finally {
      setProviderListLoading(false);
    }
  };

  const handleExport = () => {
    downloadStageJson(editorStageToRecord(stage));
    setMessage('Stage JSON download started. Recovery is retained until a confirmed save or explicit discard.');
  };

  const handleRunTest = () => {
    if (dirty) persistRecovery();
    const blocking = blockingValidationResults(validationResults);
    if (blocking.length) {
      setInspectorTab('validation');
      setMessage(`Fix ${blocking.length} validation error${blocking.length === 1 ? '' : 's'} before running the test simulation.`);
      return;
    }
    const handoffId = writeStageBuilderRunHandoff(editorStageToRecord(stage), undefined, { collisionWireVisible, stageAssetBaseUrl: remoteStage?.rawBaseUrl });
    if (!handoffId) {
      setMessage('Run Test could not store this stage locally. Your work and recovery drafts are preserved. Download stage JSON to keep a copy, then retry.');
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
    navigate('/stages?tab=mine');
  };

  const handleOpenSettings = () => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('settings');
    setRightPanelVisible(true);
  };

  const handleOpenPreviewSettings = () => {
    setPlacement(null);
    setLineOperation({ mode: 'select' });
    setObjectPreview(null);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedGroupId(null);
    setInspectorTab('previewSettings');
    setRightPanelVisible(true);
  };

  const restoreHistoryStage = (restored: EditorStage) => {
    setPlacement(null);
    const operation = reconcileLineOperation(lineOperation, restored.objects);
    const editingId = operation.mode === 'select' ? null : operation.pathId;
    setStage(normalizeCameraMetadata(restored));
    setLineOperation(operation);
    setObjectPreview(null);
    setSelectedId(editingId);
    setSelectedIds(editingId ? [editingId] : []);
    setSelectedGroupId(null);
    bumpHistory();
  };

  const undo = () => {
    const { history, stage: previous } = undoStageHistory(historyRef.current, stage);
    historyRef.current = history;
    if (previous) restoreHistoryStage(previous);
  };

  const redo = () => {
    const { history, stage: next } = redoStageHistory(historyRef.current, stage);
    historyRef.current = history;
    if (next) restoreHistoryStage(next);
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

  const handleHierarchyDrop = (source: StageHierarchyRow, target: HierarchyDrop, movingIds?: string[]) => {
    if (target.kind !== 'root' && source.kind === target.kind && source.id === target.id) return;
    commitStage((current) => {
      const moving = source.kind === 'object' ? current.objects.find(object => object.id === source.id) : null;
      const parent = target.kind === 'object' ? current.objects.find(object => object.id === target.id) : null;
      if (moving?.kind === 'text' && target.position === 'inside' && parent && canAttachLabelTo(parent)) {
        return {
          ...current,
          objects: current.objects.map(object => object.id === moving.id ? {
            ...moving, parentId: parent.id, groupId: undefined, onFloor: false,
            attachment: moving.attachment?.parentId === parent.id ? moving.attachment : defaultLabelAttachment(parent),
          } as EditorStageObject : object),
          metadata: { ...current.metadata,
            groups: current.metadata.groups.map(group => ({ ...group, objectIds: group.objectIds.filter(id => id !== moving.id) })),
            folders: current.metadata.folders?.map(folder => ({ ...folder, children: folder.children.filter(row => row.kind !== 'object' || row.id !== moving.id) })),
          },
        };
      }
      return moveHierarchyRow(current, source, target, movingIds);
    });
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

  const restoreRecovery = async (kind: 'draft' | 'original', item?: RecentStageDraft, keepDestination = false) => {
    try {
      const sources = item ? discoverStageRecovery(item.scope) : refreshRecoverySources();
      const selected = sources[kind];
      if (!selected?.value) return false;
      const raw = kind === 'original' ? sources.original!.value!.sourceRaw : JSON.stringify(sources.draft!.value!.stageRecord);
      const record = kind === 'original' ? stageRecordFromImportedJson(JSON.parse(raw)) : sources.draft!.value!.stageRecord;
      const migration = upgradeStageRecord(record);
      const savedIdentity = selected.value;
      const identity = savedIdentity.recoveryId && savedIdentity.sourceFingerprint
        ? { recoveryId: savedIdentity.recoveryId, sourceFingerprint: savedIdentity.sourceFingerprint, sourceLocator: savedIdentity.sourceLocator || 'Browser recovery', upgradeState: savedIdentity.upgradeState || 'unchanged' } as StageRecoverySession['identity']
        : await createRecoveryIdentity(raw, 'Legacy recovery draft', migration.upgraded ? 'upgraded' : 'unchanged');
      if (kind === 'draft' && !savedIdentity.recoveryId && !adoptLegacyDraft(sources.draft!, identity)) throw new Error('The draft changed or could not be updated. Its existing bytes are preserved.');
      const original = sources.original?.value;
      recoverySession.current = { identity, sourceRaw: original && sameRecoverySource(original, identity) ? original.sourceRaw : raw, checkpoint: !!original && sameRecoverySource(original, identity), storageScope: item?.scope ?? recoverySession.current?.storageScope ?? String(scope) };
      replaceStage(configToEditorStage(migration.record), { undoable: false, clean: kind === 'original' });
      setRestoredSavedVersion(null);
      setUnfinishedEdits(null);
      setSavedPreviewOpen(false);
      setRecoveryNotice(kind === 'draft' ? 'restored' : null);
      if (kind === 'original') setMessage('Opened original source. Later edits have not been recovered.');
      if (kind === 'draft') setLastExportFingerprint('');
      setMigrationDiagnostics(migration.diagnostics);
      setRecoveryOpen(false);
      setDraftReady(true);
      if (!keepDestination) { setLocalStage(null); setRemoteStage(null); setGuestLocalStageId(null); }
      setRecoveryWarning('');
      refreshRecoverySources();
      return true;
    } catch (error) { setRecoveryWarning(error instanceof Error ? error.message : String(error)); return false; }
  };

  const returnToUnfinishedEdits = async () => {
    if (!unfinishedEdits) return;
    try {
      if (!discoverStageRecovery(unfinishedEdits.scope).draft?.value) {
        setRecoveryWarning('Your unfinished edits could not be found in this browser. Your current stage is still open.');
        return;
      }
      if (dirty && !persistRecovery()) return;
      const savedVersion = restoredSavedVersion;
      if (await restoreRecovery('draft', unfinishedEdits, true)) setRestoredSavedVersion(savedVersion);
    } catch (error) { setRecoveryWarning(error instanceof Error ? error.message : String(error)); }
  };

  const resumeRecentDraft = async (item: RecentStageDraft) => {
    try {
      const locator = item.sources.draft?.value?.sourceLocator || '';
      const account = /^Account stage (\d+) revision /.exec(locator);
      if (account && token && !isGuest) {
        const saved = await loadLocalStage(token, Number(account[1]));
        if (await openRecord(saved.record, { locator: `Account stage ${saved.id} revision ${saved.revision}`, initial: true, recoveryItem: item })) {
          setLocalStage(saved); setRemoteStage(null);
        }
      } else if (locator.startsWith('GitHub ') && token && !isGuest) {
        const match = /^GitHub ([^/]+)\/(.+) @ /.exec(locator);
        if (!match) throw new Error('The saved repository could not be identified.');
        const saved = await loadStageFromProvider(token, match[1], match[2]);
        if (await openRecord(saved.record, { locator: `GitHub ${saved.repoOwner}/${saved.repoName} @ ${saved.commitSha}`, initial: true, recoveryItem: item })) {
          setRemoteStage(saved); setLocalStage(null);
        }
      } else if (locator.startsWith('Browser stage ')) {
        const id = recoverySourceKey(locator).slice('Browser stage '.length);
        const saved = localStageRepository.get(id, scope);
        if (saved) {
          if (await openRecord(saved, { locator: `Browser stage ${saved.id} revision ${saved.updatedAt}`, initial: true, recoveryItem: item })) setGuestLocalStageId(id);
        } else await restoreRecovery('draft', item);
      } else {
        await restoreRecovery('draft', item);
      }
    } catch (error) {
      setRecoveryWarning(`Could not open your previous work: ${String(error)}. Your draft is still available in Recent drafts.`);
      setRecentDrafts(listStageRecovery(scope));
      setRecoveryOpen(true);
    }
  };

  useEffect(() => {
    if (savedPreviewOpen || deletingStage) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'escape' && placement) { setPlacement(null); return; }
      if (!prefs.keyboardShortcutsEnabled) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); return; }
      if (ctrl && (key === 'y' || (event.shiftKey && key === 'z'))) { event.preventDefault(); redo(); return; }
      if (ctrl && key === 'd') { event.preventDefault(); duplicateSelected(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return; }
      if (key === 'w') { setPlacement(null); setLineOperation({ mode: 'select' }); setTransformMode('translate'); }
      if (key === 'e') { setPlacement(null); setLineOperation({ mode: 'select' }); setTransformMode('rotate'); }
      if (key === 'r') { setPlacement(null); setLineOperation({ mode: 'select' }); setTransformMode('scale'); }
      if (key === 'f') setFocusRequestNonce((value) => value + 1);
      if (key === 'g') groupSelected();
      if (key === 'escape') {
        if (lineOperation.mode !== 'select') { setLineOperation({ mode: 'select' }); return; }
        if (lookThroughCameraId) setLookThroughCameraId(null);
        else handleSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [savedPreviewOpen, prefs.keyboardShortcutsEnabled, placement, deletingStage, stage, selectedId, selectedIds, selectedGroupId, snapSettings, historyVersion, lookThroughCameraId, lineOperation]);

  const leftPanel = (
    <EditorLeftPanel
      stageAssetBaseUrl={remoteStage?.rawBaseUrl}
      tab={leftPanelTab}
      onTabChange={setLeftPanelTab}
      stage={stage}
      selectedId={selectedId}
      selectedIds={selectedIds}
      selectedGroupId={selectedGroupId}
      prefabs={prefabs}
      recentItems={recentLibraryItems}
      placingItem={placement?.item}
      favouriteItems={favouriteItems}
      onToggleFavourite={toggleFavourite}
      onAddKind={addObject}
      onAddPrefab={addPrefab}
      onImportObject={() => customObjectInputRef.current?.click()}
      onSelectObject={handleSelect}
      onSelectGroup={handleSelectGroup}
      onSelectionChange={handleSelectionChange}
      onObjectChange={updateObject}
      onDuplicateObjects={duplicateObjects}
      onDuplicateGroup={duplicateGroup}
      onDeleteObjects={deleteObjects}
      onHierarchyDrop={handleHierarchyDrop}
      onCreateFolder={rows => {
        const id = makeLocalStageId();
        commitStage(current => createHierarchyFolder(current, id, rows));
        return id;
      }}
      onRenameFolder={(id, name) => commitStage(current => ({ ...current, metadata: { ...current.metadata,
        folders: current.metadata.folders?.map(folder => folder.id === id ? { ...folder, name } : folder),
      } }))}
      onDeleteFolder={id => commitStage(current => deleteHierarchyFolder(current, id))}
      onRemoveFromFolder={rows => commitStage(current => placeHierarchyRows(current, rows, null))}
      onGroupRename={renameGroup}
      onPatchObjects={patchObjects}
      onTogglePanel={toggleLeftPanel}
    />
  );
  const rightPanel = (
    <EditorRightInspector
      tab={inspectorTab}
      onTabChange={setInspectorTab}
      stage={stage}
      selectedObject={selectedObject}
      selectedCount={selectedCount}
      validationResults={validationResults}
      prefs={prefs}
      onStageChange={handleStageChange}
      lineOperation={lineOperation}
      onLineOperationChange={changeLineOperation}
      onLinePreview={setObjectPreview}
      onDeleteLine={(id) => {
        deleteObjects([id]);
        setLeftPanelVisible(true);
        setLeftPanelTab('scene');
        requestAnimationFrame(() => (document.querySelector('[aria-label="Search hierarchy"]') as HTMLElement | null)?.focus());
      }}
      onObjectChange={updateObject}
      onObjectPreview={setObjectPreview}
      onStagePreview={setAppearancePreview}
      onFocusObjects={(ids) => { handleSelectionChange(ids); setFocusRequestNonce(value => value + 1); setInspectorTab('object'); }}
      onLookThroughCamera={requestLookThroughCamera}
      onToggleValidationOverride={toggleValidationOverride}
      onPrefsChange={setPref}
      onResetPrefs={() => setPrefs(defaultStageBuilderPreferences)}
      onTogglePanel={toggleRightPanel}
    />
  );

  return (
    <EditorThemeProvider value={useMemo(() => {
      const variant = editorVariant;
      return {
        variant,
        colors: getEditorColors(variant),
        tones: getEditorTones(variant),
        type: getEditorType(variant),
        panelSx: getEditorPanelSx(variant),
        tabsSx: getEditorTabsSx(variant),
        inspectorSx: getInspectorPanelSx(variant),
      };
    }, [editorVariant])}><ThemeProvider theme={editorMuiTheme}>
      {githubDeepLinkLoad.status !== 'idle' ? (
        <GitHubStageLoadScreen
          state={githubDeepLinkLoad}
          onRetry={() => {
            if (!githubDeepLinkTarget) return;
            setGithubDeepLinkLoad({ status: 'loading', repoLabel: githubDeepLinkTarget.label, step: 'Checking GitHub connection…' });
            setGithubDeepLinkRetry((value) => value + 1);
          }}
          onBack={() => navigate('/stages?tab=mine')}
          onOpenPicker={() => {
            window.history.replaceState(window.history.state, '', window.location.pathname);
            setGithubDeepLinkLoad({ status: 'idle' });
            setOpenProviderOpen(true);
            refreshProviderStageList();
          }}
        />
      ) : (
    <Box ref={rootRef} sx={{ '--fossbot-box-border-radius': '0px', borderRadius: 0, width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: editorColors.viewport }}>
      {recoveryWarning && <Alert severity="warning" action={<><Button onClick={() => { refreshRecoverySources(); setRecoveryOpen(true); }}>Recent drafts</Button><Button onClick={() => downloadStageJson(editorStageToRecord(stage))}>Download JSON</Button></>}>{recoveryWarning}</Alert>}
      {recoveryNotice && <Alert severity="info" sx={{ '& .MuiAlert-message': { flex: 1, minWidth: 0 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600}>{recoveryNotice === 'restored' ? 'Continue where you left off' : 'You’re working from the saved version'}</Typography>
            <Typography variant="body2">{recoveryNotice === 'restored' ? 'Your latest changes haven’t been saved yet.' : 'Your unfinished edits are still here if you want to go back.'}</Typography>
          </Box>
          {recoveryNotice === 'restored' && restoredSavedVersion && <Button onClick={() => setSavedPreviewOpen(true)}>Preview saved version</Button>}
          {recoveryNotice === 'saved' && unfinishedEdits && <Button onClick={returnToUnfinishedEdits}>Return to my unfinished edits</Button>}
        </Stack>
      </Alert>}
      {savedPreviewOpen && restoredSavedVersion && <SavedStagePreview record={restoredSavedVersion} assetBaseUrl={remoteStage?.rawBaseUrl}
        onBack={() => setSavedPreviewOpen(false)} onEdit={async () => {
          if (dirty && !persistRecovery()) { setSavedPreviewOpen(false); return; }
          try {
            const draftScope = recoverySession.current?.storageScope ?? String(scope);
            const sources = discoverStageRecovery(draftScope);
            if (!sources.draft?.value) throw new Error('Your unfinished edits could not be kept. Your current stage is still open.');
            const raw = JSON.stringify(restoredSavedVersion);
            const identity = await createRecoveryIdentity(raw, recoverySession.current?.identity.sourceLocator || 'Saved version', 'unchanged');
            recoverySession.current = { identity, sourceRaw: raw, checkpoint: false, storageScope: recoverySessionScope(scope, identity) };
            replaceStage(configToEditorStage(restoredSavedVersion), { undoable: false, clean: true });
            setUnfinishedEdits({ scope: draftScope, sources });
            setSavedPreviewOpen(false);
            setRecoveryNotice('saved');
          } catch (error) { setSavedPreviewOpen(false); setRecoveryWarning(String(error)); }
        }} />}
      {migrationNotice && <Alert severity="info" onClose={() => setMigrationDiagnostics([])}>{migrationNotice}</Alert>}
      {rejectedSource && <Alert severity="error" action={<Button onClick={() => downloadStageSource(rejectedSource.raw)}>Export rejected source</Button>}>{rejectedSource.message} The current stage is unchanged. Repair the source before importing it again.</Alert>}
      <EditorTopBar
        stageName={stage.title}
        dirty={dirty}
        saveStatus={saveStatus}
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
        providerConnected={!!providerStatus?.connected}
        providerBusy={providerSaving || providerStatusLoading}
        localStageBusy={localStageSaving || deletingStage}
        marketplaceEnabled={marketplaceEnabled}
        marketplaceBusy={marketplacePublishing}
        marketplaceStatusLoading={marketplaceStatusLoading}
        marketplacePullRequest={marketplacePullRequest}
        marketplacePublishLabel={marketplacePublishLabel}
        marketplacePublishReady={marketplacePublishReady}
        onImport={() => importInputRef.current?.click()}
        onReviewRecovery={() => { refreshRecoverySources(); setRecoveryOpen(true); }}
        onSaveLocal={handleLocalSave}
        onOpenLocal={() => { if (isGuest) { void refreshLocalStageList(); return; } setOpenLocalStageOpen(true); void refreshLocalStageList(); }}
        allowCloud={!isGuest}
        onExport={handleExport}
        onRefreshGitHubStatus={() => { refreshProviderStatus(); refreshMarketplaceStatus(); }}
        onConnectProvider={handleProviderConnect}
        onSaveProvider={() => { setProviderError(''); setProviderErrorCode(null); setSaveProviderOpen(true); }}
        onOpenProvider={handleProviderOpenDialog}
        onPublishMarketplace={handleOpenMarketplaceDialog}
        onRunTest={handleRunTest}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onPlaceOnFloor={placeSelectionOnFloor}
        canPlaceOnFloor={canPlaceOnFloor}
        onDelete={deleteSelected}
        onDeleteStage={localStage || (isGuest && guestLocalStageId) ? handleDeleteStage : undefined}
        deleteStageBusy={deletingStage}
        onOpenValidation={() => { setInspectorTab('validation'); setRightPanelVisible(true); }}
        onOpenSettings={handleOpenSettings}
        onOpenStageSettings={handleOpenStageSettings}
        onOpenTestSettings={() => { setInspectorTab('testSettings'); setRightPanelVisible(true); }}
        onOpenPreviewSettings={handleOpenPreviewSettings}
        onToggleLeftPanel={toggleLeftPanel}
        onToggleRightPanel={toggleRightPanel}
      />
      <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => handleImportFile(event.target.files?.[0])} />
      <input ref={customObjectInputRef} type="file" accept=".obj,.stl,.glb,model/obj,model/stl,model/gltf-binary,text/plain,application/sla" hidden onChange={(event) => handleImportCustomObject(event.target.files?.[0])} />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {leftPanelVisible && desktopPanels && <Box sx={{ width: leftPanelWidth, flex: '0 0 auto', minHeight: 0, overflow: 'hidden' }}>{leftPanel}</Box>}
        {leftPanelVisible && desktopPanels && <PanelResizeHandle side="left" onPointerDown={beginPanelResize('left')} onDoubleClick={resetPanelWidth('left')} />}
        {leftPanelVisible && !desktopPanels && <Drawer anchor="left" open onClose={() => setLeftPanelVisible(false)} PaperProps={{ sx: { width: 'min(360px, calc(100vw - 40px))', overflow: 'hidden' } }}>{leftPanel}</Drawer>}
        {!leftPanelVisible && <EditorPanelTab side="left" label="Library" onClick={toggleLeftPanel} />}

        <Box sx={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, position: 'relative', bgcolor: editorColors.viewport }}>
          <StageBuilderScene
            ref={sceneHandleRef}
            keyboardEnabled={!savedPreviewOpen}
            objects={activeStage.objects}
            groups={activeStage.metadata.groups}
            selectedId={selectedId}
            selectedIds={selectedIds}
            selectedGroupId={selectedGroupId}
            transformMode={transformMode}
            builderMode={builderMode}
            placementObjects={placement?.objects}
            onPlaceAt={placeAt}
            onPlacementValidityChange={setPlacementValid}
            stageDimensions={activeStage.floor.dimensions}
            floorColor={activeStage.floor.color}
            skybox={activeStage.metadata.skybox}
            gridVisible={gridVisible}
            gridSize={gridSize}
            snapSettings={snapSettings}
            transformSpace={prefs.transformSpace}
            controlScheme="legacyGizmo"
            lockMode={prefs.lockMode}
            styleVariant={editorVariant}
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
            lineOperation={lineOperation}
            onLineOperationChange={changeLineOperation}
            onAppendLinePoint={appendLinePoint}
            onLinePreview={setObjectPreview}
            onLockedSelectionAttempt={() => setMessage('Selection is locked to the current object. Change Selection behavior in Settings to select through objects.')}
          />
          {livePreviewStage && (
            <Paper sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10, px: 2, py: 1, bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'warning.main', display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2, boxShadow: 6 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {t('aiAssistant.stage.previewingLive', 'Previewing proposed stage changes in Stage Builder')}
              </Typography>
              <Button size="small" variant="contained" color="success" onClick={() => window.dispatchEvent(new CustomEvent('fossbot:buddy-apply'))}>
                {t('aiAssistant.apply', 'Apply')}
              </Button>
              <Button size="small" variant="outlined" onClick={() => { setLivePreviewStage(null); setLivePreviewTarget(null); window.dispatchEvent(new CustomEvent('fossbot:buddy-live-preview-off')); }}>
                {t('aiAssistant.stage.backToBuddy', 'Back to Buddy')}
              </Button>
            </Paper>
          )}
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
            <EditorViewportToolRail
              transformMode={transformMode}
              selectedCount={selectedCount}
              canUndo={canUndo(historyRef.current)}
              sensorHelpersVisible={sensorHelpersVisible}
              collisionWireVisible={collisionWireVisible}
              canRedo={canRedo(historyRef.current)}
              lineOperation={lineOperation.mode}
              onFinishLine={() => changeLineOperation({ mode: 'select' })}
              onTransformModeChange={(mode) => { setPlacement(null); setLineOperation({ mode: 'select' }); setTransformMode(mode); }}
              onSensorHelpersToggle={() => setSensorHelpersVisible((visible) => !visible)}
              onCollisionWireToggle={() => setCollisionWireVisible((visible) => !visible)}
              onPlaceOnFloor={placeSelectionOnFloor}
              canPlaceOnFloor={canPlaceOnFloor}
              onFocusSelected={() => setFocusRequestNonce((value) => value + 1)}
              onUndo={undo}
              onRedo={redo}
              onDelete={deleteSelected}
            />
          </Box>
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
            <EditorViewportCameraGizmo currentView={lookThroughCameraId && lookThroughCamera ? 'camera' : (cameraViewRequest?.view || 'perspective')} hasActiveCamera={hasVisibleStageCamera(activeStage)} onCameraViewChange={requestCameraView} />
          </Box>
          <Box sx={{ position: 'absolute', top: 64, left: 64, right: 64, zIndex: 5, display: 'flex', justifyContent: 'center', pointerEvents: 'none', '& > *': { pointerEvents: 'auto' } }}>
            {placement && <Paper elevation={0} aria-label="Object placement" component="section" sx={{ p: 0.5, border: 1, borderColor: 'divider' }}>
              <Stack direction="row" flexWrap="wrap" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography role="status" variant="body2" sx={{ px: 0.5, overflowWrap: 'anywhere' }}>
                  {placementValid === false ? 'Move inside the stage boundary.' : `Click the floor to place ${placement.title}.`}
                </Typography>
                <Button size="small" color="error" sx={{ bgcolor: 'error.light' }} autoFocus onClick={() => setPlacement(null)}>Cancel</Button>
              </Stack>
            </Paper>}
            {!placement && !livePreviewStage && <StageLineToolbar line={selectedCount === 1 && selectedObject?.kind === 'line' ? selectedObject : undefined} operation={lineOperation} onChange={changeLineOperation} />}
          </Box>
          <Box sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
            <EditorViewportSnapControls movement={stageSnap.defaultSnapPreset} rotation={stageSnap.defaultRotationSnapPreset} lastMovement={stageSnap.lastMovementSnapPreset} onChange={setPref} />
          </Box>
          {!isGuest && <StageAuthoringAssistant stage={stage} selectedIds={assistantSelectedIds} validation={validationResults} migrationDiagnostics={migrationDiagnostics} localStageId={localStage?.id} onApply={applyAssistantStage} onPreviewStageChange={handleAssistantPreviewStageChange} />}
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

        {rightPanelVisible && desktopPanels && <PanelResizeHandle side="right" onPointerDown={beginPanelResize('right')} onDoubleClick={resetPanelWidth('right')} />}
        {!rightPanelVisible && <EditorPanelTab side="right" label="Inspector" onClick={toggleRightPanel} />}
        {rightPanelVisible && desktopPanels && <Box sx={{ width: rightPanelWidth, flex: '0 0 auto', minHeight: 0, overflow: 'hidden' }}>{rightPanel}</Box>}
        {rightPanelVisible && !desktopPanels && <Drawer anchor="right" open onClose={() => setRightPanelVisible(false)} PaperProps={{ sx: { width: 'min(400px, calc(100vw - 40px))', overflow: 'hidden' } }}>{rightPanel}</Drawer>}
      </Box>

      <Box sx={{ height: 28, pl: 1, pr: 1.25, overflowX: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, bgcolor: editorColors.topbar, color: editorColors.keycapInk, borderTop: `1px solid ${editorColors.divider}` }}>
        <Stack direction="row" spacing={1.75} alignItems="baseline" sx={{ minWidth: 0, flexShrink: 0 }}>
          <StatusItem label="Mode" value={lineOperation.mode === 'edit' ? 'Editing line' : builderMode === 'edit' ? transformMode : builderMode} tone={editorColors.accentText} />
          <StatusItem label="Selected" value={selectedStatus} tone={selectedTone} />
          <StatusItem label="Grid" value={gridVisible ? `${gridSize} m` : 'Hidden'} tone={editorColors.text} />
          <StatusItem label="GitHub" value={providerStatusValue} tone={providerStatusTone} />
          <StatusItem label="Collision" value={collisionWireVisible ? 'Wire' : 'Hidden'} tone={collisionWireVisible ? editorColors.warning : editorColors.textMuted} />
        </Stack>
        <ShortcutHint />
      </Box>

      <Dialog open={recoveryOpen} onClose={() => setRecoveryOpen(false)} maxWidth="sm" fullWidth aria-labelledby="stage-recovery-title">
        <DialogTitle id="stage-recovery-title">Recent drafts</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>Your unfinished work stays here until you save or delete it.</Typography>
            {!recentDrafts.length && <Typography>No unfinished drafts.</Typography>}
            {recentDrafts.map(item => {
              const source = item.sources.draft || item.sources.original!;
              const value = source.value;
              const title = value && ('stageRecord' in value ? value.stageRecord.title : value.title) || 'Unreadable draft';
              return <Stack key={item.scope} spacing={1}>
                <Typography variant="subtitle2">{title}</Typography>
                {value && <Typography variant="body2">{new Date(value.savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Typography>}
                {source.error && <Alert severity="warning">This copy could not be opened. Download it to keep it safe.</Alert>}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button disabled={!value} onClick={async () => { if (!await confirmIfDirty()) return; if (item.sources.draft) await resumeRecentDraft(item); else await restoreRecovery('original', item); setRecoveryOpen(false); }}>Continue editing</Button>
                  <Button onClick={() => { if (value && 'stageRecord' in value) downloadStageJson(editorStageToRecord(configToEditorStage(value.stageRecord))); else downloadStageSource(value && 'sourceRaw' in value ? value.sourceRaw : source.raw, title); }}>Download copy</Button>
                  {item.sources.draft && item.sources.original && <Button onClick={() => downloadStageSource(item.sources.original!.value?.sourceRaw || item.sources.original!.raw, `${title}-original`)}>Download original</Button>}
                  <Button color="error" onClick={async () => {
                    if (!await confirmDialog.confirm({ title: `Delete “${title}” draft?`, message: 'This deletes the browser backup. Your saved account stage is unchanged.', confirmLabel: 'Delete draft', cancelLabel: 'Keep draft', danger: true })) return;
                    for (const retained of [item.sources.draft, item.sources.original]) if (retained && !discardRecoverySource(retained)) { setRecoveryWarning('The draft changed. Please review it again.'); break; }
                    refreshRecoverySources();
                  }}>Delete draft</Button>
                </Stack>
              </Stack>;
            })}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setRecoveryOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {leavePrompt && <SaveStageBeforeLeavingDialog
        destination={isGuest ? 'in this browser' : remoteStage ? 'to GitHub' : 'to your account'}
        backupFailed={leavePrompt.backupFailed}
        onDownload={() => downloadStageJson(editorStageToRecord(stage))}
        onClose={finishDeparture}
        onSave={async () => {
          if (localStageSaving || providerSaving || deletingStage) return false;
          const session = recoverySession.current;
          const saved = remoteStage && !isGuest
            ? await handleProviderSave({ slug: remoteStage.repoName, commitMessage: '', visibility: remoteStage.private ? 'private' : 'public' })
            : await handleLocalSave();
          return saved && recoverySession.current === session && stageFingerprint(latestStageRef.current) === stageFingerprint(stage);
        }}
      />}

      <SaveToProviderDialog
        open={saveProviderOpen}
        stageTitle={stage.title}
        sourceLabel={localStage ? `local revision ${localStage.title} · v${localStage.revision}` : null}
        status={providerStatus}
        remoteStage={remoteStage}
        bootstrapRepoName={bootstrapRepoName}
        busy={providerSaving}
        error={providerError}
        errorCode={providerErrorCode}
        onClose={() => setSaveProviderOpen(false)}
        onConnect={handleProviderConnect}
        onRefreshStatus={() => refreshProviderStatus({ force: true })}
        onBeforeInstall={() => persistRecovery()}
        onOpenFromGitHub={() => { setSaveProviderOpen(false); handleProviderOpenDialog(); }}
        onCreateBootstrapLinks={handleCreateBootstrapLinks}
        onSave={handleProviderSave}
      />

      <OpenFromProviderDialog
        open={openProviderOpen}
        stages={providerStages}
        busy={providerListLoading}
        error={providerListError}
        warning={providerListWarning}
        onClose={() => setOpenProviderOpen(false)}
        onRefresh={() => refreshProviderStageList({ force: true })}
        onOpenStage={handleOpenProviderStage}
      />

      <Dialog open={guestOpenLocalOpen} onClose={() => setGuestOpenLocalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Browser-saved stages</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {!guestLocalStages.length && <Typography color="text.secondary">No browser-saved stages yet.</Typography>}
            {guestLocalStages.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1 }}><Typography fontWeight={600}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{new Date(item.updatedAt).toLocaleString()}</Typography></Box>
                  <Button size="small" variant="contained" onClick={() => void handleGuestOpenLocalStage(item)}>Open</Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setGuestOpenLocalOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <OpenLocalStageDialog
        open={openLocalStageOpen}
        stages={localStages}
        busy={localStagesLoading}
        error={localStagesError}
        onClose={() => setOpenLocalStageOpen(false)}
        onRefresh={refreshLocalStageList}
        onOpenStage={handleOpenLocalStage}
      />

      {marketplaceEnabled && <PublishToMarketplaceDialog
        open={publishMarketplaceOpen}
        stageTitle={stage.title}
        stageDescription={stage.description}
        remoteStage={remoteStage}
        localStage={localStage}
        sourceDirty={localStage ? localStageHasChanges : dirty}
        busy={marketplacePublishing}
        error={marketplaceError}
        result={marketplaceResult}
        localRequest={localPublicationRequest}
        lifecycle={marketplaceStatus?.lifecycle}
        onClose={() => setPublishMarketplaceOpen(false)}
        onSaveToGitHub={() => { setPublishMarketplaceOpen(false); setSaveProviderOpen(true); }}
        onSaveLocal={() => { setPublishMarketplaceOpen(false); void handleLocalSave(); }}
        onPublish={handlePublishMarketplace}
      />}

    </Box>
      )}
    </ThemeProvider></EditorThemeProvider>
  );
};

export default StageBuilderPage;
