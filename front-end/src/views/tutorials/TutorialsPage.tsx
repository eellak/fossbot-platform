import { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent } from '@mui/material';
import PageContainer from '../../components/container/PageContainer'; //'src/components/container/PageContainer';
import Cards from '../../components/widgets/cards/ComplexCard'

const TutorialsPage = () => {
  

  return (
    <PageContainer title="Elementary Page" description="This is the Elementary page">
      <Cards/>
    </PageContainer>
  );
};

export default TutorialsPage;