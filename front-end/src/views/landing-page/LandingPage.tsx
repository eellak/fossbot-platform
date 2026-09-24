import React from 'react';
import { Box } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import Banner from 'src/components/landingpage/banner/Banner';
import Footer from 'src/components/landingpage/footer/Footer';
import LpHeader from 'src/components/landingpage/header/Header';
import PlatformCard from 'src/components/landingpage/card_fossbot/CardPlatform';
import WhatIsFossbot from 'src/components/landingpage/about/WhatIsFossbot';
import ClosingCta from 'src/components/landingpage/cta/ClosingCta';
import { useTranslation } from 'react-i18next';

const Landingpage = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('landing-title.title')} description={t('landing-title.description')}>
      <LpHeader />
      <Box component="main">
        <Banner />
        <WhatIsFossbot />
        <PlatformCard />
        <ClosingCta />
      </Box>
      <Footer />
    </PageContainer>
  );
};

export default Landingpage;
