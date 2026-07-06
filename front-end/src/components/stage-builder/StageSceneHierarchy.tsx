import React, { useMemo, useState } from 'react';
import {
  Box, IconButton, InputBase, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import type { EditorStage, EditorStageObject, StageBuilderGroup } from './types';
import { displayObjectType } from './stageBuilderCatalog';
import { PreviewShape, type PreviewKind } from './StageObjectLibrary';
import { editorColors, editorTones, editorType, type EditorTone } from './stageBuilderEditorTheme';

export type HierarchyDropPosition = 'before' | 'after' | 'inside';
export type HierarchyDropTarget = { type: 'object' | 'group'; id: string; position: HierarchyDropPosition };

export interface StageSceneHierarchyProps {
  stage: EditorStage;
  selectedId: string | null;
  selectedIds: string[];
  selectedGroupId: string | null;
  onSelectObject: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onHierarchyDrop: (draggedId: string, target: HierarchyDropTarget) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
}

const panelText = editorColors.text;
const panelMuted = editorColors.textMuted;
const panelLine = editorColors.border;
const treeLine = 'rgba(148, 163, 184, 0.14)';
const selectedBg = 'rgba(74, 163, 255, 0.1)';
const hoverBg = 'rgba(148, 163, 184, 0.06)';
const dragDataType = 'application/x-fossbot-stage-object-id';

const rowActionSx = {
  width: 22,
  height: 22,
  p: 0,
  color: panelMuted,
  '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.1)', color: editorColors.textStrong },
} as const;

const hierarchyTones: Record<'robot' | 'structures' | 'markers' | 'labels' | 'groups', EditorTone> = {
  robot: editorTones.robot,
  structures: editorTones.structures,
  markers: editorTones.challenge,
  labels: editorTones.labels,
  groups: editorTones.prefab,
};

type GroupEntry = { group: StageBuilderGroup; objects: EditorStageObject[]; allObjects: EditorStageObject[] };
type RootItem = { type: 'group'; entry: GroupEntry } | { type: 'object'; object: EditorStageObject };

function sectionFor(object: EditorStageObject): keyof typeof hierarchyTones {
  if (object.groupId || object.prefabSourceId) return 'groups';
  if (object.kind === 'fossbot' || object.semanticKind === 'robotSpawn') return 'robot';
  if (object.kind === 'text' || object.semanticKind === 'cameraMarker' || object.semanticKind === 'label') return 'labels';
  if (['target', 'checkpoint', 'dangerZone', 'sensorZone', 'line', 'baseTile'].includes(object.semanticKind || '')) return 'markers';
  return 'structures';
}

function previewKindForObject(object: EditorStageObject): PreviewKind {
  if (object.semanticKind) return object.semanticKind;
  if (object.kind === 'fossbot') return 'robotSpawn';
  if (object.kind === 'base') return 'baseTile';
  if (object.kind === 'cube') return 'block';
  if (object.kind === 'cylinder') return 'cylinder';
  if (object.kind === 'line') return 'line';
  if (object.kind === 'text') return 'label';
  return 'block';
}

function toneForObject(object: EditorStageObject): EditorTone {
  return hierarchyTones[sectionFor(object)];
}

function stop(event: React.MouseEvent) {
  event.stopPropagation();
}

function objectMatches(object: EditorStageObject, query: string): boolean {
  if (!query) return true;
  const haystack = `${object.name} ${displayObjectType(object)} ${object.kind} ${object.semanticKind || ''}`.toLowerCase();
  return haystack.includes(query);
}

function treeMetrics(depth: number) {
  const x = 12 + depth * 24;
  return { lineX: x, contentX: x + 14 };
}

function TreeRowShell({ depth, last, children }: { depth: number; last: boolean; children: React.ReactNode }) {
  const { lineX } = treeMetrics(depth);
  return (
    <Box
      sx={{
        position: 'relative',
        '&:before': { content: '""', position: 'absolute', left: `${lineX}px`, top: 0, bottom: last ? '50%' : 0, borderLeft: `1px solid ${treeLine}` },
        '&:after': { content: '""', position: 'absolute', left: `${lineX}px`, top: '50%', width: 12, borderTop: `1px solid ${treeLine}` },
      }}
    >
      {children}
    </Box>
  );
}

