import React, { useMemo, useState } from 'react';
import {
  Box, ButtonBase, Divider, IconButton, InputBase, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import type { EditorStage, EditorStageObject, StageBuilderGroup } from './types';
import { displayObjectType } from './stageBuilderCatalog';
import { editorColors, editorTones, editorType, type EditorTone } from './stageBuilderEditorTheme';

export interface StageSceneHierarchyProps {
  stage: EditorStage;
  selectedId: string | null;
  selectedIds: string[];
  stageSelected?: boolean;
  onSelectStage?: () => void;
  onSelectObject: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
}

const panelText = editorColors.text;
const panelMuted = editorColors.textMuted;
const panelLine = editorColors.border;
const selectedBg = '#101820';
const hoverBg = editorColors.panelRaised;

const hierarchyTones: Record<'robot' | 'structures' | 'markers' | 'labels' | 'groups', EditorTone> = {
  robot: editorTones.robot,
  structures: editorTones.structures,
  markers: editorTones.challenge,
  labels: editorTones.labels,
  groups: editorTones.prefab,
};

function sectionFor(object: EditorStageObject): keyof typeof hierarchyTones {
  if (object.groupId || object.prefabSourceId) return 'groups';
  if (object.kind === 'fossbot' || object.semanticKind === 'robotSpawn') return 'robot';
  if (object.kind === 'text' || object.semanticKind === 'cameraMarker' || object.semanticKind === 'label') return 'labels';
  if (['target', 'checkpoint', 'dangerZone', 'sensorZone', 'line', 'baseTile'].includes(object.semanticKind || '')) return 'markers';
  return 'structures';
}

function objectGlyph(object: EditorStageObject): string {
  if (object.kind === 'fossbot') return 'R';
  if (object.kind === 'line') return '⌁';
  if (object.kind === 'text') return 'T';
  if (object.semanticKind === 'target') return '◎';
  if (object.kind === 'cylinder') return '◯';
  return '□';
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

function HeaderAction({ title, disabled, children, onClick }: { title: string; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 0.75,
            color: disabled ? editorColors.textSubtle : editorColors.text,
            border: `1px solid ${editorColors.border}`,
            bgcolor: editorColors.panelRaised,
            '&:hover': { bgcolor: '#2d3a42' },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function StageSettingsRow({ selected, stageName, onSelectStage }: { selected: boolean; stageName: string; onSelectStage?: () => void }) {
  return (
    <ButtonBase
      onClick={onSelectStage}
      sx={{
        width: '100%',
        minHeight: 32,
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr)',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        color: selected ? editorColors.textStrong : panelText,
        bgcolor: selected ? selectedBg : 'transparent',
        textAlign: 'left',
        '&:hover': { bgcolor: selected ? selectedBg : hoverBg },
        '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color: selected ? editorColors.accentText : panelMuted }}>
        <TuneIcon sx={{ width: 16, height: 16 }} />
      </Box>
      <Box minWidth={0}>
        <Typography variant="body2" noWrap sx={{ ...editorType.body, fontWeight: selected ? 800 : 650, color: 'inherit' }}>
          Stage settings
        </Typography>
        <Typography variant="caption" noWrap sx={{ ...editorType.caption, display: 'block' }}>
          {stageName || 'Untitled Stage'}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function ObjectRow({
  object,
  selected,
  selectedIds,
  onSelectObject,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
}: {
  object: EditorStageObject;
  selected: boolean;
  selectedIds: string[];
  onSelectObject: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const checked = selectedIds.includes(object.id);
  const rowSelected = selected || checked;
  const tone = toneForObject(object);

  const select = (event?: React.MouseEvent) => {
    if (event?.metaKey || event?.ctrlKey || event?.shiftKey) {
      const next = checked ? selectedIds.filter((id) => id !== object.id) : [...selectedIds, object.id];
      onSelectionChange(next);
      return;
    }
    onSelectObject(object.id);
  };

  return (
    <Box
      onClick={select}
      onDoubleClick={() => setEditing(true)}
      sx={{
        minHeight: 32,
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        color: rowSelected ? editorColors.textStrong : panelText,
        cursor: 'default',
        opacity: object.hidden ? 0.55 : 1,
        bgcolor: rowSelected ? selectedBg : 'transparent',
        '&:hover': { bgcolor: rowSelected ? selectedBg : hoverBg },
        '&:hover .scene-row-actions': { opacity: 1 },
      }}
    >
      <Box sx={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color: rowSelected ? tone.accent : panelMuted, fontSize: 13, fontWeight: 800 }}>
        {objectGlyph(object)}
      </Box>
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
      <Stack className="scene-row-actions" direction="row" spacing={0.1} sx={{ opacity: rowSelected ? 1 : 0, transition: 'opacity 120ms ease' }}>
        <Tooltip title={object.hidden ? 'Show' : 'Hide'}><IconButton size="small" onClick={(event) => { stop(event); onObjectChange({ ...object, hidden: !object.hidden } as EditorStageObject); }} sx={{ color: panelMuted, p: 0.25 }} aria-label={object.hidden ? 'Show object' : 'Hide object'}>{object.hidden ? <VisibilityOffIcon sx={{ width: 16, height: 16 }} /> : <VisibilityIcon sx={{ width: 16, height: 16 }} />}</IconButton></Tooltip>
        <Tooltip title={object.locked ? 'Unlock' : 'Lock'}><IconButton size="small" onClick={(event) => { stop(event); onObjectChange({ ...object, locked: !object.locked } as EditorStageObject); }} sx={{ color: panelMuted, p: 0.25 }} aria-label={object.locked ? 'Unlock object' : 'Lock object'}>{object.locked ? <LockIcon sx={{ width: 16, height: 16 }} /> : <LockOpenIcon sx={{ width: 16, height: 16 }} />}</IconButton></Tooltip>
        <Tooltip title="Duplicate"><IconButton size="small" onClick={(event) => { stop(event); onDuplicateObjects([object.id]); }} sx={{ color: panelMuted, p: 0.25 }} aria-label="Duplicate object"><ContentCopyIcon sx={{ width: 16, height: 16 }} /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" onClick={(event) => { stop(event); onDeleteObjects([object.id]); }} sx={{ color: editorColors.danger, p: 0.25 }} aria-label="Delete object"><DeleteIcon sx={{ width: 16, height: 16 }} /></IconButton></Tooltip>
      </Stack>
    </Box>
  );
}

function GroupBlock({
  group,
  objects,
  selectedId,
  selectedIds,
  onSelectObject,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
  onGroupRename,
  onPatchObjects,
}: {
  group: StageBuilderGroup;
  objects: EditorStageObject[];
  selectedId: string | null;
  selectedIds: string[];
  onSelectObject: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const ids = objects.map((object) => object.id);
  const allHidden = objects.length > 0 && objects.every((object) => object.hidden);
  const allLocked = objects.length > 0 && objects.every((object) => object.locked);
  const selected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));

  return (
    <Box>
      <Box
        onClick={() => onSelectionChange(ids)}
        onDoubleClick={() => setEditing(true)}
        sx={{
          minHeight: 32,
          display: 'grid',
          gridTemplateColumns: '24px 24px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          color: selected ? editorColors.textStrong : panelText,
          cursor: 'default',
          bgcolor: selected ? selectedBg : 'transparent',
          '&:hover': { bgcolor: selected ? selectedBg : hoverBg },
          '&:hover .scene-row-actions': { opacity: 1 },
        }}
      >
        <IconButton size="small" onClick={(event) => { stop(event); setExpanded((value) => !value); }} sx={{ color: panelMuted, p: 0 }}>
          {expanded ? <KeyboardArrowDownIcon sx={{ width: 18, height: 18 }} /> : <KeyboardArrowRightIcon sx={{ width: 18, height: 18 }} />}
        </IconButton>
        <Box sx={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color: selected ? hierarchyTones.groups.accent : panelMuted }}>
          <CreateNewFolderIcon sx={{ width: 16, height: 16 }} />
        </Box>
        <Box minWidth={0}>
          {editing ? (
            <TextField autoFocus size="small" variant="standard" value={group.name} onClick={stop} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') setEditing(false); }} onChange={(event) => onGroupRename(group.id, event.target.value)} InputProps={{ sx: { color: panelText, fontSize: '0.8125rem' } }} sx={{ width: '100%' }} />
          ) : (
            <Typography variant="body2" noWrap sx={{ ...editorType.body, fontWeight: selected ? 800 : 650, color: 'inherit' }}>{group.name}</Typography>
          )}
        </Box>
        <Stack className="scene-row-actions" direction="row" spacing={0.1} sx={{ opacity: selected ? 1 : 0, transition: 'opacity 120ms ease' }}>
          <Tooltip title={allHidden ? 'Show all' : 'Hide all'}><IconButton size="small" onClick={(event) => { stop(event); onPatchObjects(ids, { hidden: !allHidden } as Partial<EditorStageObject>); }} sx={{ color: panelMuted, p: 0.25 }}>{allHidden ? <VisibilityOffIcon sx={{ width: 16, height: 16 }} /> : <VisibilityIcon sx={{ width: 16, height: 16 }} />}</IconButton></Tooltip>
          <Tooltip title={allLocked ? 'Unlock all' : 'Lock all'}><IconButton size="small" onClick={(event) => { stop(event); onPatchObjects(ids, { locked: !allLocked } as Partial<EditorStageObject>); }} sx={{ color: panelMuted, p: 0.25 }}>{allLocked ? <LockIcon sx={{ width: 16, height: 16 }} /> : <LockOpenIcon sx={{ width: 16, height: 16 }} />}</IconButton></Tooltip>
          <Tooltip title="Duplicate group"><IconButton size="small" onClick={(event) => { stop(event); onDuplicateObjects(ids); }} sx={{ color: panelMuted, p: 0.25 }}><ContentCopyIcon sx={{ width: 16, height: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete group"><IconButton size="small" onClick={(event) => { stop(event); onDeleteObjects(ids); }} sx={{ color: editorColors.danger, p: 0.25 }}><DeleteIcon sx={{ width: 16, height: 16 }} /></IconButton></Tooltip>
        </Stack>
      </Box>
      {expanded && (
        <Box sx={{ ml: 2.5, borderLeft: `1px solid ${panelLine}` }}>
          {objects.map((object) => (
            <ObjectRow
              key={object.id}
              object={object}
              selected={object.id === selectedId}
              selectedIds={selectedIds}
              onSelectObject={onSelectObject}
              onSelectionChange={onSelectionChange}
              onObjectChange={onObjectChange}
              onDuplicateObjects={onDuplicateObjects}
              onDeleteObjects={onDeleteObjects}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export function StageSceneHierarchy({
  stage,
  selectedId,
  selectedIds,
  stageSelected = false,
  onSelectStage,
  onSelectObject,
  onSelectionChange,
  onObjectChange,
  onDuplicateObjects,
  onDeleteObjects,
  onGroupSelected,
  onUngroupSelected,
  onGroupRename,
  onPatchObjects,
}: StageSceneHierarchyProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return stage.metadata.groups
      .map((group) => {
        const objects = stage.objects.filter((object) => group.objectIds.includes(object.id));
        const groupMatches = !normalizedQuery || group.name.toLowerCase().includes(normalizedQuery);
        const filteredObjects = groupMatches ? objects : objects.filter((object) => objectMatches(object, normalizedQuery));
        return { group, objects: filteredObjects, allObjects: objects };
      })
      .filter((entry) => entry.objects.length > 0 || (!normalizedQuery && entry.allObjects.length > 0));
  }, [stage.metadata.groups, stage.objects, normalizedQuery]);

  const groupedObjectIds = useMemo(() => new Set(stage.metadata.groups.flatMap((group) => group.objectIds)), [stage.metadata.groups]);
  const objects = useMemo(() => stage.objects.filter((object) => !groupedObjectIds.has(object.id) && objectMatches(object, normalizedQuery)), [stage.objects, groupedObjectIds, normalizedQuery]);
  const hasItems = groups.length > 0 || objects.length > 0;

  return (
    <Box sx={{ color: panelText, mx: -1, mt: -1, width: 'calc(100% + 16px)' }}>
      <Box sx={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 1, px: 1, bgcolor: editorColors.panelInset, borderBottom: `1px solid ${panelLine}` }}>
        <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: editorColors.danger, color: '#122027' }}>
          <KeyboardArrowDownIcon sx={{ width: 18, height: 18 }} />
        </Box>
        <Typography variant="subtitle2" sx={{ ...editorType.panelTitle, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Hierarchy</Typography>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.5}>
          <HeaderAction title="Group selected" disabled={selectedIds.length < 2} onClick={onGroupSelected}><CreateNewFolderIcon sx={{ width: 17, height: 17 }} /></HeaderAction>
          <HeaderAction title="Ungroup selected" disabled={!selectedIds.length} onClick={onUngroupSelected}><FolderOffIcon sx={{ width: 17, height: 17 }} /></HeaderAction>
          <HeaderAction title="Duplicate selected" disabled={!selectedIds.length} onClick={() => onDuplicateObjects(selectedIds)}><ContentCopyIcon sx={{ width: 17, height: 17 }} /></HeaderAction>
          <HeaderAction title="Delete selected" disabled={!selectedIds.length} onClick={() => onDeleteObjects(selectedIds)}><DeleteIcon sx={{ width: 17, height: 17 }} /></HeaderAction>
        </Stack>
      </Box>

      <Box sx={{ minHeight: 42, display: 'flex', alignItems: 'center', gap: 1, px: 1.25, bgcolor: editorColors.panel, borderBottom: `1px solid ${panelLine}` }}>
        <SearchIcon sx={{ width: 22, height: 22, color: panelMuted }} />
        <InputBase
          value={query}
          placeholder="Search"
          onChange={(event) => setQuery(event.target.value)}
          sx={{ flex: 1, color: panelText, fontSize: '0.9375rem', '& input::placeholder': { color: panelMuted, opacity: 1 } }}
          inputProps={{ 'aria-label': 'Search hierarchy' }}
        />
      </Box>

      <Stack spacing={0} sx={{ py: 0.5 }}>
        <StageSettingsRow selected={stageSelected} stageName={stage.title} onSelectStage={onSelectStage} />
        <Divider sx={{ borderColor: panelLine, my: 0.5 }} />

        {groups.map(({ group, objects: groupObjects }) => (
          <GroupBlock
            key={group.id}
            group={group}
            objects={groupObjects}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelectObject={onSelectObject}
            onSelectionChange={onSelectionChange}
            onObjectChange={onObjectChange}
            onDuplicateObjects={onDuplicateObjects}
            onDeleteObjects={onDeleteObjects}
            onGroupRename={onGroupRename}
            onPatchObjects={onPatchObjects}
          />
        ))}

        {objects.map((object) => (
          <ObjectRow
            key={object.id}
            object={object}
            selected={object.id === selectedId}
            selectedIds={selectedIds}
            onSelectObject={onSelectObject}
            onSelectionChange={onSelectionChange}
            onObjectChange={onObjectChange}
            onDuplicateObjects={onDuplicateObjects}
            onDeleteObjects={onDeleteObjects}
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
