import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import HuaBanner from 'src/components/sub-pages/HuaBanner';
import Footer from 'src/components/landingpage/footer/Footer';
import LpHeader from 'src/components/landingpage/header/Header';

import { useTranslation } from 'react-i18next';

const Landingpage = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('hua-page.title')} description={t('hua-page.description')}>
      <LpHeader />
      {/*<Banner />
      <FossbotCard />
      <C2a2 /> */}
      {/* <DemoSlider /> */}
      {/* <Frameworks />
      <Testimonial />
      <Features /> */}
      {/* <C2a /> */}
      <HuaBanner />
      <Footer />
    </PageContainer>
  );
};

export default Landingpage;
