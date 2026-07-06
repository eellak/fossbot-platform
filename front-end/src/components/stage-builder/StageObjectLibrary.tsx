import React from 'react';
import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import type { StageSemanticKind } from './types';
import { STAGE_OBJECT_CATALOG, catalogItem } from './stageBuilderCatalog';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { editorColors, editorTones, editorType, type EditorTone } from './stageBuilderEditorTheme';

export type StageBuilderLibraryGroup = {
  id: 'floorPaths' | 'structures' | 'robot' | 'challenge' | 'labels';
  label: string;
  items: StageSemanticKind[];
};

export const STAGE_BUILDER_LIBRARY_GROUPS: StageBuilderLibraryGroup[] = [
  { id: 'floorPaths', label: 'Floor and Paths', items: ['line', 'baseTile'] },
  { id: 'structures', label: 'Structures', items: ['wall', 'block', 'ramp', 'platform', 'cylinder', 'obstacle'] },
  { id: 'robot', label: 'Robot', items: ['robotSpawn'] },
  { id: 'challenge', label: 'Challenge Markers', items: ['target', 'checkpoint', 'dangerZone', 'sensorZone'] },
  { id: 'labels', label: 'Labels', items: ['cameraMarker', 'label'] },
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
}

const tones: Record<StageBuilderLibraryGroup['id'] | 'prefab', EditorTone> = editorTones;
export type PreviewKind = StageSemanticKind | 'prefab';

const libraryTileSx = {
  width: '100%',
  minHeight: 66,
  p: 0.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  gap: 0.375,
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: 0.75,
  bgcolor: 'rgba(15, 23, 42, 0.18)',
  color: editorColors.text,
  textAlign: 'left',
  transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
  '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.07)', borderColor: 'rgba(148, 163, 184, 0.24)' },
  '&:active': { transform: 'translateY(1px)' },
  '&:hover .library-preview': { opacity: 1, transform: 'translateY(-1px)' },
  '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
} as const;

function itemFor(kind: StageSemanticKind) {
  return STAGE_OBJECT_CATALOG.find((item) => item.id === kind);
}

