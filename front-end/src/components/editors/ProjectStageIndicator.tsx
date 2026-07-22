import { Box, Typography } from '@mui/material';
import type { ProjectStageReference } from 'src/authentication/AuthInterfaces';

type ProjectStageIndicatorProps = {
  stage: ProjectStageReference | null;
};

function stageLabel(stage: ProjectStageReference | null): string {
  if (!stage) return 'Default stage';
  return stage.title || [stage.repoOwner, stage.repoName].filter(Boolean).join('/') || 'Default stage';
}

const ProjectStageIndicator = ({ stage }: ProjectStageIndicatorProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 1,
      mt: 1,
      minWidth: 0,
    }}
  >
    <Typography variant="caption" color="text.secondary" fontWeight={700}>
      Stage
    </Typography>
    <Typography variant="body2" color="text.primary" fontWeight={700} noWrap title={stageLabel(stage)}>
      {stageLabel(stage)}
    </Typography>
  </Box>
);

export default ProjectStageIndicator;
