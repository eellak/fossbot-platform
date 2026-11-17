import React, { useId, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Collapse, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { StageSemanticKind } from './types';
import { STAGE_OBJECT_CATALOG, catalogItem } from './stageBuilderCatalog';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import RouteIcon from '@mui/icons-material/Route';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import TitleIcon from '@mui/icons-material/Title';
import TuneIcon from '@mui/icons-material/Tune';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
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

const categoryIcons = {
  robot: FlagOutlinedIcon, floorPaths: RouteIcon, structures: ViewInArOutlinedIcon,
  labels: TitleIcon, lighting: TuneIcon, challenge: FlagOutlinedIcon,
};

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
  minHeight: 48,
  py: 0.5,
  px: 0.75,
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 0.75,
  border: `1px solid ${alpha(editorColors.border, 0.65)}`,
  borderRadius: 0.75,
  bgcolor: editorColors.panel,
  color: editorColors.text,
  textAlign: 'left',
  transition: 'background-color 120ms ease, border-color 120ms ease',
  '&:hover': { bgcolor: editorColors.panelInset, borderColor: editorColors.borderStrong },
  '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
});

const libraryGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 0.5,
  '& > button:only-of-type': { gridColumn: '1 / -1' },
  '@container (max-width: 239px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
};

function itemFor(kind: StageSemanticKind) {
  return STAGE_OBJECT_CATALOG.find((item) => item.id === kind);
}

export function PreviewShape({ kind, width = 52, height = 40 }: { kind: PreviewKind; tone: EditorTone; width?: number; height?: number }) {
  return kind === 'prefab' ? <Box sx={{ width, height }}>Preview unavailable</Box> : <PreviewImage kind={kind} width={width} height={height} />;
}

