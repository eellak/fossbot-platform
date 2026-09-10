export const workspaceLayout = {
  headerMinHeight: 58,
  horizontalPadding: 2,
  verticalPadding: 1,
  contentPadding: { xs: 1.5, md: 2 },
  paneGap: 2,
} as const;

export const workspacePaneDefaults = {
  columns: 38,
  rows: 58,
  upperMinHeight: 180,
  lowerMinHeight: 140,
} as const;

export const lessonWorkspacePaneDefaults = {
  ...workspacePaneDefaults,
  outline: 270,
} as const;
