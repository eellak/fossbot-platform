import { emptyDocument, type Section } from './api';
import { landingSections } from './landingDefaults';
// CMS content is validated JSON; copies intentionally carry no shared state.
const copyJson=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
export const siteSetting=(section:Section)=>section.type==='landing'&&['navigation','footer'].includes(section.group||'');
export const componentCatalog=['banner','feature','text','image','cards','projects','people','testimonials','latest-posts','button','hero','about','features','cta'] as const;
export type ComponentKind=typeof componentCatalog[number];
export function createWebsiteComponent(kind:ComponentKind,t:(key:string)=>string):Section {
  if(['hero','about','features','cta'].includes(kind))return copyJson(landingSections(t).find(s=>s.group===kind)!);
  return {type:kind as Section['type'],...(kind==='projects'?{title:t('website.projects'),text:'',fundingText:'',image:'',alt:''}:{}),...(kind==='latest-posts'?{title:t('website.latest-posts')}:{}),...(kind==='text'?{content:copyJson(emptyDocument)}:{}),...(kind==='feature'?{title:'',text:'',alt:'',image:'',layout:'image-right' as const,cards:[]}:{}),...(['cards','projects','people','testimonials'].includes(kind)?{cards:[]}: {})};
}
export function insertWebsiteComponent(sections:Section[],component:Section,after?:number):Section[] {
  const copy=[...sections];const footer=copy.findIndex(s=>siteSetting(s)&&s.group==='footer');
  copy.splice(after!==undefined?after+1:footer<0?copy.length:footer,0,copyJson(component));return copy;
}
