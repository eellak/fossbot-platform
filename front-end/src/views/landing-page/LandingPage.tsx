import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import Banner from 'src/components/landingpage/banner/Banner';
import AboutFossbot from 'src/components/landingpage/colorContainerFossbot/AboutFossbot';
import AboutPlatform from 'src/components/landingpage/colorContainerFossbot/AboutPlatform';
import Footer from 'src/components/landingpage/footer/Footer';
import LpHeader from 'src/components/landingpage/header/Header';
import PlatformCard from 'src/components/landingpage/card_fossbot/CardPlatform';
import FossbotCard from 'src/components/landingpage/card_fossbot/CardFossbot';
import { useTranslation } from 'react-i18next';

const Landingpage = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('landing-title.title')} description={t('landing-title.description')}>
      <LpHeader />
      <Banner />
      {/* <FossbotCard /> */} 
      <AboutFossbot />
      <FossbotCard />
      <AboutPlatform />      
      <PlatformCard />
      {/* <C2a2 /> */}
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