function ObjectPreview({ object, selected }: { object: EditorStageObject; selected: boolean }) {
  const tone = toneForObject(object);
  return (
    <Box sx={{ width: 26, height: 26, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 0.5, bgcolor: selected ? tone.surface : 'transparent' }}>
      <Box sx={{ transform: 'scale(0.58)', transformOrigin: 'center', display: 'grid', placeItems: 'center' }}>
        <PreviewShape kind={previewKindForObject(object)} tone={tone} />
      </Box>
    </Box>
  );
}

function GroupPreview({ selected }: { selected: boolean }) {
  return (
    <Box sx={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 0.5, bgcolor: selected ? hierarchyTones.groups.surface : 'transparent' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selected ? hierarchyTones.groups.accent : panelMuted, opacity: selected ? 0.95 : 0.7 }} />
    </Box>
  );
}

function positionFromPointer(event: React.DragEvent<HTMLDivElement>): HierarchyDropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - rect.top) / Math.max(1, rect.height);
  if (y < 0.28) return 'before';
  if (y > 0.72) return 'after';
  return 'inside';
}

function dropSx(active?: HierarchyDropPosition | null) {
  if (active === 'before') return { boxShadow: `inset 0 2px 0 ${editorColors.accentText}` };
  if (active === 'after') return { boxShadow: `inset 0 -2px 0 ${editorColors.accentText}` };
  if (active === 'inside') return { boxShadow: `inset 0 0 0 1px rgba(124, 199, 255, 0.36)`, bgcolor: 'rgba(74, 163, 255, 0.14)' };
  return { boxShadow: 'none' };
}

