import React from 'react';
import { Box, Divider, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import type { EditorStage, EditorStageObject, StageHierarchyRow, StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { PreviewAssetBaseContext } from './PreviewImage';
import { StageObjectLibrary } from './StageObjectLibrary';
import { StageSceneHierarchy, type HierarchyDropTarget } from './StageSceneHierarchy';
import { useEditorTheme } from './stageBuilderEditorTheme';

export interface EditorLeftPanelProps {
  stage: EditorStage;
  stageAssetBaseUrl?: string | null;
  tab: 'library' | 'scene';
  onTabChange: (tab: 'library' | 'scene') => void;
  selectedId: string | null;
  selectedIds: string[];
  selectedGroupId: string | null;
  prefabs: StageBuilderPrefab[];
  onAddKind: (kind: StageSemanticKind) => void;
  onAddPrefab: (prefab: StageBuilderPrefab) => void;
  onImportObject: () => void;
  onSelectObject: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onSelectionChange: (ids: string[]) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onDuplicateObjects: (ids: string[]) => void;
  onDuplicateGroup: (id: string) => void;
  onDeleteObjects: (ids: string[]) => void;
  onHierarchyDrop: (source: StageHierarchyRow, target: HierarchyDropTarget) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onPatchObjects: (ids: string[], patch: Partial<EditorStageObject>) => void;
  onTogglePanel: () => void;
}

export function EditorLeftPanel(props: EditorLeftPanelProps) {
  const { colors: editorColors, panelSx, tabsSx } = useEditorTheme();
  const { tab, onTabChange } = props;

  const panelToggleButtonSx = {
    width: 28,
    height: 28,
    mr: 0.5,
    borderRadius: 0.75,
    color: editorColors.textMuted,
    '&:hover': { bgcolor: editorColors.panelRaised, color: editorColors.accentText },
    '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: 2 },
  } as const;

  return (
    <PreviewAssetBaseContext.Provider value={props.stageAssetBaseUrl || null}><Box sx={{ ...panelSx, borderRight: `1px solid ${editorColors.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: editorColors.panelInset }}>
        <Tooltip title="Hide Library panel" placement="right">
          <IconButton size="small" aria-label="Hide Library panel" onClick={props.onTogglePanel} sx={panelToggleButtonSx}>
            <KeyboardDoubleArrowLeftIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tabs
          value={tab}
          onChange={(_, value) => onTabChange(value)}
          variant="fullWidth"
          TabIndicatorProps={{ sx: { bgcolor: editorColors.accent, height: 2 } }}
          sx={{ ...(tabsSx as Record<string, unknown>), flex: 1, minWidth: 0 }}
        >
          <Tab value="library" label="Library" />
          <Tab value="scene" label="Hierarchy" />
        </Tabs>

      </Box>
      <Divider sx={{ borderColor: editorColors.border }} />
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {tab === 'library' ? (
          <StageObjectLibrary prefabs={props.prefabs} onAddKind={props.onAddKind} onAddPrefab={props.onAddPrefab} onImportObject={props.onImportObject} />
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
            onDuplicateGroup={props.onDuplicateGroup}
            onDeleteObjects={props.onDeleteObjects}
            onHierarchyDrop={props.onHierarchyDrop}
            onGroupRename={props.onGroupRename}
            onPatchObjects={props.onPatchObjects}
          />
        )}
      </Box>
    </Box></PreviewAssetBaseContext.Provider>
  );
}
