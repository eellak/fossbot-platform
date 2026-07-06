import React, { useState } from 'react';
import { Box, Divider, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import type { EditorStage, EditorStageObject, StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { StageObjectLibrary } from './StageObjectLibrary';
import { StageSceneHierarchy, type HierarchyDropTarget } from './StageSceneHierarchy';
import { editorColors, editorPanelSx, editorTabsSx } from './stageBuilderEditorTheme';

export interface EditorLeftPanelProps {
  stage: EditorStage;
  selectedId: string | null;
  selectedIds: string[];
  selectedGroupId: string | null;
  prefabs: StageBuilderPrefab[];
  onAddKind: (kind: StageSemanticKind) => void;
  onAddPrefab: (prefab: StageBuilderPrefab) => void;
  onSelectObject: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDeleteObjects: (ids: string[]) => void;
  onHierarchyDrop: (draggedId: string, target: HierarchyDropTarget) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
  onTogglePanel: () => void;
}

const panelToggleButtonSx = {
  width: 28,
  height: 28,
  mr: 0.5,
  borderRadius: 0.75,
  color: editorColors.textMuted,
  '&:hover': { bgcolor: editorColors.panelRaised, color: editorColors.accentText },
  '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 2 },
} as const;

export function EditorLeftPanel(props: EditorLeftPanelProps) {
  const [tab, setTab] = useState<'library' | 'scene'>('library');

  return (
    <Box sx={{ ...editorPanelSx, borderRight: `1px solid ${editorColors.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: editorColors.panelInset }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="fullWidth"
          TabIndicatorProps={{ sx: { bgcolor: editorColors.accent, height: 2 } }}
          sx={{ ...(editorTabsSx as Record<string, unknown>), flex: 1, minWidth: 0 }}
        >
          <Tab value="library" label="Library" />
          <Tab value="scene" label="Scene" />
        </Tabs>
        <Tooltip title="Hide Library panel" placement="right">
          <IconButton size="small" aria-label="Hide Library panel" onClick={props.onTogglePanel} sx={panelToggleButtonSx}>
            <KeyboardDoubleArrowLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider sx={{ borderColor: editorColors.border }} />
      <Box sx={{ flex: 1, overflow: 'auto', p: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {tab === 'library' ? (
          <StageObjectLibrary prefabs={props.prefabs} onAddKind={props.onAddKind} onAddPrefab={props.onAddPrefab} />
        ) : (
          <StageSceneHierarchy
            stage={props.stage}
            selectedId={props.selectedId}
            selectedIds={props.selectedIds}
            selectedGroupId={props.selectedGroupId}
            onSelectObject={props.onSelectObject}
            onSelectGroup={props.onSelectGroup}
            onSelectionChange={props.onSelectionChange}
            onObjectChange={props.onObjectChange}
            onDuplicateObjects={props.onDuplicateObjects}
            onDeleteObjects={props.onDeleteObjects}
            onHierarchyDrop={props.onHierarchyDrop}
            onGroupRename={props.onGroupRename}
            onPatchObjects={props.onPatchObjects}
          />
        )}
      </Box>
    </Box>
  );
}