export function PreviewShape({ kind, tone }: { kind: PreviewKind; tone: EditorTone }) {
  const accent = tone.accent;
  const soft = `${tone.accent}33`;

  if (kind === 'wall') return <Box sx={{ width: 44, height: 12, bgcolor: accent, opacity: 0.78, transform: 'rotate(-8deg)', boxShadow: `0 8px 0 ${soft}` }} />;
  if (kind === 'block') return <Box sx={{ width: 30, height: 30, bgcolor: accent, opacity: 0.72, boxShadow: `8px 8px 0 ${soft}` }} />;
  if (kind === 'ramp') return <Box sx={{ width: 42, height: 26, clipPath: 'polygon(0 100%, 100% 100%, 100% 20%)', bgcolor: accent, opacity: 0.76 }} />;
  if (kind === 'platform') return <Box sx={{ width: 46, height: 10, bgcolor: accent, opacity: 0.74, boxShadow: `0 10px 0 ${soft}` }} />;
  if (kind === 'cylinder') {
    return (
      <Box sx={{ position: 'relative', width: 34, height: 38 }}>
        <Box sx={{ position: 'absolute', top: 5, left: 3, width: 28, height: 13, borderRadius: '50%', border: `2px solid ${accent}`, bgcolor: soft }} />
        <Box sx={{ position: 'absolute', top: 11, left: 3, width: 28, height: 18, borderLeft: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, bgcolor: soft }} />
        <Box sx={{ position: 'absolute', bottom: 3, left: 3, width: 28, height: 13, borderRadius: '50%', border: `2px solid ${accent}`, bgcolor: soft }} />
      </Box>
    );
  }
  if (kind === 'obstacle') return <Box sx={{ width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderBottom: `34px solid ${accent}`, opacity: 0.75 }} />;
  if (kind === 'robotSpawn') return <Box sx={{ width: 34, height: 24, border: `2px solid ${accent}`, borderRadius: 1, display: 'grid', placeItems: 'center', color: accent, fontSize: 13, fontWeight: 900 }}>R</Box>;
  if (kind === 'target') return <Box sx={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${accent}`, boxShadow: `inset 0 0 0 7px ${soft}, inset 0 0 0 13px ${accent}` }} />;
  if (kind === 'checkpoint') return <Box sx={{ position: 'relative', width: 34, height: 34, borderLeft: `2px solid ${accent}` }}><Box sx={{ position: 'absolute', top: 4, left: 2, width: 24, height: 15, bgcolor: soft, border: `2px solid ${accent}` }} /></Box>;
  if (kind === 'dangerZone') return <Box sx={{ width: 30, height: 30, bgcolor: soft, border: `2px solid ${accent}`, transform: 'rotate(45deg)' }} />;
  if (kind === 'sensorZone') return <Box sx={{ width: 40, height: 28, border: `2px dashed ${accent}`, bgcolor: soft }} />;
  if (kind === 'cameraMarker') return <Box sx={{ width: 38, height: 26, border: `2px solid ${accent}`, bgcolor: soft, position: 'relative' }}><Box sx={{ position: 'absolute', top: 6, left: 13, width: 9, height: 9, borderRadius: '50%', border: `2px solid ${accent}` }} /></Box>;
  if (kind === 'line') {
    return (
      <Box component="svg" viewBox="0 0 52 34" sx={{ width: 52, height: 34 }}>
        <path d="M5 24 C15 4 30 31 47 10" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      </Box>
    );
  }
  if (kind === 'baseTile') return <Box sx={{ width: 38, height: 28, border: `2px solid ${accent}`, bgcolor: soft, transform: 'skewX(-12deg)' }} />;
  if (kind === 'label') return <Box sx={{ color: accent, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>T</Box>;
  if (kind === 'prefab') {
    return (
      <Box sx={{ width: 44, height: 34, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
        {[0, 1, 2, 3].map((item) => <Box key={item} sx={{ bgcolor: item === 0 ? accent : soft, border: `1px solid ${accent}66` }} />)}
      </Box>
    );
  }
  return <Box sx={{ width: 28, height: 28, border: `2px solid ${accent}`, bgcolor: soft }} />;
}

function LibraryTile({ label, detail, active, tone, previewKind, onClick }: { label: string; detail?: string; active?: boolean; tone: EditorTone; previewKind: PreviewKind; onClick: () => void }) {
  return (
    <Tooltip title={detail || ''} placement="right" disableHoverListener={!detail}>
      <ButtonBase
        onClick={onClick}
        sx={{
          ...libraryTileSx,
          color: active ? tone.text : editorColors.text,
          bgcolor: active ? tone.surface : 'rgba(15, 23, 42, 0.18)',
          borderColor: active ? `${tone.accent}66` : 'rgba(148, 163, 184, 0.12)',
        }}
      >
        <Box className="library-preview" sx={{ height: 36, display: 'grid', placeItems: 'center', opacity: 0.9, transition: 'opacity 120ms ease, transform 120ms ease' }}>
          <PreviewShape kind={previewKind} tone={tone} />
        </Box>
        <Typography variant="caption" noWrap sx={{ ...editorType.body, color: 'inherit', fontSize: '0.6875rem', fontWeight: 750, lineHeight: 1.1 }}>
          {label}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <Box sx={{ px: 0.25, minHeight: 20, display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="caption" sx={{ ...editorType.sectionLabel, minWidth: 0, flex: 1, color: editorColors.textMuted }}>{label}</Typography>
      <Box sx={{ minWidth: 18, height: 18, px: 0.5, display: 'grid', placeItems: 'center', borderRadius: 0.5, bgcolor: 'rgba(148, 163, 184, 0.07)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
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
}: StageObjectLibraryProps) {
  const addKind = onAddKind || onSelectKind;
  const addPrefab = onAddPrefab || onSelectPrefab;

  return (
    <Stack spacing={1.25} sx={{ color: editorColors.text }}>
      <Box sx={{ px: 0.25 }}>
        <Typography variant="subtitle2" sx={editorType.panelTitle}>Add objects</Typography>
        <Typography variant="caption" sx={editorType.caption}>Choose a tile to add it at the floor center.</Typography>
      </Box>

      {STAGE_BUILDER_LIBRARY_GROUPS.map((group) => {
        const tone = tones[group.id];
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
              tone={tones.prefab}
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
