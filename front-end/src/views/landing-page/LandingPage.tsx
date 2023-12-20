// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import PageContainer from 'src/components/container/PageContainer';

// components
import Banner from 'src/components/landingpage/banner/Banner';
// import C2a from 'src/components/landingpage/c2a/C2a';
import C2a2 from 'src/components/landingpage/c2a/C2a2';
// import DemoSlider from 'src/components/landingpage/demo-slider/DemoSlider';
// import Features from 'src/components/landingpage/features/Features';
import Footer from 'src/components/landingpage/footer/Footer';
// import Frameworks from 'src/components/landingpage/frameworks/Frameworks';
import LpHeader from 'src/components/landingpage/header/Header';
// import Testimonial from 'src/components/landingpage/testimonial/Testimonial';
import FossbotCard from 'src/components/landingpage/card_fossbot/CardFossbot';

const Landingpage = () => {
  return (
    <PageContainer title="Landingpage" description="this is Landingpage">
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
