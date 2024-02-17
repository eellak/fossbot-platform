import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import Banner from 'src/components/landingpage/banner/Banner';
import C2a2 from 'src/components/landingpage/c2a/C2a2';
import Footer from 'src/components/landingpage/footer/Footer';
import LpHeader from 'src/components/landingpage/header/Header';
import FossbotCard from 'src/components/landingpage/card_fossbot/CardFossbot';

import { useTranslation } from 'react-i18next';

const Landingpage = () => {
  const { t } = useTranslation();

  return (
    <PageContainer  title={t('hua-page.title')} description={t('hua-page.description')}>
      <LpHeader />
      <Banner />
      <FossbotCard />
      <C2a2 />
      {/* <DemoSlider /> */}
      {/* <Frameworks /> */}
      {/* <Testimonial /> */}
      {/* <Features />
      <C2a /> */}
      
      <Footer />
    </PageContainer>
  );
};

export default Landingpage;
