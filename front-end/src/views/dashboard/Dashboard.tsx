import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import ProjectsCard from 'src/components/dashboard/ProjectsCard';
import StageMarketplacePanel from 'src/components/dashboard/StageMarketplacePanel';
import UserStagesDashboardPanel from 'src/components/dashboard/UserStagesDashboardPanel';
import { Box, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CoursesDashboardPanel from 'src/components/dashboard/CoursesDashboardPanel';
import { useFeatureFlags } from 'src/config/FeatureFlags';
import PageHeader from 'src/components/shared/PageHeader';

const Modern = ({ previewAppearance = true }: { previewAppearance?: boolean }) => {
  const { t } = useTranslation();
  const { marketplace } = useFeatureFlags();

  return (
    <PageContainer title={t('dashboard-page.title')} description={t('dashboard-page.description')}>
      <Box>
        {previewAppearance && (
          <Box sx={{ mb: 2 }}>
            <PageHeader title={t('menu.dashboard')} description={t('dashboard-page.overviewSubtitle')} />
          </Box>
        )}
        <Grid container spacing={3}>
          {marketplace && <Grid item xs={12}><CoursesDashboardPanel previewAppearance={previewAppearance} /></Grid>}
          <Grid item xs={12} lg={12}>
            <ProjectsCard previewAppearance={previewAppearance} />
          </Grid>
          {marketplace && <Grid item xs={12} xl={previewAppearance ? 12 : 5}><UserStagesDashboardPanel /></Grid>}
          {marketplace && <Grid item xs={12} xl={previewAppearance ? 12 : 7}><StageMarketplacePanel embedded preview previewAppearance={previewAppearance} /></Grid>}
        </Grid>
      </Box>
    </PageContainer>
  );
};
export default Modern;
