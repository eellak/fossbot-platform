import React from 'react';
import { Box, Divider, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import type { StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { PreviewAssetBaseContext } from './PreviewImage';
import { StageObjectLibrary } from './StageObjectLibrary';
import type { LibraryItem } from './stageBuilderRecentItems';
import { StageSceneHierarchy, type StageSceneHierarchyProps } from './StageSceneHierarchy';
import { useEditorTheme } from './stageBuilderEditorTheme';

export interface EditorLeftPanelProps extends StageSceneHierarchyProps {
  stageAssetBaseUrl?: string | null;
  tab: 'library' | 'scene';
  onTabChange: (tab: 'library' | 'scene') => void;
  prefabs: StageBuilderPrefab[];
  recentItems: LibraryItem[];
  favouriteItems: LibraryItem[];
  onToggleFavourite: (item: LibraryItem) => void;
  onAddKind: (kind: StageSemanticKind) => void;
  onAddPrefab: (prefab: StageBuilderPrefab) => void;
  onImportObject: () => void;
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
          <StageObjectLibrary prefabs={props.prefabs} recentItems={props.recentItems} favouriteItems={props.favouriteItems} onToggleFavourite={props.onToggleFavourite} onAddKind={props.onAddKind} onAddPrefab={props.onAddPrefab} onImportObject={props.onImportObject} />
        ) : (
          <StageSceneHierarchy {...props} />
        )}
      </Box>
    </Box></PreviewAssetBaseContext.Provider>
  );
}
