import React, { useEffect, useRef } from 'react';
import { Box, Button, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import type { StageSemanticKind } from './types';
import { STAGE_OBJECT_CATALOG, catalogItem } from './stageBuilderCatalog';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { useEditorTheme, type EditorTone } from './stageBuilderEditorTheme';
import { PreviewImage } from './PreviewImage';
import { fitDisplaySizeToTile, getKindSettings, getLibraryPreviewAreaSize, getPreviewAuthoringKind, setLibraryPreviewAreaSize, usePreviewSettingsVersion } from './stageBuilderPreviewSettings';

export type StageBuilderLibraryGroup = {
  id: 'floorPaths' | 'structures' | 'robot' | 'challenge' | 'labels' | 'lighting';
  label: string;
  items: StageSemanticKind[];
};

export const STAGE_BUILDER_LIBRARY_GROUPS: StageBuilderLibraryGroup[] = [
  { id: 'robot', label: 'Mission setup', items: ['robotSpawn', 'target', 'checkpoint'] },
  { id: 'floorPaths', label: 'Paths and floor markers', items: ['line', 'baseTile', 'dangerZone', 'sensorZone', 'directionArrow'] },
  { id: 'structures', label: 'Build shapes', items: ['block', 'wall', 'ramp', 'platform', 'cylinder', 'obstacle', 'sphere'] },
  { id: 'labels', label: 'Annotations', items: ['label'] },
  { id: 'lighting', label: 'Scene setup', items: ['camera', 'light', 'audio'] },
];

export interface StageObjectLibraryProps {
  activeKind?: StageSemanticKind | null;
  activePrefabId?: string | null;
  prefabs?: StageBuilderPrefab[];
  onAddKind?: (kind: StageSemanticKind) => void;
  onAddPrefab?: (prefab: StageBuilderPrefab) => void;
  // Backward-compatible prop names used by the deprecated Build drawer.
  onSelectKind?: (kind: StageSemanticKind) => void;
  onSelectPrefab?: (prefab: StageBuilderPrefab) => void;
  onDeletePrefab?: (id: string) => void;
  onImportObject?: () => void;
}

export type PreviewKind = StageSemanticKind | 'prefab';

const STATIC_PREVIEW_KINDS = new Set<StageSemanticKind>([
  'baseTile',
  'block',
  'cylinder',
  'directionArrow',
  'line',
  'obstacle',
  'platform',
  'ramp',
  'robotSpawn',
  'sphere',
  'target',
  'wall',
]);

export function hasStaticPreviewAsset(kind: StageSemanticKind): boolean {
  return STATIC_PREVIEW_KINDS.has(kind);
}

export function staticPreviewUrl(kind: StageSemanticKind): string {
  return `${process.env.PUBLIC_URL || ''}/stage-builder/previews/preview-${kind}.png`;
}

const libraryTileSx = (editorColors: ReturnType<typeof useEditorTheme>['colors']) => ({
  width: '100%',
  minHeight: 76,
  p: 0.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  gap: 0.375,
  border: `1px solid ${editorColors.border}`,
  borderRadius: 0.75,
  bgcolor: editorColors.panelInset,
  color: editorColors.text,
  textAlign: 'left',
  transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
  '&:hover': { bgcolor: `${editorColors.textMuted}0f`, borderColor: editorColors.borderStrong },
  '&:active': { transform: 'translateY(1px)' },
  '&:hover .library-preview': { opacity: 1, transform: 'translateY(-1px)' },
  '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
});

function itemFor(kind: StageSemanticKind) {
  return STAGE_OBJECT_CATALOG.find((item) => item.id === kind);
}

function StaticPreviewAsset({ kind, width, height }: { kind: StageSemanticKind; width: number; height: number }) {
  return (
    <img
      src={staticPreviewUrl(kind)}
      width={Math.round(width)}
      height={Math.round(height)}
      alt=""
      draggable={false}
      style={{ display: 'block', objectFit: 'contain', userSelect: 'none' }}
    />
  );
}

export function PreviewShape({ kind, tone, width, height }: { kind: PreviewKind; tone: EditorTone; width?: number; height?: number }) {
  const accent = tone.accent;
  const soft = `${tone.accent}33`;

  let icon: React.ReactNode;
  if (kind === 'wall') icon = <Box sx={{ width: 44, height: 12, bgcolor: accent, opacity: 0.78, transform: 'rotate(-8deg)', boxShadow: `0 8px 0 ${soft}` }} />;
  else if (kind === 'block') icon = <Box sx={{ width: 30, height: 30, bgcolor: accent, opacity: 0.72, boxShadow: `8px 8px 0 ${soft}` }} />;
  else if (kind === 'ramp') icon = <Box sx={{ width: 42, height: 26, clipPath: 'polygon(0 100%, 100% 100%, 100% 20%)', bgcolor: accent, opacity: 0.76 }} />;
  else if (kind === 'platform') icon = <Box sx={{ width: 46, height: 10, bgcolor: accent, opacity: 0.74, boxShadow: `0 10px 0 ${soft}` }} />;
  else if (kind === 'cylinder') {
    icon = (
      <Box sx={{ position: 'relative', width: 34, height: 38 }}>
        <Box sx={{ position: 'absolute', top: 5, left: 3, width: 28, height: 13, borderRadius: '50%', border: `2px solid ${accent}`, bgcolor: soft }} />
        <Box sx={{ position: 'absolute', top: 11, left: 3, width: 28, height: 18, borderLeft: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, bgcolor: soft }} />
        <Box sx={{ position: 'absolute', bottom: 3, left: 3, width: 28, height: 13, borderRadius: '50%', border: `2px solid ${accent}`, bgcolor: soft }} />
      </Box>
    );
  } else if (kind === 'sphere') icon = <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: soft, border: `2px solid ${accent}`, boxShadow: `inset -8px -8px 0 ${accent}33` }} />;
  else if (kind === 'wedge') icon = <Box sx={{ width: 42, height: 28, clipPath: 'polygon(0 100%, 100% 100%, 100% 0)', bgcolor: soft, borderBottom: `3px solid ${accent}`, borderRight: `3px solid ${accent}` }} />;
  else if (kind === 'obstacle') icon = <Box sx={{ width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderBottom: `34px solid ${accent}`, opacity: 0.75 }} />;
  else if (kind === 'robotSpawn') icon = <Box sx={{ width: 34, height: 24, border: `2px solid ${accent}`, borderRadius: 1, display: 'grid', placeItems: 'center', color: accent, fontSize: 13, fontWeight: 900 }}>R</Box>;
  else if (kind === 'target') icon = <Box sx={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${accent}`, boxShadow: `inset 0 0 0 7px ${soft}, inset 0 0 0 13px ${accent}` }} />;
  else if (kind === 'checkpoint') icon = <Box sx={{ position: 'relative', width: 34, height: 34, borderLeft: `2px solid ${accent}` }}><Box sx={{ position: 'absolute', top: 4, left: 2, width: 24, height: 15, bgcolor: soft, border: `2px solid ${accent}` }} /></Box>;
  else if (kind === 'dangerZone') icon = <Box sx={{ width: 30, height: 30, bgcolor: soft, border: `2px solid ${accent}`, transform: 'rotate(45deg)' }} />;
  else if (kind === 'sensorZone') icon = <Box sx={{ width: 40, height: 28, border: `2px dashed ${accent}`, bgcolor: soft }} />;
  else if (kind === 'camera') {
    icon = (
      <Box component="svg" viewBox="0 0 44 34" sx={{ width: 42, height: 32 }}>
        <rect x="6" y="9" width="26" height="18" rx="3" fill={soft} stroke={accent} strokeWidth="2.4" />
        <path d="M32 14 L40 9 L40 27 L32 22 Z" fill={soft} stroke={accent} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="17" cy="18" r="5" fill={`${accent}33`} stroke={accent} strokeWidth="2.2" />
      </Box>
    );
  } else if (kind === 'audio') {
    icon = (
      <Box component="svg" viewBox="0 0 44 34" sx={{ width: 42, height: 32 }}>
        <path d="M7 14 H15 L25 7 V27 L15 20 H7 Z" fill={soft} stroke={accent} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M29 12 C32 15 32 19 29 22" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M34 8 C40 14 40 20 34 26" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" opacity="0.78" />
      </Box>
    );
  } else if (kind === 'line') {
    icon = (
      <Box component="svg" viewBox="0 0 52 34" sx={{ width: 52, height: 34 }}>
        <path d="M5 24 C15 4 30 31 47 10" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      </Box>
    );
  } else if (kind === 'directionArrow') {
    icon = (
      <Box component="svg" viewBox="0 0 52 34" sx={{ width: 52, height: 34 }}>
        <path d="M5 17 H34" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" />
        <path d="M31 6 L47 17 L31 28 Z" fill={soft} stroke={accent} strokeWidth="3" strokeLinejoin="round" />
      </Box>
    );
  } else if (kind === 'baseTile') icon = <Box sx={{ width: 38, height: 28, border: `2px solid ${accent}`, bgcolor: soft, transform: 'skewX(-12deg)' }} />;
  else if (kind === 'label') icon = <Box sx={{ color: accent, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>T</Box>;
  else if (kind === 'light') {
    icon = (
      <Box component="svg" viewBox="0 0 40 40" sx={{ width: 38, height: 38 }}>
        <g stroke={accent} strokeWidth="2.4" strokeLinecap="round">
          <line x1="20" y1="3" x2="20" y2="9" />
          <line x1="20" y1="31" x2="20" y2="37" />
          <line x1="3" y1="20" x2="9" y2="20" />
          <line x1="31" y1="20" x2="37" y2="20" />
          <line x1="8" y1="8" x2="12" y2="12" />
          <line x1="28" y1="28" x2="32" y2="32" />
          <line x1="32" y1="8" x2="28" y2="12" />
          <line x1="12" y1="28" x2="8" y2="32" />
        </g>
        <circle cx="20" cy="20" r="7" fill={`${accent}55`} stroke={accent} strokeWidth="2.4" />
      </Box>
    );
  } else if (kind === 'prefab') {
    icon = (
      <Box sx={{ width: 44, height: 34, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
        {[0, 1, 2, 3].map((item) => <Box key={item} sx={{ bgcolor: item === 0 ? accent : soft, border: `1px solid ${accent}66` }} />)}
      </Box>
    );
  } else icon = <Box sx={{ width: 28, height: 28, border: `2px solid ${accent}`, bgcolor: soft }} />;

  if (width === undefined && height === undefined) return <>{icon}</>;

  const boxWidth = width ?? 44;
  const boxHeight = height ?? 34;
  const scale = Math.max(0.1, Math.min(boxWidth / 52, boxHeight / 40));
  return (
    <Box sx={{ width: boxWidth, height: boxHeight, display: 'grid', placeItems: 'center', overflow: 'hidden' }} role="presentation" aria-hidden="true">
      <Box sx={{ width: 52, height: 40, display: 'grid', placeItems: 'center', transform: `scale(${scale})`, transformOrigin: 'center' }}>
        {icon}
      </Box>
    </Box>
  );
}

function LibraryTile({ label, detail, active, tone, previewKind, onClick }: { label: string; detail?: string; active?: boolean; tone: EditorTone; previewKind: PreviewKind; onClick: () => void }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  // Pull the current display size from the settings store. Re-renders when
  // settings change (via the version hook below) so the user can tune the one
  // authoring tile live without kicking off WebGL renders for every visible tile.
  const settingsVersion = usePreviewSettingsVersion();
  const settings = previewKind === 'prefab' ? null : getKindSettings(previewKind);
  const measuredArea = getLibraryPreviewAreaSize();
  const displaySize = settings && measuredArea
    ? fitDisplaySizeToTile(measuredArea, { width: settings.width, height: settings.height }, 0)
    : settings?.displaySize ?? { width: 52, height: 52 };
  const livePreviewKind = previewKind !== 'prefab' && getPreviewAuthoringKind() === previewKind ? previewKind : null;
  const previewTone = settings?.objectColorOverride ? { ...tone, accent: settings.objectColorOverride } : tone;
  // Reference settingsVersion so the linter / future readers see this
  // component is intentionally subscribed to settings changes.
  void settingsVersion;
  // Measure the image area so the settings panel's "Fit to tile" action has
  // a real tile size to fit against, not a hardcoded constant.
  const areaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = areaRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const rect = element.getBoundingClientRect();
      // Guard against the (transient) zero-size measurement ResizeObserver
      // emits right before the layout settles.
      if (rect.width > 0 && rect.height > 0) {
        setLibraryPreviewAreaSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <Tooltip title={detail || ''} placement="right" disableHoverListener={!detail}>
      <ButtonBase
        onClick={onClick}
        sx={{
          ...libraryTileSx(editorColors),
          color: active ? tone.text : editorColors.text,
          bgcolor: active ? tone.surface : editorColors.panelInset,
          borderColor: active ? `${tone.accent}66` : editorColors.border,
        }}
      >
        <Box ref={areaRef} className="library-preview" sx={{ height: 52, display: 'grid', placeItems: 'center', opacity: 0.95, transition: 'opacity 120ms ease, transform 120ms ease' }}>
          {livePreviewKind ? (
            <PreviewImage kind={livePreviewKind} width={displaySize.width} height={displaySize.height} />
          ) : previewKind !== 'prefab' && hasStaticPreviewAsset(previewKind) ? (
            <StaticPreviewAsset kind={previewKind} width={displaySize.width} height={displaySize.height} />
          ) : (
            <PreviewShape
              kind={previewKind}
              tone={previewTone}
              width={previewKind === 'prefab' ? 48 : displaySize.width}
              height={previewKind === 'prefab' ? 38 : displaySize.height}
            />
          )}
        </Box>
        <Typography variant="caption" noWrap sx={{ ...editorType.body, color: 'inherit', fontSize: '0.6875rem', fontWeight: 750, lineHeight: 1.1 }}>
          {label}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  return (
    <Box sx={{ px: 0.25, minHeight: 20, display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="caption" sx={{ ...editorType.sectionLabel, minWidth: 0, flex: 1, color: editorColors.textMuted }}>{label}</Typography>
      <Box sx={{ minWidth: 18, height: 18, px: 0.5, display: 'grid', placeItems: 'center', borderRadius: 0.5, bgcolor: `${editorColors.textMuted}0f`, border: `1px solid ${editorColors.border}` }}>
        <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textMuted, lineHeight: 1 }}>{count}</Typography>
      </Box>
    </Box>
  );
}

export function StageObjectLibrary({
  activeKind,
  activePrefabId,
  prefabs = [],
  onAddKind,
  onAddPrefab,
  onSelectKind,
  onSelectPrefab,
  onImportObject,
}: StageObjectLibraryProps) {
  const { colors: editorColors, tones: editorTones, type: editorType } = useEditorTheme();
  const addKind = onAddKind || onSelectKind;
  const addPrefab = onAddPrefab || onSelectPrefab;

  return (
    <Stack spacing={1.25} sx={{ color: editorColors.text }}>
      <Box sx={{ px: 0.25 }}>
        <Typography variant="subtitle2" sx={editorType.panelTitle}>Add objects</Typography>
        <Typography variant="caption" sx={editorType.caption}>Choose a tile to add it at the floor center.</Typography>
      </Box>

      <Button
        fullWidth
        size="small"
        variant="outlined"
        startIcon={<UploadFileIcon fontSize="small" />}
        onClick={onImportObject}
        sx={{ justifyContent: 'flex-start' }}
      >
        Import OBJ/STL/GLB model
      </Button>

      {STAGE_BUILDER_LIBRARY_GROUPS.map((group) => {
        const tone = editorTones[group.id];
        const placeableItems = group.items.map((kind) => itemFor(kind)).filter((item) => item?.placeable);
        return (
          <Stack key={group.id} spacing={0.5}>
            <SectionHeader label={group.label} count={placeableItems.length} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.625 }}>
              {group.items.map((kind) => {
                const item = itemFor(kind);
                if (!item?.placeable) return null;
                return (
                  <LibraryTile
                    key={kind}
                    label={item.shortLabel || item.label}
                    detail={item.description}
                    active={activeKind === kind}
                    tone={tone}
                    previewKind={kind}
                    onClick={() => addKind?.(kind)}
                  />
                );
              })}
            </Box>
          </Stack>
        );
      })}

      <Stack spacing={0.5}>
        <SectionHeader label="Prefabs" count={prefabs.length} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.625 }}>
          {prefabs.map((prefab) => (
            <LibraryTile
              key={prefab.id}
              label={prefab.title}
              detail={prefab.description || `${prefab.objects.length} objects`}
              active={activePrefabId === prefab.id}
              tone={editorTones.prefab}
              previewKind="prefab"
              onClick={() => addPrefab?.(prefab)}
            />
          ))}
        </Box>
        {!prefabs.length && <Typography variant="caption" sx={{ ...editorType.caption, px: 0.5 }}>No prefabs available.</Typography>}
      </Stack>
    </Stack>
  );
}

export function libraryLabel(kind: StageSemanticKind): string {
  return catalogItem(kind)?.label || kind;
}
