import React, { useEffect, useState } from 'react';
import { cms, contentLocale, type PublicEntry } from 'src/website/api';
import WebsiteContent from 'src/website/WebsiteContent';
import { LandingProvider } from 'src/website/LandingContext';
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
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<PublicEntry | null>(null);
  useEffect(() => { let active = true; setContent(null); cms<PublicEntry>(`/public/home/${contentLocale(i18n.language)}`).then(data => { if (active) setContent(data); }).catch(() => { if (active) setContent(null); }); return () => { active = false; }; }, [i18n.language]);

  return (
    <LandingProvider sections={content?.sections||[]}><PageContainer title={content?.title || t('landing-title.title')} description={content?.description || t('landing-title.description')}>
      <LpHeader />
      <Box component="main">
        {content ? <WebsiteContent content={content} home/> : <>
        <Banner />
        <WhatIsFossbot />
        <PlatformCard />
        <ClosingCta />
        </>}
      </Box>
      <Footer />
    </PageContainer></LandingProvider>
  );
};

export default Landingpage;