function ObjectRow({
  object,
  selected,
  selectedIds,
  depth,
  last,
  draggedObjectId,
  dropTarget,
  onSelectObject,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
  onObjectDragStart,
  onTargetDragOver,
  onTargetDragLeave,
  onTargetDrop,
  onObjectDragEnd,
}: {
  object: EditorStageObject;
  selected: boolean;
  selectedIds: string[];
  depth: number;
  last: boolean;
  draggedObjectId: string | null;
  dropTarget: HierarchyDropTarget | null;
  onSelectObject: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onObjectDragStart: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDragOver: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDragLeave: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDrop: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onObjectDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const checked = selectedIds.includes(object.id);
  const rowSelected = selected || checked;
  const dragging = draggedObjectId === object.id;
  const activeDrop = dropTarget?.type === 'object' && dropTarget.id === object.id ? dropTarget.position : null;
  const { contentX } = treeMetrics(depth);

  const select = (event?: React.MouseEvent) => {
    if (event?.metaKey || event?.ctrlKey || event?.shiftKey) {
      const next = checked ? selectedIds.filter((id) => id !== object.id) : [...selectedIds, object.id];
      onSelectionChange(next);
      return;
    }
    onSelectObject(object.id);
  };

  const targetFor = (event: React.DragEvent<HTMLDivElement>): HierarchyDropTarget => ({ type: 'object', id: object.id, position: positionFromPointer(event) });

  return (
    <TreeRowShell depth={depth} last={last}>
      <Box
        draggable={!editing}
        onClick={select}
        onDoubleClick={() => setEditing(true)}
        onDragStart={(event) => onObjectDragStart(object.id, event)}
        onDragOver={(event) => onTargetDragOver(targetFor(event), event)}
        onDragLeave={(event) => onTargetDragLeave(targetFor(event), event)}
        onDrop={(event) => onTargetDrop(targetFor(event), event)}
        onDragEnd={onObjectDragEnd}
        sx={{
          minHeight: 36,
          ml: `${contentX}px`,
          mr: 0.5,
          display: 'grid',
          gridTemplateColumns: '26px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 0.75,
          px: 0.625,
          color: rowSelected ? editorColors.textStrong : panelText,
          cursor: dragging ? 'grabbing' : 'grab',
          opacity: dragging ? 0.45 : object.hidden ? 0.55 : 1,
          bgcolor: activeDrop === 'inside' ? 'rgba(74, 163, 255, 0.14)' : rowSelected ? selectedBg : 'transparent',
          transition: 'background-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
          ...dropSx(activeDrop),
          '&:hover': { bgcolor: activeDrop === 'inside' ? 'rgba(74, 163, 255, 0.14)' : rowSelected ? selectedBg : hoverBg },
          '&:hover .scene-row-actions': { opacity: 1 },
        }}
      >
        <ObjectPreview object={object} selected={rowSelected} />
        <Box minWidth={0}>
        {editing ? (
          <TextField
            autoFocus
            size="small"
            variant="standard"
            value={object.name}
            onClick={stop}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') setEditing(false); }}
            onChange={(event) => onObjectChange({ ...object, name: event.target.value } as EditorStageObject)}
            InputProps={{ sx: { color: panelText, fontSize: '0.8125rem', lineHeight: 1.2 } }}
            sx={{ width: '100%' }}
          />
        ) : (
          <Tooltip title={displayObjectType(object)} placement="right">
            <Typography variant="body2" noWrap sx={{ ...editorType.body, fontWeight: rowSelected ? 800 : 600, color: 'inherit' }}>
              {object.name}
            </Typography>
          </Tooltip>
        )}
        </Box>
        <Stack className="scene-row-actions" direction="row" spacing={0} sx={{ opacity: rowSelected ? 1 : 0, transition: 'opacity 120ms ease' }}>
          <Tooltip title={object.hidden ? 'Show' : 'Hide'}><IconButton size="small" onClick={(event) => { stop(event); onObjectChange({ ...object, hidden: !object.hidden } as EditorStageObject); }} sx={rowActionSx} aria-label={object.hidden ? 'Show object' : 'Hide object'}>{object.hidden ? <VisibilityOffIcon sx={{ width: 15, height: 15 }} /> : <VisibilityIcon sx={{ width: 15, height: 15 }} />}</IconButton></Tooltip>
          <Tooltip title={object.locked ? 'Unlock' : 'Lock'}><IconButton size="small" onClick={(event) => { stop(event); onObjectChange({ ...object, locked: !object.locked } as EditorStageObject); }} sx={rowActionSx} aria-label={object.locked ? 'Unlock object' : 'Lock object'}>{object.locked ? <LockIcon sx={{ width: 15, height: 15 }} /> : <LockOpenIcon sx={{ width: 15, height: 15 }} />}</IconButton></Tooltip>
          <Tooltip title="Duplicate"><IconButton size="small" onClick={(event) => { stop(event); onDuplicateObjects([object.id]); }} sx={rowActionSx} aria-label="Duplicate object"><ContentCopyIcon sx={{ width: 15, height: 15 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={(event) => { stop(event); onDeleteObjects([object.id]); }} sx={{ ...rowActionSx, color: editorColors.danger, '&:hover': { bgcolor: 'rgba(242, 139, 116, 0.12)', color: '#ffb4a5' } }} aria-label="Delete object"><DeleteIcon sx={{ width: 15, height: 15 }} /></IconButton></Tooltip>
        </Stack>
      </Box>
    </TreeRowShell>
  );
}

function GroupBlock({
  group,
  objects,
  selectedId,
  selectedIds,
  selectedGroupId,
  depth,
  last,
  draggedObjectId,
  dropTarget,
  onSelectObject,
  onSelectGroup,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
  onGroupRename,
  onPatchObjects,
  onObjectDragStart,
  onTargetDragOver,
  onTargetDragLeave,
  onTargetDrop,
  onObjectDragEnd,
}: {
  group: StageBuilderGroup;
  objects: EditorStageObject[];
  selectedId: string | null;
  selectedIds: string[];
  selectedGroupId: string | null;
  depth: number;
  last: boolean;
  draggedObjectId: string | null;
  dropTarget: HierarchyDropTarget | null;
  onSelectObject: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
  onObjectDragStart: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDragOver: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDragLeave: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onTargetDrop: (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => void;
  onObjectDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const ids = objects.map((object) => object.id);
  const allHidden = objects.length > 0 && objects.every((object) => object.hidden);
  const allLocked = objects.length > 0 && objects.every((object) => object.locked);
  const selected = selectedGroupId === group.id;
  const activeDrop = dropTarget?.type === 'group' && dropTarget.id === group.id ? dropTarget.position : null;
  const { contentX } = treeMetrics(depth);
  const targetFor = (event: React.DragEvent<HTMLDivElement>): HierarchyDropTarget => ({ type: 'group', id: group.id, position: positionFromPointer(event) });

  return (
    <Box>
      <TreeRowShell depth={depth} last={last}>
        <Box
          onClick={() => onSelectGroup(group.id)}
          onDoubleClick={() => setEditing(true)}
          onDragOver={(event) => onTargetDragOver(targetFor(event), event)}
          onDragLeave={(event) => onTargetDragLeave(targetFor(event), event)}
          onDrop={(event) => onTargetDrop(targetFor(event), event)}
          sx={{
            minHeight: 36,
            ml: `${contentX}px`,
            mr: 0.5,
            display: 'grid',
            gridTemplateColumns: '20px 26px minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 0.5,
            px: 0.625,
            color: selected ? editorColors.textStrong : panelText,
            cursor: draggedObjectId ? 'move' : 'default',
            bgcolor: activeDrop === 'inside' ? 'rgba(240, 167, 215, 0.12)' : selected ? selectedBg : 'transparent',
            transition: 'background-color 120ms ease, box-shadow 120ms ease',
            ...dropSx(activeDrop),
            '&:hover': { bgcolor: activeDrop === 'inside' ? 'rgba(240, 167, 215, 0.12)' : selected ? selectedBg : hoverBg },
            '&:hover .scene-row-actions': { opacity: 1 },
          }}
        >
          <IconButton size="small" onClick={(event) => { stop(event); setExpanded((value) => !value); }} sx={{ color: panelMuted, p: 0 }}>
            {expanded ? <KeyboardArrowDownIcon sx={{ width: 18, height: 18 }} /> : <KeyboardArrowRightIcon sx={{ width: 18, height: 18 }} />}
          </IconButton>
          <GroupPreview selected={selected} />
          <Box minWidth={0}>
            {editing ? (
              <TextField autoFocus size="small" variant="standard" value={group.name} onClick={stop} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') setEditing(false); }} onChange={(event) => onGroupRename(group.id, event.target.value)} InputProps={{ sx: { color: panelText, fontSize: '0.8125rem' } }} sx={{ width: '100%' }} />
            ) : (
              <Typography variant="body2" noWrap sx={{ ...editorType.body, fontWeight: selected ? 800 : 650, color: 'inherit' }}>{group.name}</Typography>
            )}
          </Box>
          <Stack className="scene-row-actions" direction="row" spacing={0} sx={{ opacity: selected ? 1 : 0, transition: 'opacity 120ms ease' }}>
            <Tooltip title={allHidden ? 'Show all' : 'Hide all'}><IconButton size="small" onClick={(event) => { stop(event); onPatchObjects(ids, { hidden: !allHidden } as Partial<EditorStageObject>); }} sx={rowActionSx}>{allHidden ? <VisibilityOffIcon sx={{ width: 15, height: 15 }} /> : <VisibilityIcon sx={{ width: 15, height: 15 }} />}</IconButton></Tooltip>
            <Tooltip title={allLocked ? 'Unlock all' : 'Lock all'}><IconButton size="small" onClick={(event) => { stop(event); onPatchObjects(ids, { locked: !allLocked } as Partial<EditorStageObject>); }} sx={rowActionSx}>{allLocked ? <LockIcon sx={{ width: 15, height: 15 }} /> : <LockOpenIcon sx={{ width: 15, height: 15 }} />}</IconButton></Tooltip>
            <Tooltip title="Duplicate group"><IconButton size="small" onClick={(event) => { stop(event); onDuplicateObjects(ids); }} sx={rowActionSx}><ContentCopyIcon sx={{ width: 15, height: 15 }} /></IconButton></Tooltip>
            <Tooltip title="Delete group"><IconButton size="small" onClick={(event) => { stop(event); onDeleteObjects(ids); }} sx={{ ...rowActionSx, color: editorColors.danger, '&:hover': { bgcolor: 'rgba(242, 139, 116, 0.12)', color: '#ffb4a5' } }}><DeleteIcon sx={{ width: 15, height: 15 }} /></IconButton></Tooltip>
          </Stack>
        </Box>
      </TreeRowShell>
      {expanded && objects.map((object, index) => (
        <ObjectRow
          key={object.id}
          object={object}
          selected={object.id === selectedId}
          selectedIds={selectedIds}
          depth={depth + 1}
          last={index === objects.length - 1}
          draggedObjectId={draggedObjectId}
          dropTarget={dropTarget}
          onSelectObject={onSelectObject}
          onSelectionChange={onSelectionChange}
          onObjectChange={onObjectChange}
          onDuplicateObjects={onDuplicateObjects}
          onDeleteObjects={onDeleteObjects}
          onObjectDragStart={onObjectDragStart}
          onTargetDragOver={onTargetDragOver}
          onTargetDragLeave={onTargetDragLeave}
          onTargetDrop={onTargetDrop}
          onObjectDragEnd={onObjectDragEnd}
        />
      ))}
    </Box>
  );
}

export function StageSceneHierarchy({
  stage,
  selectedId,
  selectedIds,
  selectedGroupId,
  onSelectObject,
  onSelectGroup,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
  onHierarchyDrop,
  onGroupRename,
  onPatchObjects,
}: StageSceneHierarchyProps) {
  const [query, setQuery] = useState('');
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<HierarchyDropTarget | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const { rootItems, objectGroupIds } = useMemo(() => {
    const objectById = new Map(stage.objects.map((object) => [object.id, object]));
    const nextObjectGroupIds = new Map<string, string>();
    const groupEntries = new Map<string, GroupEntry>();

    for (const group of stage.metadata.groups) {
      const allObjects = group.objectIds
        .map((objectId) => objectById.get(objectId))
        .filter((object): object is EditorStageObject => !!object);
      allObjects.forEach((object) => nextObjectGroupIds.set(object.id, group.id));
      const groupMatches = !normalizedQuery || group.name.toLowerCase().includes(normalizedQuery);
      const filteredObjects = groupMatches ? allObjects : allObjects.filter((object) => objectMatches(object, normalizedQuery));
      if (filteredObjects.length > 0 || (!normalizedQuery && allObjects.length > 0)) groupEntries.set(group.id, { group, objects: filteredObjects, allObjects });
    }

    const seenGroups = new Set<string>();
    const items: RootItem[] = [];
    for (const object of stage.objects) {
      const groupId = nextObjectGroupIds.get(object.id);
      if (groupId) {
        if (seenGroups.has(groupId)) continue;
        seenGroups.add(groupId);
        const entry = groupEntries.get(groupId);
        if (entry) items.push({ type: 'group', entry });
        continue;
      }
      if (objectMatches(object, normalizedQuery)) items.push({ type: 'object', object });
    }

    for (const [groupId, entry] of groupEntries) {
      if (!seenGroups.has(groupId)) items.push({ type: 'group', entry });
    }

    return { rootItems: items, objectGroupIds: nextObjectGroupIds };
  }, [stage.metadata.groups, stage.objects, normalizedQuery]);

  const hasItems = rootItems.length > 0;

  const handleObjectDragStart = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(dragDataType, id);
    event.dataTransfer.setData('text/plain', id);
    setDraggedObjectId(id);
    setDropTarget(null);
  };

  const handleTargetDragOver = (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!draggedObjectId || (target.type === 'object' && draggedObjectId === target.id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const handleTargetDragLeave = (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!dropTarget || dropTarget.type !== target.type || dropTarget.id !== target.id) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setDropTarget(null);
  };

  const handleTargetDrop = (target: HierarchyDropTarget, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggedObjectId || event.dataTransfer.getData(dragDataType) || event.dataTransfer.getData('text/plain');
    setDraggedObjectId(null);
    setDropTarget(null);
    if (!sourceId || (target.type === 'object' && sourceId === target.id)) return;
    onHierarchyDrop(sourceId, target);
  };

  const handleObjectDragEnd = () => {
    setDraggedObjectId(null);
    setDropTarget(null);
  };

  return (
    <Box sx={{ color: panelText, width: '100%', overflowX: 'hidden' }}>
      <Box sx={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 0.75, px: 0.875, bgcolor: editorColors.panel }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ ...editorType.panelTitle, fontSize: '0.875rem', lineHeight: 1.1 }}>Hierarchy</Typography>
          <Typography variant="caption" noWrap sx={{ ...editorType.caption, display: 'block' }}>{stage.objects.length} object{stage.objects.length === 1 ? '' : 's'}</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box sx={{ minHeight: 36, display: 'flex', alignItems: 'center', gap: 0.75, px: 0.875, bgcolor: editorColors.panel, borderTop: `1px solid ${panelLine}`, borderBottom: `1px solid ${panelLine}` }}>
        <SearchIcon sx={{ width: 18, height: 18, color: panelMuted }} />
        <InputBase
          value={query}
          placeholder="Filter objects"
          onChange={(event) => setQuery(event.target.value)}
          sx={{ flex: 1, color: panelText, fontSize: '0.8125rem', '& input::placeholder': { color: panelMuted, opacity: 1 } }}
          inputProps={{ 'aria-label': 'Search hierarchy' }}
        />
      </Box>

      <Stack spacing={0} sx={{ py: 0.375, minHeight: 80 }}>
        {hasItems && (
          <Typography variant="caption" sx={{ ...editorType.sectionLabel, px: 0.875, py: 0.5, color: editorColors.textMuted }}>
            Objects
          </Typography>
        )}

        {rootItems.map((item, index) => item.type === 'group' ? (
          <GroupBlock
            key={item.entry.group.id}
            group={item.entry.group}
            objects={item.entry.objects}
            selectedId={selectedId}
            selectedIds={selectedIds}
            selectedGroupId={selectedGroupId}
            depth={0}
            last={index === rootItems.length - 1}
            draggedObjectId={draggedObjectId}
            dropTarget={dropTarget}
            onSelectObject={onSelectObject}
            onSelectGroup={onSelectGroup}
            onSelectionChange={onSelectionChange}
            onObjectChange={onObjectChange}
            onDuplicateObjects={onDuplicateObjects}
            onDeleteObjects={onDeleteObjects}
            onGroupRename={onGroupRename}
            onPatchObjects={onPatchObjects}
            onObjectDragStart={handleObjectDragStart}
            onTargetDragOver={handleTargetDragOver}
            onTargetDragLeave={handleTargetDragLeave}
            onTargetDrop={handleTargetDrop}
            onObjectDragEnd={handleObjectDragEnd}
          />
        ) : (
          <ObjectRow
            key={item.object.id}
            object={{ ...item.object, groupId: objectGroupIds.get(item.object.id) || item.object.groupId }}
            selected={item.object.id === selectedId}
            selectedIds={selectedIds}
            depth={0}
            last={index === rootItems.length - 1}
            draggedObjectId={draggedObjectId}
            dropTarget={dropTarget}
            onSelectObject={onSelectObject}
            onSelectionChange={onSelectionChange}
            onObjectChange={onObjectChange}
            onDuplicateObjects={onDuplicateObjects}
            onDeleteObjects={onDeleteObjects}
            onObjectDragStart={handleObjectDragStart}
            onTargetDragOver={handleTargetDragOver}
            onTargetDragLeave={handleTargetDragLeave}
            onTargetDrop={handleTargetDrop}
            onObjectDragEnd={handleObjectDragEnd}
          />
        ))}

        {!hasItems && (
          <Typography variant="caption" sx={{ ...editorType.caption, px: 1.25, py: 1 }}>
            {normalizedQuery ? 'No matching objects.' : 'No objects yet. Add from the Library.'}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
