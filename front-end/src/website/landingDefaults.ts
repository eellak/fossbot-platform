import type { Section } from './api';
import { menuIconId } from './menuIcons';
export const landingGroups = ['navigation','hero','about','features','cta','footer'] as const;
export function landingSections(t:(key:string)=>string):Section[] {
  const section=(group:string,keys:string[],extra:Record<string,string>={}):Section=>({type:'landing',group,values:{...Object.fromEntries(keys.map(key=>[key,t(key)])),...extra}});
  return [
    {...section('navigation',['login'],{'href:login':'/dashboard'}),menu:[['github','https://github.com/eellak/fossbot'],['harokopioUniversity','https://www.hua.gr/index.php/en/'],['gfoss','https://gfoss.eu/'],['aboutUs','https://hot.dit.hua.gr/']].map(([key,href])=>({title:t(key),href,icon:menuIconId({title:'',href}),linkType:'url' as const}))},
    section('hero',['foss','bot','banner-content.openTechnologies','banner-content.democratizeEducation','banner-content.tryItNow'],{'href:hero':'/dashboard','image:hua':'/landing-media/cms/hua.png','image:bot':'/landing-media/cms/bot.png','image:gfoss':'/landing-media/cms/gfoss.png'}),
    section('about',['title','intro','robotTitle','robotBody','fact2','fact3','fact4','fact5','robotImageAlt','platformTitle','platformBody','mode1','mode2','mode3','mode4','openTitle','openBody','openLink'].map(key=>'landing_about.'+key),{'image:robot':'/landing-media/cms/robot.png','href:open':'https://github.com/eellak/fossbot'}),
    section('features',['landing_features.title','landing_features.intro',...['programming','stages','learning','buddy'].flatMap(story=>['title','description','point1','point2','point3','screenshot'].map(key=>`landing_features.stories.${story}.${key}`))],Object.fromEntries(['python-editor','stage-builder','student-lesson','buddy-panel'].map((name,i)=>['image:'+['programming','stages','learning','buddy'][i],`/landing-media/candidates/${name}-720p.png`]))),
    section('cta',['landing_features.ctaTitle','landing_features.ctaDescription','banner-content.tryItNow','github'],{'href:cta':'/dashboard','href:github':'https://github.com/eellak/fossbot'}),
    section('footer',['footer.rights','footer.fossbotTeam'],{'href:team':'https://hot.dit.hua.gr/','image:footer':'/landing-media/cms/bot.png'})
  ];
}
/** Recognize only the exact old starter; never replace an edited draft. */
export function isOriginalHomeStarter(sections:Section[],t:(key:string)=>string) {
  return sections.length===2 && sections[0].type==='banner' && sections[0].title===`FOSSBot ${t('banner-content.openTechnologies')}` && sections[0].text===t('banner-content.democratizeEducation') && sections[0].buttonLabel===t('banner-content.tryItNow') && sections[0].href==='/dashboard' && sections[1].type==='text' && sections[1].title===t('landing_about.title') && stable(sections[1].content)===stable({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:t('landing_about.intro')}]}]});
}

const stable=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);

export function landingFields(section:Section,t:(key:string)=>string):[string,string][] {
  const defaults=landingSections(t).find(s=>s.group===section.group)?.values||{};
  return Object.entries({...defaults,...section.values});
}
