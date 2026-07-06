import React, { useState } from 'react';
import { Box, Divider, Tab, Tabs } from '@mui/material';
import type { EditorStage, EditorStageObject, StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { StageObjectLibrary } from './StageObjectLibrary';
import { StageSceneHierarchy } from './StageSceneHierarchy';
import { editorColors, editorPanelSx, editorTabsSx } from './stageBuilderEditorTheme';

export interface EditorLeftPanelProps {
  stage: EditorStage;
  selectedId: string | null;
  selectedIds: string[];
  prefabs: StageBuilderPrefab[];
  onAddKind: (kind: StageSemanticKind) => void;
  onAddPrefab: (prefab: StageBuilderPrefab) => void;
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

export function EditorLeftPanel(props: EditorLeftPanelProps) {
  const [tab, setTab] = useState<'library' | 'scene'>('library');

  return (
    <Box sx={{ ...editorPanelSx, borderRight: `1px solid ${editorColors.border}` }}>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        TabIndicatorProps={{ sx: { bgcolor: editorColors.accent, height: 2 } }}
        sx={editorTabsSx}
      >
        <Tab value="library" label="Library" />
        <Tab value="scene" label="Scene" />
      </Tabs>
      <Divider sx={{ borderColor: editorColors.border }} />
      <Box sx={{ flex: 1, overflow: 'auto', p: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {tab === 'library' ? (
          <StageObjectLibrary prefabs={props.prefabs} onAddKind={props.onAddKind} onAddPrefab={props.onAddPrefab} />
        ) : (
          <StageSceneHierarchy
            stage={props.stage}
            selectedId={props.selectedId}
            selectedIds={props.selectedIds}
            onSelectObject={props.onSelectObject}
            onSelectionChange={props.onSelectionChange}
            onObjectChange={props.onObjectChange}
            onDuplicateObjects={props.onDuplicateObjects}
            onDeleteObjects={props.onDeleteObjects}
            onGroupSelected={props.onGroupSelected}
            onUngroupSelected={props.onUngroupSelected}
            onGroupRename={props.onGroupRename}
            onPatchObjects={props.onPatchObjects}
          />
        )}
      </Box>
    </Box>
  );
}
