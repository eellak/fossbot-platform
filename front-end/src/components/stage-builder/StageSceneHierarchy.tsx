import React, { useMemo, useRef, useState } from 'react';
import { Box, Divider, IconButton, InputBase, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckIcon from '@mui/icons-material/Check';
import { hiddenEditorObjectIds } from '../../simulator/stages/stageFormatCore';
import type { EditorStage, EditorStageObject, StageBuilderGroup, StageHierarchyRow } from './types';
import { folderOwners, normalizeStageHierarchy, rowKey, type HierarchyDrop } from './stageBuilderHierarchy';
import { displayObjectType } from './stageBuilderCatalog';
import { PanelThumbnail } from './PreviewImage';
import { StagePanelSearch } from './StagePanelSearch';
import { useEditorTheme } from './stageBuilderEditorTheme';

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
  onDuplicateGroup: (id: string) => void;
  onDeleteObjects: (ids: string[]) => void;
  onHierarchyDrop: (source: StageHierarchyRow, target: HierarchyDrop, selectedIds?: string[]) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
  onCreateFolder: (rows: StageHierarchyRow[]) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onRemoveFromFolder: (rows: StageHierarchyRow[]) => void;
}

type TreeNode = {
  row: StageHierarchyRow;
  name: string;
  object?: EditorStageObject;
  group?: StageBuilderGroup;
  children: TreeNode[];
  count: number;
};

function hierarchyTree(stage: EditorStage): TreeNode[] {
  const { folders = [], groups, hierarchyOrder = [], attachedOrder = {} } = stage.metadata;
  const owners = folderOwners(folders);
  const nodes = new Map<string, TreeNode>();
  const add = (row: StageHierarchyRow, name: string, details: Partial<TreeNode> = {}) => {
    nodes.set(rowKey(row), { row, name, children: [], count: 0, ...details });
  };
  for (const object of stage.objects) add({ kind: 'object', id: object.id }, object.name, { object });
  for (const group of groups) add({ kind: 'group', id: group.id }, group.name, { group });
  for (const folder of folders) add({ kind: 'folder', id: folder.id }, folder.name);
  const attached = new Set(Object.values(attachedOrder).flat());
  const objectRows = (ids: string[]): StageHierarchyRow[] => ids.map(id => ({ kind: 'object', id }));
  const childrenOf = (rows: StageHierarchyRow[]) => rows.map(row => nodes.get(rowKey(row))!);
  for (const node of nodes.values()) {
    if (node.row.kind === 'folder') continue;
    const ids = node.group ? node.group.objectIds.filter(id => !attached.has(id)) : attachedOrder[node.row.id] || [];
    node.children = childrenOf(objectRows(ids).filter(row => !owners.has(rowKey(row))));
  }
  for (const folder of folders) nodes.get(rowKey({ kind: 'folder', id: folder.id }))!.children = childrenOf(folder.children);
  const roots = childrenOf(hierarchyOrder);
  const countObjects = (node: TreeNode): number => {
    node.count = node.children.reduce((sum, child) => sum + countObjects(child), 0);
    return node.count + Number(!!node.object);
  };
  roots.forEach(countObjects);
  return roots;
}

function visibleTree(nodes: TreeNode[], query: string, hidden: Set<string> | null, sortByName: boolean): TreeNode[] {
  if (!query && !hidden && !sortByName) return nodes;
  const result: TreeNode[] = [];
  for (const node of nodes) {
    const { object } = node;
    if (object && hidden?.has(object.id)) continue;
    const label = object ? `${node.name} ${displayObjectType(object)} ${object.kind} ${object.semanticKind || ''}` : node.name;
    const matches = label.toLowerCase().includes(query);
    const children = visibleTree(node.children, matches ? '' : query, hidden, sortByName);
    if (matches || children.length) result.push({ ...node, children });
  }
  return sortByName ? result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : result;
}

const dragDataType = 'application/x-fossbot-stage-object-id';
const rootDrop = { kind: 'root', position: 'inside' } as const;

function Action({ label, onClick, children, danger = false }: {
  label: string; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  const { colors } = useEditorTheme();
  return <Tooltip title={label}>
    <IconButton size="small" aria-label={label} onClick={onClick} sx={{
      width: 24, height: 24, p: 0, color: danger ? colors.danger : colors.textMuted,
      '& svg': { fontSize: 16 }, '&:hover': { bgcolor: danger ? colors.dangerSurface : colors.panelRaised },
    }}>{children}</IconButton>
  </Tooltip>;
}

function RenameField({ name, onFinish }: { name: string; onFinish: (value?: string) => void }) {
  return <InputBase autoFocus defaultValue={name} inputProps={{ 'aria-label': 'New name' }}
    onFocus={event => event.target.select()}
    onBlur={event => onFinish(event.target.value.trim())}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault();
      const row = event.currentTarget.closest('[data-hierarchy-kind]');
      if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      else onFinish();
      requestAnimationFrame(() => row?.querySelector<HTMLButtonElement>('button[aria-keyshortcuts]')?.focus());
    }}
    sx={{ flex: 1, minWidth: 0, fontSize: '0.875rem', '& input': { p: 0 } }}
  />;
}

