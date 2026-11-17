import React from 'react';
import { Box, Button, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import type { StageSemanticKind } from './types';
import { STAGE_OBJECT_CATALOG, catalogItem } from './stageBuilderCatalog';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { useEditorTheme, type EditorTone } from './stageBuilderEditorTheme';
import { PreviewImage } from './PreviewImage';
import { hasSemanticArtwork } from './stageBuilderLibraryArtwork';

export type StageBuilderLibraryGroup = {
  id: 'floorPaths' | 'structures' | 'robot' | 'challenge' | 'labels' | 'lighting';
  label: string;
  items: StageSemanticKind[];
};

export const STAGE_BUILDER_LIBRARY_GROUPS: StageBuilderLibraryGroup[] = [
  { id: 'robot', label: 'Mission setup', items: ['robotSpawn', 'target', 'checkpoint', 'collectible', 'pushObject'] },
  { id: 'floorPaths', label: 'Paths and floor markers', items: ['line', 'baseTile', 'dangerZone', 'sensorZone', 'targetZone', 'directionArrow'] },
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

const libraryTileSx = (editorColors: ReturnType<typeof useEditorTheme>['colors']) => ({
  width: '100%',
  aspectRatio: '4 / 3',
  minHeight: 0,
  p: 0.5,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr) 16px',
  alignItems: 'center',
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

export function PreviewShape({ kind, width = 52, height = 40 }: { kind: PreviewKind; tone: EditorTone; width?: number; height?: number }) {
  return kind === 'prefab' ? <Box sx={{ width, height }}>Preview unavailable</Box> : <PreviewImage kind={kind} width={width} height={height} />;
}

function LibraryTile({ label, detail, active, tone, previewKind, prefab, onClick }: { label: string; detail?: string; active?: boolean; tone: EditorTone; previewKind: PreviewKind; prefab?: StageBuilderPrefab; onClick: () => void }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  return (
    <Tooltip describeChild title={detail ? `${label}: ${detail}` : label} placement="right" disableHoverListener={!detail}>
      <ButtonBase
        aria-label={label}
        onClick={onClick}
        sx={{
          ...libraryTileSx(editorColors),
          color: active ? tone.text : editorColors.text,
          bgcolor: active ? tone.surface : editorColors.panelInset,
          borderColor: active ? `${tone.accent}66` : editorColors.border,
        }}
      >
        <Box className="library-preview" sx={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, '& > *': { position: 'absolute', inset: 0, margin: 'auto', width: previewKind !== 'prefab' && hasSemanticArtwork(previewKind) ? '56%' : '72%', height: '80%', objectFit: 'contain' }, opacity: 0.95, transition: 'opacity 120ms ease, transform 120ms ease' }}>
          <PreviewImage kind={previewKind === 'prefab' ? undefined : previewKind} prefab={prefab} width={240} height={180} />
        </Box>
        <Typography variant="caption" noWrap sx={{ ...editorType.body, color: 'inherit', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}>
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
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.625 }}>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.625 }}>
          {prefabs.map((prefab) => (
            <LibraryTile
              key={prefab.id}
              label={prefab.title}
              detail={prefab.description || `${prefab.objects.length} objects`}
              active={activePrefabId === prefab.id}
              tone={editorTones.prefab}
              previewKind="prefab"
              prefab={prefab}
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
