import React, { useId, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Collapse, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { amber } from '@mui/material/colors';
import type { StageSemanticKind } from './types';
import { catalogItem } from './stageBuilderCatalog';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { StagePanelSearch } from './StagePanelSearch';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import RouteIcon from '@mui/icons-material/Route';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import TitleIcon from '@mui/icons-material/Title';
import TuneIcon from '@mui/icons-material/Tune';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import HistoryIcon from '@mui/icons-material/History';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { useEditorTheme, type EditorTone } from './stageBuilderEditorTheme';
import { PanelThumbnail, PreviewImage } from './PreviewImage';
import { MAX_RECENT_LIBRARY_ITEMS, sameLibraryItem, type LibraryItem } from './stageBuilderRecentItems';

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

const filledStarSx = { fill: amber[400], stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' } as const;

export interface StageObjectLibraryProps {
  activeKind?: StageSemanticKind | null;
  activePrefabId?: string | null;
  prefabs?: StageBuilderPrefab[];
  recentItems?: LibraryItem[];
  favouriteItems: LibraryItem[];
  onToggleFavourite: (item: LibraryItem) => void;
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
  minHeight: 44,
  py: 0.5,
  pl: 0.75,
  pr: 3,
  height: '100%',
  '@media (any-pointer: coarse)': { pr: 5.5 },
  display: 'grid',
  gridTemplateColumns: '28px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 0.5,
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
  '& > :only-child': { gridColumn: '1 / -1' },
  '@container (max-width: 239px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
};

export function PreviewShape({ kind, width = 52, height = 40 }: { kind: PreviewKind; tone: EditorTone; width?: number; height?: number }) {
  return kind === 'prefab' ? <Box sx={{ width, height }}>Preview unavailable</Box> : <PreviewImage kind={kind} width={width} height={height} />;
}

interface LibraryTileProps {
  label: string;
  detail?: string;
  active?: boolean;
  tone: EditorTone;
  previewKind: PreviewKind;
  prefab?: StageBuilderPrefab;
  favourite: boolean;
  onToggleFavourite: () => void;
  onClick: () => void;
}

function LibraryTile({ label, detail, active, tone, previewKind, prefab, favourite, onToggleFavourite, onClick }: LibraryTileProps) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  const starAction = favourite ? `Remove ${label} from favourites` : `Add ${label} to favourites`;
  return (
    <Box sx={{
      position: 'relative', minWidth: 0,
      '&:hover .library-star, &:focus-within .library-star': { opacity: 1, pointerEvents: 'auto' },
    }}>
      <Tooltip describeChild title={detail ? `${label}: ${detail}` : label} placement="right" disableHoverListener={!detail}>
        <ButtonBase
          aria-label={label}
          aria-current={active || undefined}
          onClick={onClick}
          sx={{
            ...libraryTileSx(editorColors),
            color: active ? tone.text : editorColors.text,
            ...(active && { bgcolor: tone.surface, borderColor: `${tone.accent}66` }),
          }}
        >
          <Box className="library-preview" sx={{ width: 28, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', '& > *': { flexShrink: 0 } }}>
            <PanelThumbnail kind={previewKind === 'prefab' ? undefined : previewKind} prefab={prefab} />
          </Box>
          <Typography variant="body2" sx={{ ...editorType.body, minWidth: 0, overflowWrap: 'anywhere', color: 'inherit', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.2 }}>
            {label}
          </Typography>
        </ButtonBase>
      </Tooltip>
      <ButtonBase
        className="library-star"
        aria-label={`Favourite ${label}`}
        aria-pressed={favourite}
        title={starAction}
        onClick={onToggleFavourite}
        sx={{
          position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 0.75,
          opacity: favourite ? 1 : 0, pointerEvents: favourite ? 'auto' : 'none',
          color: favourite ? editorColors.warning : editorColors.textMuted,
          '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: -2 },
          '@media (hover: none) and (pointer: fine), (any-pointer: coarse)': { opacity: 1, pointerEvents: 'auto' },
          '@media (any-pointer: coarse)': { width: 44, height: 44 },
        }}
      >
        {favourite ? <StarIcon sx={{ fontSize: 16, ...filledStarSx }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
      </ButtonBase>
    </Box>
  );
}

function LibrarySection({ label, count, icon, expanded, onToggle, buttonRef, children }: { buttonRef?: React.Ref<HTMLButtonElement>; label: string; count: number; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { colors: editorColors, type: editorType } = useEditorTheme();
  const contentId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <Stack sx={{ '&:not(:last-child)': { borderBottom: `1px solid ${editorColors.divider}` } }}>
      <ButtonBase
        ref={buttonRef}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        sx={{
          px: 0.5, minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', gap: 0.5,
          textAlign: 'left', color: editorColors.text, borderRadius: 0.5,
          '&:hover': { bgcolor: alpha(editorColors.text, 0.03) },
          '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 1 },
        }}
      >
        <KeyboardArrowRightIcon sx={{ fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: reducedMotion ? 'none' : `transform ${expanded ? 180 : 140}ms ease-out` }} />
        {icon}
        <Typography component="span" variant="subtitle2" sx={{ ...editorType.panelTitle, minWidth: 0, flex: 1, fontWeight: 700, color: 'inherit' }}>{label}</Typography>
        <Box sx={{ minWidth: 22, height: 22, px: 0.5, display: 'grid', placeItems: 'center', borderRadius: 0.5, bgcolor: `${editorColors.textMuted}0f`, border: `1px solid ${editorColors.border}` }}>
          <Typography variant="caption" sx={{ ...editorType.caption, fontWeight: 700, color: 'inherit', lineHeight: 1 }}>{count}</Typography>
        </Box>
      </ButtonBase>
      <Collapse id={contentId} in={expanded} timeout={reducedMotion ? 0 : { enter: 180, exit: 140 }} easing="ease-out" aria-hidden={!expanded} {...{ inert: expanded ? undefined : '' }}>
        <Box sx={{ pt: 0.5, pb: 1 }}>{children}</Box>
      </Collapse>
    </Stack>
  );
}

export function StageObjectLibrary({
  activeKind,
  activePrefabId,
  prefabs = [],
  recentItems = [],
  favouriteItems,
  onToggleFavourite,
  onAddKind,
  onAddPrefab,
  onSelectKind,
  onSelectPrefab,
  onImportObject,
}: StageObjectLibraryProps) {
  const { colors: editorColors, tones: editorTones, type: editorType } = useEditorTheme();
  const addKind = onAddKind || onSelectKind;
  const addPrefab = onAddPrefab || onSelectPrefab;
  const favouritesHeader = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ structures: true, recent: true });
  const [searchCollapsed, setSearchCollapsed] = useState<Record<string, boolean>>({});
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(normalizedQuery);
  const groups = STAGE_BUILDER_LIBRARY_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(kind => {
      const item = catalogItem(kind);
      return item?.placeable && matches(`${group.label} ${item.label} ${item.shortLabel}`);
    }),
  })).filter(group => group.items.length);
  const matchingPrefabs = prefabs.filter(prefab => matches(`Prefabs ${prefab.title}`));
  const available = (item: LibraryItem) => item.type === 'prefab'
    ? prefabs.some(prefab => prefab.id === item.id)
    : catalogItem(item.id)?.placeable;
  const availableRecentItems = recentItems.filter(available).slice(0, MAX_RECENT_LIBRARY_ITEMS);
  const availableFavourites = favouriteItems.filter(available);
  const defaultExpanded = (id: string) => id === 'favourites' && availableFavourites.length > 0;
  const expanded = (id: string) => normalizedQuery ? !searchCollapsed[id] : (expandedSections[id] ?? defaultExpanded(id));
  const toggleSection = (id: string) => {
    if (normalizedQuery) setSearchCollapsed(current => ({ ...current, [id]: !current[id] }));
    else setExpandedSections(current => ({ ...current, [id]: !(current[id] ?? defaultExpanded(id)) }));
  };
  const changeQuery = (value: string) => { setQuery(value); setSearchCollapsed({}); };
  const resultCount = groups.reduce((total, group) => total + group.items.length, matchingPrefabs.length);

  function renderTile(item: LibraryItem, inFavourites = false) {
    const favourite = favouriteItems.some(saved => sameLibraryItem(saved, item));
    const toggle = () => {
      if (inFavourites) favouritesHeader.current?.focus({ preventScroll: true });
      onToggleFavourite(item);
    };
    if (item.type === 'prefab') {
      const prefab = prefabs.find(entry => entry.id === item.id);
      if (!prefab) return null;
      return <LibraryTile key={`prefab:${item.id}`} label={prefab.title} detail={prefab.description || `${prefab.objects.length} objects`}
        favourite={favourite} onToggleFavourite={toggle} active={activePrefabId === item.id} tone={editorTones.prefab}
        previewKind="prefab" prefab={prefab} onClick={() => addPrefab?.(prefab)} />;
    }
    const object = catalogItem(item.id);
    if (!object?.placeable) return null;
    const group = STAGE_BUILDER_LIBRARY_GROUPS.find(group => group.items.includes(item.id));
    return <LibraryTile key={`object:${item.id}`} label={object.shortLabel || object.label} detail={object.description}
      favourite={favourite} onToggleFavourite={toggle} active={activeKind === item.id} tone={editorTones[group?.id || 'structures']}
      previewKind={item.id} onClick={() => addKind?.(item.id)} />;
  }

  return (
    <Stack spacing={1} sx={{ color: editorColors.text, containerType: 'inline-size' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1 }}>
        <StagePanelSearch label="Search objects" placeholder="Search objects…" query={query} onChange={changeQuery} />
        <Tooltip describeChild title="Import an OBJ, STL or GLB model">
          <Button size="small" variant="outlined" aria-label="Import OBJ/STL/GLB model" onClick={onImportObject} sx={{ minHeight: 44, px: 0.75 }}>
            Import…
          </Button>
        </Tooltip>
      </Box>
      {normalizedQuery && <Typography role="status" variant="caption" sx={{ ...editorType.caption, px: 0.5 }}>{resultCount ? `${resultCount} matching item${resultCount === 1 ? '' : 's'}` : 'No matching objects or prefabs.'}</Typography>}

      <Box>
        {!normalizedQuery && availableRecentItems.length > 0 && <LibrarySection label="Add again" count={availableRecentItems.length} icon={<HistoryIcon sx={{ fontSize: 18 }} />} expanded={expanded('recent')} onToggle={() => toggleSection('recent')}>
          <Box sx={libraryGridSx}>
            {availableRecentItems.map(item => renderTile(item))}
          </Box>
        </LibrarySection>}
        {!normalizedQuery && <LibrarySection label="Favourites" count={availableFavourites.length}
          icon={<StarIcon sx={{ fontSize: 18, color: editorColors.warning, ...filledStarSx }} />} buttonRef={favouritesHeader}
          expanded={expanded('favourites')} onToggle={() => toggleSection('favourites')}>
          {availableFavourites.length ? (
            <Box sx={libraryGridSx}>{availableFavourites.map(item => renderTile(item, true))}</Box>
          ) : <Typography variant="caption" sx={editorType.caption}>Star a library item to keep it here.</Typography>}
        </LibrarySection>}
        {groups.map((group) => {
          const CategoryIcon = categoryIcons[group.id];
          return (
            <LibrarySection key={group.id} label={group.label} count={group.items.length} icon={<CategoryIcon sx={{ fontSize: 18 }} />} expanded={expanded(group.id)} onToggle={() => toggleSection(group.id)}>
              <Box sx={libraryGridSx}>
                {group.items.map(id => renderTile({ type: 'object', id }))}
              </Box>
            </LibrarySection>
          );
        })}

        {(!normalizedQuery || matchingPrefabs.length > 0) && <LibrarySection label="Prefabs" count={matchingPrefabs.length} icon={<WidgetsOutlinedIcon sx={{ fontSize: 18 }} />} expanded={expanded('prefabs')} onToggle={() => toggleSection('prefabs')}>
          <Box sx={libraryGridSx}>
            {matchingPrefabs.map(prefab => renderTile({ type: 'prefab', id: prefab.id }))}
          </Box>
          {!prefabs.length && <Typography variant="caption" sx={{ ...editorType.caption, px: 0.5 }}>No prefabs available.</Typography>}
        </LibrarySection>}
      </Box>
    </Stack>
  );
}

export function libraryLabel(kind: StageSemanticKind): string {
  return catalogItem(kind)?.label || kind;
}