function LibraryTile({ label, detail, active, tone, previewKind, prefab, onClick }: { label: string; detail?: string; active?: boolean; tone: EditorTone; previewKind: PreviewKind; prefab?: StageBuilderPrefab; onClick: () => void }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  const previewSize = previewKind !== 'prefab' && hasSemanticArtwork(previewKind) ? 24 : 40;
  return (
    <Tooltip describeChild title={detail ? `${label}: ${detail}` : label} placement="right" disableHoverListener={!detail}>
      <ButtonBase
        aria-label={label}
        onClick={onClick}
        sx={{
          ...libraryTileSx(editorColors),
          color: active ? tone.text : editorColors.text,
          ...(active && { bgcolor: tone.surface, borderColor: `${tone.accent}66` }),
        }}
      >
        <Box className="library-preview" sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', '& > *': { flexShrink: 0 } }}>
          <PreviewImage kind={previewKind === 'prefab' ? undefined : previewKind} prefab={prefab} width={previewSize} height={previewSize} />
        </Box>
        <Typography variant="body2" sx={{ ...editorType.body, minWidth: 0, overflowWrap: 'anywhere', color: 'inherit', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.2 }}>
          {label}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function LibrarySection({ label, count, icon, expanded, onToggle, children }: { label: string; count: number; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  const contentId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <Stack sx={{ borderBottom: `1px solid ${editorColors.divider}`, '&:last-child': { borderBottom: 0 } }}>
      <ButtonBase
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        sx={{
          px: 0.25, minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', gap: 0.75,
          textAlign: 'left', color: editorColors.text, borderRadius: 0.5,
          '&:hover': { bgcolor: alpha(editorColors.text, 0.03) },
          '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
        }}
      >
        <KeyboardArrowRightIcon fontSize="small" sx={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: reducedMotion ? 'none' : `transform ${expanded ? 180 : 140}ms ease-out` }} />
        {icon}
        <Typography component="span" variant="subtitle2" sx={{ ...editorType.panelTitle, minWidth: 0, flex: 1, fontWeight: 700, color: 'inherit' }}>{label}</Typography>
        <Box sx={{ minWidth: 22, height: 22, px: 0.5, display: 'grid', placeItems: 'center', borderRadius: 0.5, bgcolor: `${editorColors.textMuted}0f`, border: `1px solid ${editorColors.border}` }}>
          <Typography variant="caption" sx={{ ...editorType.caption, fontWeight: 700, color: 'inherit', lineHeight: 1 }}>{count}</Typography>
        </Box>
      </ButtonBase>
      <Collapse id={contentId} in={expanded} timeout={reducedMotion ? 0 : { enter: 180, exit: 140 }} easing="ease-out" aria-hidden={!expanded} {...{ inert: expanded ? undefined : '' }}>
        <Box sx={{ py: 1 }}>{children}</Box>
      </Collapse>
    </Stack>
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ structures: true });
  const [searchCollapsed, setSearchCollapsed] = useState<Record<string, boolean>>({});
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(normalizedQuery);
  const groups = STAGE_BUILDER_LIBRARY_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(kind => {
      const item = itemFor(kind);
      return item?.placeable && matches(`${group.label} ${item.label} ${item.shortLabel}`);
    }),
  })).filter(group => group.items.length);
  const matchingPrefabs = prefabs.filter(prefab => matches(`Prefabs ${prefab.title}`));
  const expanded = (id: string) => normalizedQuery ? !searchCollapsed[id] : !!expandedSections[id];
  const toggleSection = (id: string) => {
    if (normalizedQuery) setSearchCollapsed(current => ({ ...current, [id]: !current[id] }));
    else setExpandedSections(current => ({ ...current, [id]: !current[id] }));
  };
  const changeQuery = (value: string) => { setQuery(value); setSearchCollapsed({}); };
  const resultCount = groups.reduce((total, group) => total + group.items.length, matchingPrefabs.length);

  return (
    <Stack spacing={0.5} sx={{ color: editorColors.text, containerType: 'inline-size' }}>
      <TextField
        fullWidth
        size="small"
        value={query}
        inputRef={searchInputRef}
        placeholder="Search objects…"
        onChange={event => changeQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); changeQuery(''); } }}
        inputProps={{ 'aria-label': 'Search objects' }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: editorColors.textMuted }} /></InputAdornment>,
          endAdornment: query ? <InputAdornment position="end"><IconButton aria-label="Clear search" onClick={() => { changeQuery(''); searchInputRef.current?.focus(); }} edge="end" sx={{ width: 44, height: 44 }}><CloseIcon fontSize="small" /></IconButton></InputAdornment> : undefined,
        }}
        sx={{ '& .MuiInputBase-root': { minHeight: 44, bgcolor: editorColors.panel }, '& input': { minWidth: 0 }, '& input::placeholder': { color: editorColors.textMuted, opacity: 1 } }}
      />
      {normalizedQuery && <Typography role="status" variant="caption" sx={{ ...editorType.caption, px: 0.5 }}>{resultCount ? `${resultCount} matching item${resultCount === 1 ? '' : 's'}` : 'No matching objects or prefabs.'}</Typography>}

      <Box>
        {groups.map((group) => {
          const tone = editorTones[group.id];
          const CategoryIcon = categoryIcons[group.id];
          return (
            <LibrarySection key={group.id} label={group.label} count={group.items.length} icon={<CategoryIcon sx={{ fontSize: 18 }} />} expanded={expanded(group.id)} onToggle={() => toggleSection(group.id)}>
              <Box sx={libraryGridSx}>
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
            </LibrarySection>
          );
        })}

        {(!normalizedQuery || matchingPrefabs.length > 0) && <LibrarySection label="Prefabs" count={matchingPrefabs.length} icon={<WidgetsOutlinedIcon sx={{ fontSize: 18 }} />} expanded={expanded('prefabs')} onToggle={() => toggleSection('prefabs')}>
          <Box sx={libraryGridSx}>
            {matchingPrefabs.map((prefab) => (
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
        </LibrarySection>}
      </Box>
      <Tooltip title="Import an OBJ, STL or GLB model">
        <Button size="small" variant="text" startIcon={<UploadFileIcon fontSize="small" />} aria-label="Import OBJ/STL/GLB model" onClick={onImportObject} sx={{ alignSelf: 'flex-start', minHeight: 44, color: editorColors.textMuted }}>
          Import model
        </Button>
      </Tooltip>
    </Stack>
  );
}

export function libraryLabel(kind: StageSemanticKind): string {
  return catalogItem(kind)?.label || kind;
}
