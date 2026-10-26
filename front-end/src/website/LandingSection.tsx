import Banner from 'src/components/landingpage/banner/Banner';
import WhatIsFossbot from 'src/components/landingpage/about/WhatIsFossbot';
import PlatformCard from 'src/components/landingpage/card_fossbot/CardPlatform';
import ClosingCta from 'src/components/landingpage/cta/ClosingCta';
import { LandingProvider } from './LandingContext';
import type { Section } from './api';
export default function LandingSection({section,sectionId,primary=false}:{section:Section;sectionId?:string;primary?:boolean}) {
  let body=null;
  switch(section.group) {case 'hero':body=<Banner heading={primary?'h1':'h2'}/>;break;case 'about':body=<WhatIsFossbot sectionId={sectionId}/>;break;case 'features':body=<PlatformCard sectionId={sectionId}/>;break;case 'cta':body=<ClosingCta/>;break;}
  return <LandingProvider sections={[section]}>{body}</LandingProvider>;
}
