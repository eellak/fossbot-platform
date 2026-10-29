import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { backendUrl } from 'src/utils/backendUrl';
import { cms, contentLocale, type PublicEntry, type Section } from './api';
import { withRobotNavigation } from './robotNavigation';
import { landingSections } from './landingDefaults';
const safeHref=(href:string)=>!/[\x00-\x1f]/.test(href)&&((href.startsWith('/')&&!href.startsWith('//')&&!href.startsWith('/\\'))||href.startsWith('https://'))?href:'';
const Context=createContext<Section[]|undefined>(undefined);
export function LandingProvider({sections,children}:{sections:Section[];children:ReactNode}) {return <Context.Provider value={sections}>{children}</Context.Provider>;}
export function PublishedLandingProvider({children}:{children:ReactNode}) {
  const existing=useContext(Context),{i18n}=useTranslation(),[home,setHome]=useState<PublicEntry|null>(null);
  useEffect(()=>{if(existing)return;let active=true;setHome(null);cms<PublicEntry>(`/public/home/${contentLocale(i18n.language)}`).then(x=>{if(active)setHome(x);}).catch(()=>{});return()=>{active=false;};},[existing,i18n.language]);
  return <Context.Provider value={existing||home?.sections||[]}>{children}</Context.Provider>;
}
export function useLanding(group:string) {
  const sections=useContext(Context),{t:translate}=useTranslation();
  const fallback=landingSections(key=>String(translate(key))).find(s=>s.group===group)!;
  const stored=sections?.find(s=>s.type==='landing'&&s.group===group);
  const section=stored?withRobotNavigation(stored,String(translate('website.robotPage'))):undefined;
  const values={...fallback.values,...section?.values};
  return {t:(key:string)=>values[key]??String(translate(key)),value:(key:string)=>key.startsWith('href:')?safeHref(values[key]||''):values[key]||'',menu:(section?.menu??fallback.menu??[]).map(item=>({...item,href:safeHref(item.href)}))};
}
export const landingImage=(value:string)=>/^\/website\/media\/[0-9]+$/.test(value)?`${backendUrl}${value}`:/^\/landing-media\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$/.test(value)?value:'';
