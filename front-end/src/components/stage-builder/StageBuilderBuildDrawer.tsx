import React from 'react';
import {
  Alert, Box, Button, Checkbox, Divider, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CloseIcon from '@mui/icons-material/Close';
import type { EditorStage, EditorStageObject, LocalStageRecord, StageSemanticKind } from './types';
import { displayObjectType } from './stageBuilderCatalog';
import { StageObjectLibrary } from './StageObjectLibrary';
import { StageInspector } from './StageInspector';
import { StageValidationPanel } from './StageValidationPanel';
import type { StageBuilderValidationResult } from './stageBuilderValidation';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';

export interface StageBuilderBuildDrawerProps {
  stage: EditorStage;
  records: LocalStageRecord[];
  prefabs: StageBuilderPrefab[];
  selectedId: string | null;
  selectedIds: string[];
  activeKind: StageSemanticKind | null;
  activePrefabId: string | null;
  validationResults: StageBuilderValidationResult[];
  message: string;
  studio?: boolean;
  importInputRef: React.RefObject<HTMLInputElement>;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onClose: () => void;
  onNew: () => void;
  onDemo: () => void;
  onSave: () => void;
  onTest: () => void;
  onExport: () => void;
  onImportFile: (file?: File) => void;
  onRefreshRecords: () => void;
  onOpenRecord: (record: LocalStageRecord) => void;
  onDeleteRecord: (id: string) => void;
  onDuplicateRecord: (id: string) => void;
  onStageChange: (stage: EditorStage) => void;
  onSelectObject: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDeleteObject: (id: string) => void;
  onSelectKind: (kind: StageSemanticKind) => void;
  onSelectPrefab: (prefab: StageBuilderPrefab) => void;
  onDeletePrefab: (id: string) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onSaveSelectedAsPrefab: () => void;
  onToggleValidationOverride: (id: string, enabled: boolean) => void;
}

function messageSeverity(message: string): 'error' | 'success' | 'info' {
  const lower = message.toLowerCase();
  if (lower.includes('failed') || lower.includes('must') || lower.includes('error') || lower.includes('fix')) return 'error';
  if (lower.includes('saved') || lower.includes('imported') || lower.includes('duplicated')) return 'success';
  return 'info';
}

export function StageBuilderBuildDrawer({
  stage,
  records,
  prefabs,
  selectedId,
  selectedIds,
  activeKind,
  activePrefabId,
  validationResults,
  message,
  studio = false,
  importInputRef,
  advancedOpen,
  onAdvancedOpenChange,
  onClose,
  onNew,
  onDemo,
  onSave,
  onTest,
  onExport,
  onImportFile,
  onRefreshRecords,
  onOpenRecord,
  onDeleteRecord,
  onDuplicateRecord,
  onStageChange,
  onSelectObject,
  onSelectionChange,
  onObjectChange,
  onDeleteObject,
  onSelectKind,
  onSelectPrefab,
  onDeletePrefab,
  onGroupSelected,
  onUngroupSelected,
  onSaveSelectedAsPrefab,
  onToggleValidationOverride,
}: StageBuilderBuildDrawerProps) {
  const selectedObject = stage.objects.find((object) => object.id === selectedId) || null;
  const sortedObjects = [...stage.objects].sort((a, b) => displayObjectType(a).localeCompare(displayObjectType(b)) || a.name.localeCompare(b.name));
  const selectedGroup = selectedObject?.groupId ? stage.metadata.groups.find((group) => group.id === selectedObject.groupId) : null;

  return (
    <Box sx={{ width: { xs: '92vw', sm: 500 }, maxWidth: '100%', p: 2, bgcolor: studio ? '#111827' : 'background.paper', color: studio ? '#eef2ff' : 'inherit', height: '100%', overflow: 'auto' }}>
      <Stack spacing={2.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5">Build</Typography>
            <Typography variant="body2" color={studio ? '#cbd5e1' : 'text.secondary'}>Place objects, inspect details, save, and test.</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close Build drawer"><CloseIcon /></IconButton>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="h6">Stages</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="contained" onClick={onNew}>New</Button>
            <Button variant="outlined" onClick={onDemo}>Demo</Button>
            <Button variant="contained" color="success" onClick={onSave}>Save</Button>
            <Button variant="outlined" onClick={onTest}>Run test</Button>
            <Button variant="outlined" onClick={onExport} startIcon={<FileDownloadIcon />}>Export</Button>
            <Button variant="outlined" onClick={() => importInputRef.current?.click()}>Import</Button>
          </Stack>
          <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => onImportFile(event.target.files?.[0])} />
          {message && <Alert severity={messageSeverity(message)}>{message}</Alert>}
        </Stack>

        <Divider />
        <StageObjectLibrary
          activeKind={activeKind}
          activePrefabId={activePrefabId}
          prefabs={prefabs}
          onSelectKind={onSelectKind}
          onSelectPrefab={onSelectPrefab}
          onDeletePrefab={onDeletePrefab}
        />

        <Divider />
        <Stack spacing={1}>
          <Typography variant="h6">Placed objects</Typography>
          {sortedObjects.length === 0 ? <Alert severity="info">No placed objects yet.</Alert> : sortedObjects.map((object) => {
            const checked = selectedIds.includes(object.id);
            return (
              <Stack key={object.id} direction="row" spacing={1} alignItems="center">
                <Checkbox checked={checked} onChange={(event) => {
                  const next = event.target.checked ? Array.from(new Set([...selectedIds, object.id])) : selectedIds.filter((id) => id !== object.id);
                  onSelectionChange(next);
                  onSelectObject(next[next.length - 1] || null);
                }} />
                <TextField
                  fullWidth
                  size="small"
                  label={displayObjectType(object)}
                  value={object.name}
                  onFocus={() => { onSelectObject(object.id); if (!selectedIds.includes(object.id)) onSelectionChange([object.id]); }}
                  onChange={(event) => onObjectChange({ ...object, name: event.target.value } as EditorStageObject)}
                />
                <Button size="small" variant={object.id === selectedId ? 'contained' : 'outlined'} onClick={() => { onSelectObject(object.id); onSelectionChange([object.id]); }}>Pick</Button>
                <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDeleteObject(object.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            );
          })}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button disabled={selectedIds.length < 2} variant="outlined" onClick={onGroupSelected}>Group</Button>
            <Button disabled={!selectedGroup && selectedIds.every((id) => !stage.objects.find((object) => object.id === id)?.groupId)} variant="outlined" onClick={onUngroupSelected}>Ungroup</Button>
            <Button disabled={!selectedIds.length} variant="outlined" onClick={onSaveSelectedAsPrefab}>Save as prefab</Button>
          </Stack>
          {selectedGroup && <Alert severity="info">Selected group: {selectedGroup.name}</Alert>}
        </Stack>

        <Divider />
        <Stack spacing={1.5}>
          <Typography variant="h6">Stage details</Typography>
          <TextField label="Stage title" value={stage.title} onChange={(event) => onStageChange({ ...stage, title: event.target.value })} />
          <TextField label="Description" value={stage.description} multiline minRows={3} onChange={(event) => onStageChange({ ...stage, description: event.target.value })} />
          <Typography variant="subtitle2">Floor</Typography>
          <Stack direction="row" spacing={1}>
            <TextField label="Width" type="number" size="small" value={stage.floor.dimensions[0]} onChange={(event) => onStageChange({ ...stage, floor: { ...stage.floor, dimensions: [Math.max(1, Number(event.target.value) || stage.floor.dimensions[0]), stage.floor.dimensions[1]] } })} />
            <TextField label="Depth" type="number" size="small" value={stage.floor.dimensions[1]} onChange={(event) => onStageChange({ ...stage, floor: { ...stage.floor, dimensions: [stage.floor.dimensions[0], Math.max(1, Number(event.target.value) || stage.floor.dimensions[1])] } })} />
            <TextField label="Color" size="small" value={stage.floor.color} onChange={(event) => onStageChange({ ...stage, floor: { ...stage.floor, color: event.target.value } })} />
          </Stack>
        </Stack>

        <Divider />
        <StageValidationPanel results={validationResults} onToggleOverride={onToggleValidationOverride} />

        <Divider />
        <StageInspector
          object={selectedObject}
          selectedCount={selectedIds.length || (selectedObject ? 1 : 0)}
          advancedOpen={advancedOpen}
          onAdvancedOpenChange={onAdvancedOpenChange}
          onChange={onObjectChange}
          onDelete={onDeleteObject}
        />

        <Divider />
        <Stack spacing={1}>
          <Typography variant="h6">Saved locally</Typography>
          {records.length === 0 ? <Alert severity="info">No local stages yet.</Alert> : records.map((record) => (
            <Stack key={record.id} direction="row" spacing={1} alignItems="center">
              <Button fullWidth variant={record.id === stage.id ? 'contained' : 'outlined'} onClick={() => onOpenRecord(record)} sx={{ minHeight: 44, justifyContent: 'flex-start' }}>{record.title}</Button>
              <Tooltip title="Duplicate"><IconButton size="small" onClick={() => onDuplicateRecord(record.id)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDeleteRecord(record.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          ))}
          <Button variant="text" onClick={onRefreshRecords}>Refresh</Button>
        </Stack>
      </Stack>
    </Box>
  );
}