export function StageSceneHierarchy(props: StageSceneHierarchyProps) {
  const { selectedId, selectedIds, selectedGroupId } = props;
  const stage = useMemo(() => normalizeStageHierarchy(props.stage), [props.stage]);
  const { colors, type } = useEditorTheme();
  const [query, setQuery] = useState('');
  const [sortByName, setSortByName] = useState(false);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [viewMenu, setViewMenu] = useState<HTMLElement | null>(null);
  const pendingFolderRows = useRef<StageHierarchyRow[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [dragged, setDragged] = useState<StageHierarchyRow | null>(null);
  const [drop, setDrop] = useState<HierarchyDrop | null>(null);
  const search = query.trim().toLowerCase();
  const tree = useMemo(() => hierarchyTree(stage), [stage]);
  const owners = useMemo(() => folderOwners(stage.metadata.folders || []), [stage.metadata.folders]);
  const hidden = useMemo(() => visibleOnly ? hiddenEditorObjectIds(stage.objects) : null, [visibleOnly, stage.objects]);
  const roots = useMemo(() => visibleTree(tree, search, hidden, sortByName), [tree, search, hidden, sortByName]);
  const selectedRows: StageHierarchyRow[] = selectedGroupId ? [{ kind: 'group', id: selectedGroupId }]
    : (selectedIds.length ? selectedIds : selectedId ? [selectedId] : []).map(id => ({ kind: 'object', id }));
  const filedSelection = selectedRows.filter(row => owners.has(rowKey(row)));
  const toggle = (key: string) => setCollapsed(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const createFolder = (rows: StageHierarchyRow[]) => {
    const id = props.onCreateFolder(rows);
    setQuery('');
    setCollapsed(current => {
      const next = new Set(current);
      for (const row of rows) {
        let parent = owners.get(rowKey(row));
        while (parent) {
          const parentKey = rowKey({ kind: 'folder', id: parent });
          next.delete(parentKey);
          parent = owners.get(parentKey);
        }
      }
      return next;
    });
    setEditing(rowKey({ kind: 'folder', id }));
  };
  const queueFolder = (rows: StageHierarchyRow[]) => {
    pendingFolderRows.current = rows;
    setViewMenu(null);
  };
  const endDrag = () => { setDragged(null); setDrop(null); };
  const dragOver = (event: React.DragEvent, target: HierarchyDrop | null) => {
    event.stopPropagation();
    if (!dragged || !target) { setDrop(null); return; }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDrop(target);
  };
  const finishDrop = (event: React.DragEvent, target: HierarchyDrop | null) => {
    event.stopPropagation();
    event.preventDefault();
    if (dragged && target) props.onHierarchyDrop(dragged, target, selectedIds);
    endDrag();
  };
  const select = (node: TreeNode, event: React.MouseEvent | React.KeyboardEvent) => {
    if (node.group) props.onSelectGroup(node.row.id);
    else if (!node.object) toggle(rowKey(node.row));
    else if (event.metaKey || event.ctrlKey || event.shiftKey) {
      props.onSelectionChange(selectedIds.includes(node.row.id) ? selectedIds.filter(id => id !== node.row.id) : [...selectedIds, node.row.id]);
    } else props.onSelectObject(node.row.id);
  };

  const renderRows = (siblings: TreeNode[], depth = 0): React.ReactNode => siblings.map((node, index) => {
    const { row, object, group, name } = node;
    const folder = row.kind === 'folder';
    const rowHeight = object ? 28 : 36;
    const key = rowKey(row);
    const expanded = !!search || !collapsed.has(key);
    const selected = group ? group.id === selectedGroupId : !!object && (object.id === selectedId || selectedIds.includes(object.id));
    const activeDrop = drop && drop.kind !== 'root' && rowKey(drop) === key ? drop.position : null;
    const targetFor = (event: React.DragEvent): HierarchyDrop | null => {
      if (!dragged || rowKey(dragged) === key) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      const legacyDrop = dragged.kind === 'object' && !owners.has(rowKey(dragged)) && !owners.has(key);
      if ((folder || legacyDrop) && y >= 0.25 && y <= 0.75) return { ...row, position: 'inside' };
      return sortByName ? null : { ...row, position: y < 0.5 ? 'before' : 'after' };
    };
    const rename = (value?: string) => {
      setEditing(null);
      if (!value || value === name) return;
      if (object) props.onObjectChange({ ...object, name: value });
      else if (group) props.onGroupRename(row.id, value);
      else props.onRenameFolder(row.id, value);
    };
    const onKey = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node, event); }
      if (event.key === 'F2') { event.preventDefault(); setEditing(key); }
      if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const up = event.key === 'ArrowUp';
        const target = siblings[index + (up ? -1 : 1)];
        if (target && !sortByName) props.onHierarchyDrop(row, { ...target.row, position: up ? 'before' : 'after' });
      }
    };
    const ids = group?.objectIds || [row.id];
    const members = group ? stage.objects.filter(item => ids.includes(item.id)) : object ? [object] : [];
    const hidden = members.length > 0 && members.every(item => item.hidden);
    const locked = members.length > 0 && members.every(item => item.locked);
    const patch = (change: Partial<EditorStageObject>) => object
      ? props.onObjectChange({ ...object, ...change } as EditorStageObject) : props.onPatchObjects(ids, change);
    return <Box component="li" key={key} sx={{ position: 'relative', listStyle: 'none', ...(depth ? {
      '&::before, &::after': { content: '""', position: 'absolute', left: -8, pointerEvents: 'none' },
      '&::before': { top: 0, bottom: index === siblings.length - 1 ? 'auto' : 0, height: index === siblings.length - 1 ? rowHeight / 2 : 'auto', borderLeft: `1px solid ${colors.border}` },
      '&::after': { top: rowHeight / 2, width: 7, borderTop: `1px solid ${colors.border}` },
    } : {}) }}>
      <Box draggable={editing !== key} data-hierarchy-kind={row.kind} data-hierarchy-id={row.id}
        onKeyDown={event => {
          if (folder && editing !== key && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault();
            event.stopPropagation();
            props.onDeleteFolder(row.id);
          }
        }}
        onDragStart={event => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(dragDataType, JSON.stringify(row));
          setDragged(row);
        }}
        onDragOver={event => dragOver(event, targetFor(event))}
        onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDrop(null); }}
        onDrop={event => finishDrop(event, targetFor(event))} onDragEnd={endDrag}
        sx={{ display: 'flex', alignItems: 'center', height: rowHeight, px: 0.25, gap: 0.25, borderRadius: 0.5,
          bgcolor: activeDrop === 'inside' || selected ? colors.accentSoft : 'transparent',
          boxShadow: activeDrop === 'before' ? `inset 0 2px ${colors.accent}` : activeDrop === 'after' ? `inset 0 -2px ${colors.accent}` : undefined,
          '&:hover': { bgcolor: selected || activeDrop === 'inside' ? colors.accentSoft : colors.panelRaised },
          opacity: dragged && rowKey(dragged) === key ? 0.5 : 1,
          '&:hover .scene-row-actions, &:focus-within .scene-row-actions': { display: 'flex' },
          '&:focus-within': { outline: `1px solid ${colors.accent}`, outlineOffset: -1 },
        }}>
        {group && <Action label={expanded ? 'Collapse group' : 'Expand group'} onClick={() => toggle(key)}>
          {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        </Action>}
        {editing === key ? <RenameField name={name} onFinish={rename} /> : <Box component="button" type="button"
          aria-label={name} aria-pressed={folder ? undefined : selected} aria-expanded={folder ? expanded : undefined}
          aria-keyshortcuts="F2 Alt+ArrowUp Alt+ArrowDown" title={object ? displayObjectType(object) : name}
          onClick={event => select(node, event)} onDoubleClick={() => setEditing(key)} onKeyDown={onKey}
          sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 0.625, px: 0.25, py: 0,
            border: 0, bgcolor: 'transparent', textAlign: 'left', font: 'inherit', cursor: 'grab', color: colors.textStrong,
            opacity: object?.hidden ? 0.55 : 1, '&:focus-visible': { outline: 'none' }, '& svg': { flexShrink: 0 },
          }}>
          <Box component="span" sx={{ flexShrink: 0, width: group ? 18 : 44, height: '100%', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, '& > *': { flexShrink: 0 } }}>
            {folder && (expanded ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />)}
            {object ? <PanelThumbnail object={object} /> : group ? <LayersOutlinedIcon sx={{ fontSize: 18 }} />
              : expanded ? <FolderOpenOutlinedIcon sx={{ fontSize: 18 }} /> : <FolderOutlinedIcon sx={{ fontSize: 18 }} />}
          </Box>
          <Typography component="span" noWrap sx={{ ...type.panelTitle, color: 'inherit', fontWeight: object && !selected ? 600 : 700 }}>{name}</Typography>
          {folder && <Typography component="span" variant="caption" sx={{ ...type.caption, ml: 'auto', px: 0.625,
            minWidth: 22, textAlign: 'center', lineHeight: '20px', fontWeight: 700, borderRadius: 0.5,
            border: `1px solid ${colors.border}`, bgcolor: colors.panelInset }} aria-label={`${node.count} ${node.count === 1 ? 'object' : 'objects'}`}>{node.count}</Typography>}
        </Box>}
        {editing !== key && <Stack className="scene-row-actions" direction="row" sx={{ display: 'none', flexShrink: 0 }}>
          {folder ? <>
            <Action label="Rename folder" onClick={() => setEditing(key)}><EditOutlinedIcon /></Action>
            <Action label="Delete folder" danger onClick={() => props.onDeleteFolder(row.id)}><DeleteIcon /></Action>
          </> : <>
            <Action label={group ? (hidden ? 'Show all' : 'Hide all') : (hidden ? 'Show object' : 'Hide object')} onClick={() => patch({ hidden: !hidden })}>{hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}</Action>
            <Action label={group ? (locked ? 'Unlock all' : 'Lock all') : (locked ? 'Unlock object' : 'Lock object')} onClick={() => patch({ locked: !locked })}>{locked ? <LockIcon /> : <LockOpenIcon />}</Action>
            <Action label={group ? 'Duplicate group' : 'Duplicate object'} onClick={() => group ? props.onDuplicateGroup(row.id) : props.onDuplicateObjects(ids)}><ContentCopyIcon /></Action>
            <Action label={group ? 'Delete group' : 'Delete object'} danger onClick={() => props.onDeleteObjects(ids)}><DeleteIcon /></Action>
          </>}
        </Stack>}
      </Box>
      {expanded && node.children.length > 0 && <Box component="ul" sx={{ m: 0, pl: '16px' }}>{renderRows(node.children, depth + 1)}</Box>}
    </Box>;
  });

  return <Box sx={{ color: colors.text, minWidth: 0, minHeight: '100%', display: 'flex', flexDirection: 'column', containerType: 'inline-size' }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1, mb: 1 }}>
      <StagePanelSearch label="Search hierarchy" placeholder="Filter objects…" query={query} onChange={setQuery} />
      <Tooltip title="Hierarchy options"><IconButton size="small" aria-label="Hierarchy options" aria-haspopup="menu" aria-expanded={!!viewMenu}
        onClick={event => setViewMenu(event.currentTarget)} sx={{ width: 44, height: 44, color: sortByName || visibleOnly ? colors.accentText : colors.textMuted }}>
        <MoreHorizIcon fontSize="small" /></IconButton></Tooltip>
    </Box>
    <Menu anchorEl={viewMenu} open={!!viewMenu} onClose={() => setViewMenu(null)} TransitionProps={{ onExited: () => {
      // Let the menu restore focus before the folder name field takes it.
      if (pendingFolderRows.current) createFolder(pendingFolderRows.current);
      pendingFolderRows.current = null;
    } }}>
      <MenuItem onClick={() => queueFolder([])}>New folder</MenuItem>
      {selectedRows.length > 0 && <MenuItem onClick={() => queueFolder(selectedRows)}>New folder from selection</MenuItem>}
      {filedSelection.length > 0 && <MenuItem onClick={() => { props.onRemoveFromFolder(filedSelection); setViewMenu(null); }}>Remove from folder</MenuItem>}
      <Divider />
      {([
        ['Sort by name', sortByName, () => setSortByName(!sortByName)],
        ['Show hidden objects', !visibleOnly, () => setVisibleOnly(!visibleOnly)],
      ] as const).map(([label, checked, change]) => <MenuItem key={label} role="menuitemcheckbox" aria-checked={checked}
        onClick={() => { change(); setViewMenu(null); }}>
        <CheckIcon sx={{ fontSize: 16, mr: 1, visibility: checked ? 'visible' : 'hidden' }} />{label}
      </MenuItem>)}
    </Menu>
    <Box component="ul" aria-label="Stage hierarchy" sx={{ m: 0, p: 0 }}>{renderRows(roots)}</Box>
    {!roots.length && <Typography sx={{ ...type.caption, p: 1 }}>{search || visibleOnly ? 'No matching objects.' : 'No objects yet. Add from the Library.'}</Typography>}
    {dragged && <Box onDragOver={event => dragOver(event, rootDrop)} onDrop={event => finishDrop(event, rootDrop)} onDragLeave={() => setDrop(null)}
      sx={{ flex: 1, minHeight: 32, p: 1, borderRadius: 0.5, bgcolor: drop?.kind === 'root' ? colors.accentSoft : 'transparent' }}>
      <Typography sx={type.caption}>Drop at top level</Typography>
    </Box>}
  </Box>;
}
