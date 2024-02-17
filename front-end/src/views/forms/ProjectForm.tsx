import React from 'react';
import Breadcrumb from 'src/layouts/full/shared/breadcrumb/Breadcrumb';
import PageContainer from 'src/components/container/PageContainer';
import ParentCard from 'src/components/shared/ParentCard';
import NewProjectIcons from '../../components/forms/form-horizontal/NewProjectIcons';

import { Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ProjectForm = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('project-form.title')} description={t('project-form.description')}>
      {/* breadcrumb */}
      <Breadcrumb title={t('project-form.createNewProject')} />
      {/* end breadcrumb */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ParentCard title={t('project-form.newProjectForm')}>
            <NewProjectIcons />
          </ParentCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default ProjectForm;
