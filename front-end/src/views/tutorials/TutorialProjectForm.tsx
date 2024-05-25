import React from 'react';
import Breadcrumb from 'src/layouts/full/shared/breadcrumb/Breadcrumb';
import PageContainer from 'src/components/container/PageContainer';
import ParentCard from 'src/components/shared/ParentCard';
import NewProjectIconsTutorial from 'src/components/forms/form-horizontal/NewProjectIconsTutorial';

import { Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';

const TutorialProjectForm = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('tutorial-project-form.title')} description={t('tutorial-project-form.description')}>
      {/* breadcrumb */}
      <Breadcrumb title={t('tutorial-project-form.createNewProject')} />
      {/* end breadcrumb */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ParentCard title={t('tutorial-project-form.newProjectForm')}>
            <NewProjectIconsTutorial />
          </ParentCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default TutorialProjectForm;
