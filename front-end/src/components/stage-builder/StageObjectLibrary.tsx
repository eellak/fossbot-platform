import React from 'react';
import { Box, ButtonBase, Divider, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
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

const libraryRowSx = {
  width: '100%',
  minHeight: 30,
  px: 1,
  py: 0.5,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  borderRadius: 0.75,
  color: editorColors.text,
  textAlign: 'left',
  '&:hover': { bgcolor: editorColors.panelRaised },
  '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
} as const;

function itemFor(kind: StageSemanticKind) {
  return STAGE_OBJECT_CATALOG.find((item) => item.id === kind);
}

function LibraryRow({ label, detail, active, tone, onClick }: { label: string; detail?: string; active?: boolean; tone: EditorTone; onClick: () => void }) {
  return (
    <Tooltip title={detail || ''} placement="right" disableHoverListener={!detail}>
      <ButtonBase onClick={onClick} sx={{ ...libraryRowSx, bgcolor: active ? tone.surface : 'transparent', outline: active ? `1px solid ${tone.accent}66` : 'none' }}>
        <Box sx={{ width: 16, height: 16, display: 'grid', placeItems: 'center', borderRadius: 0.75, bgcolor: tone.surface, color: tone.accent }}>
          <AddIcon sx={{ width: 13, height: 13 }} />
        </Box>
        <Box minWidth={0} flex={1}>
          <Typography variant="body2" noWrap sx={{ ...editorType.body, fontWeight: 600 }}>{label}</Typography>
        </Box>
      </ButtonBase>
    </Tooltip>
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
    <Stack spacing={1.5} sx={{ color: editorColors.text }}>
      <Box>
        <Typography variant="subtitle2" sx={editorType.panelTitle}>Library</Typography>
        <Typography variant="caption" sx={editorType.caption}>Click to add at floor center.</Typography>
      </Box>

      {STAGE_BUILDER_LIBRARY_GROUPS.map((group) => {
        const tone = tones[group.id];
        return (
          <Stack key={group.id} spacing={0.25}>
            <Typography variant="caption" sx={{ ...editorType.sectionLabel, px: 0.5 }}>
              {group.label}
            </Typography>
            {group.items.map((kind) => {
              const item = itemFor(kind);
              if (!item?.placeable) return null;
              return (
                <LibraryRow
                  key={kind}
                  label={item.label}
                  detail={item.description}
                  active={activeKind === kind}
                  tone={tone}
                  onClick={() => addKind?.(kind)}
                />
              );
            })}
          </Stack>
        );
      })}

      <Divider sx={{ borderColor: '#334149' }} />
      <Stack spacing={0.25}>
        <Typography variant="caption" sx={{ ...editorType.sectionLabel, px: 0.5 }}>
          Prefabs
        </Typography>
        {prefabs.map((prefab) => (
          <LibraryRow
            key={prefab.id}
            label={prefab.title}
            detail={prefab.description || `${prefab.objects.length} objects`}
            active={activePrefabId === prefab.id}
            tone={tones.prefab}
            onClick={() => addPrefab?.(prefab)}
          />
        ))}
        {!prefabs.length && <Typography variant="caption" sx={{ ...editorType.caption, px: 0.5 }}>No prefabs available.</Typography>}
      </Stack>

      <Typography variant="caption" sx={{ ...editorType.caption, px: 0.5, lineHeight: 1.35 }}>
        Floor settings live in Stage, not the object library.
      </Typography>
    </Stack>
  );
}

export function libraryLabel(kind: StageSemanticKind): string {
  return catalogItem(kind)?.label || kind;
}
