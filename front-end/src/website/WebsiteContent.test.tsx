import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WebsiteContent, { websiteHref } from './WebsiteContent';
import { contentLocale, publicPath, type Translation } from './api';
declare const it:any,expect:any;
it('renders structured text and sections without executing embedded HTML',()=>{
 const content:Translation={locale:'el',slug:'test',title:'<script>bad</script>',description:'Περιγραφή',revision:1,sections:[
  {type:'text',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'<img onerror="bad" />'}]}]}},
  {type:'cards',cards:[{title:'Κάρτα',text:'Safe',href:'/dashboard'}]},
  {type:'button',buttonLabel:'Open',href:'/news'},
 ]};
 const html=renderToStaticMarkup(<WebsiteContent content={content} />);
 expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');expect(html).not.toContain('<script>');
 expect(html).toContain('Κάρτα');expect(html).toContain('href="/dashboard"');expect(html).toContain('href="/news"');
});
it('maps Greek interface codes to content locales and generates localized URLs',()=>{
 expect(contentLocale('gr')).toBe('el');expect(contentLocale('en-US')).toBe('en');
 expect(publicPath({kind:'post',locale:'el',slug:'nea'} as any)).toBe('/news/el/nea');
 expect(publicPath({kind:'page',locale:'en',slug:'about'} as any)).toBe('/pages/en/about');
});

it('blocks executable and protocol-relative links even in unsaved previews',()=>{
 expect(websiteHref('javascript:alert(1)')).toBeUndefined();
 expect(websiteHref('//untrusted.example')).toBeUndefined();
 expect(websiteHref('/\\untrusted.example')).toBeUndefined();
 expect(websiteHref('/safe')).toBe('/safe');
 expect(websiteHref('https://example.org')).toBe('https://example.org');
});

it('includes every native landing section and preserves custom drafts during starter upgrades',()=>{
 const {landingSections,isOriginalHomeStarter}=require('./landingDefaults');
 const t=(key:string)=>key;
 const sections=landingSections(t);
 expect(sections.map((s:any)=>s.group)).toEqual(['navigation','hero','about','features','cta','footer']);
 expect(sections[0].menu).toHaveLength(4);
 expect(sections[2].values['landing_about.mode4']).toBe('landing_about.mode4');
 expect(sections[3].values['landing_features.stories.buddy.point3']).toBe('landing_features.stories.buddy.point3');
 const old:any[]=[{type:'banner',title:'FOSSBot banner-content.openTechnologies',text:t('banner-content.democratizeEducation'),buttonLabel:t('banner-content.tryItNow'),href:'/dashboard'},{type:'text',title:t('landing_about.title'),content:{content:[{content:[{text:t('landing_about.intro'),type:'text'}],type:'paragraph'}],type:'doc'}}];
 expect(isOriginalHomeStarter(old,t)).toBe(true);
 old[0].text='My edited introduction';expect(isOriginalHomeStarter(old,t)).toBe(false);
});

it('renders CMS copy in the existing landing layout and scopes repeated button labels',()=>{
 const {landingSections}=require('./landingDefaults');
 const sections=landingSections((key:string)=>key);
 sections.find((s:any)=>s.group==='hero').values['banner-content.tryItNow']='Hero action';
 sections.find((s:any)=>s.group==='cta').values['banner-content.tryItNow']='Closing action';
 sections.find((s:any)=>s.group==='features').values['landing_features.stories.buddy.point3']='Custom assistant detail';
 const html=renderToStaticMarkup(<WebsiteContent content={{locale:'en',slug:'home',title:'FOSSBot',description:'',sections,revision:1}}/>);
 expect(html).toContain('Hero action');expect(html).toContain('Closing action');expect(html).toContain('Custom assistant detail');
 expect(html).toContain('id="about-fossbot"');expect(html).toContain('/landing-media/cms/robot.png');
});

it('offers published CMS destinations in the chosen language using published URLs',()=>{
 const {cmsMenuPages}=require('./WebsiteMenuItemEditor');
 const entries:any[]=[{key:'one',kind:'page',translations:[{locale:'en',title:'Draft',slug:'new-draft-url',published:{locale:'en',title:'Public page',slug:'public-page'}},{locale:'el',published:null}]},{key:'two',kind:'post',translations:[{locale:'en',published:null}]}];
 expect(cmsMenuPages(entries,'en')).toEqual([{title:'Public page',href:'/pages/en/public-page'}]);
 expect(cmsMenuPages(entries,'el')).toEqual([]);
});

it('uses stored icons independent of order and preserves legacy icons by destination',()=>{
 const {menuIcons,menuIconId,WebsiteMenuIcon}=require('./menuIcons');
 expect(menuIcons).toHaveLength(40);
 expect(menuIconId({href:'/news',icon:'robot'})).toBe('robot');
 expect(menuIconId({href:'https://gfoss.eu/'})).toBe('open-source');
 expect(menuIconId({href:'https://gfoss.eu/',icon:''})).toBe('');
 expect(menuIconId({href:'/pages/en/custom'})).toBe('');
 expect(renderToStaticMarkup(<WebsiteMenuIcon id="robot"/>)).toContain('<svg');
 expect(renderToStaticMarkup(<WebsiteMenuIcon id="untrusted"/>)).toBe('');
});

it('renders repeated native components with independent content and a single page heading',()=>{
 const {createWebsiteComponent,insertWebsiteComponent}=require('./componentCatalog');
 const first=createWebsiteComponent('cta',(k:string)=>k);first.values['landing_features.ctaTitle']='First invitation';
 const second=insertWebsiteComponent([first],first)[1];second.values['landing_features.ctaTitle']='Second invitation';
 const html=renderToStaticMarkup(<WebsiteContent content={{locale:'en',slug:'reusable',title:'Reusable page',description:'',sections:[first,second],revision:1}}/>);
 expect(html.match(/First invitation/g)).toHaveLength(1);expect(html.match(/Second invitation/g)).toHaveLength(1);
 expect(html.match(/<h1\b/g)).toHaveLength(1);expect(first.values['landing_features.ctaTitle']).toBe('First invitation');
});

it('inserts reusable components before the global footer without sharing nested state',()=>{
 const {createWebsiteComponent,insertWebsiteComponent,siteSetting}=require('./componentCatalog');
 const {landingSections}=require('./landingDefaults');
 const home=landingSections((k:string)=>k),feature=createWebsiteComponent('feature',(k:string)=>k);
 feature.cards=[{title:'',text:'Point'}];const next=insertWebsiteComponent(home,feature);
 expect(next[next.length-1].group).toBe('footer');expect(next[next.length-2].type).toBe('feature');
 next[next.length-2].cards[0].text='Changed';expect(feature.cards[0].text).toBe('Point');expect(home).toHaveLength(6);
 expect(home.filter((s:any)=>!siteSetting(s)).map((s:any)=>s.group)).toEqual(['hero','about','features','cta']);
});

it('renders generic text/image components with bullets, media and safe actions',()=>{
 const html=renderToStaticMarkup(<WebsiteContent content={{locale:'en',slug:'test',title:'Custom page',description:'',revision:1,sections:[{type:'feature',title:'A reusable lesson',text:'Custom body',image:'/landing-media/cms/robot.png',alt:'Robot example',layout:'image-left',cards:[{title:'',text:'First point'}],href:'/pages/en/lesson',buttonLabel:'Read lesson'}]}}/>);
 expect(html).toContain('Custom body');expect(html).toContain('First point');expect(html).toContain('Robot example');expect(html).toContain('href="/pages/en/lesson"');
});

it('renders people and testimonials with photos, attribution and safe links',()=>{
 const html=renderToStaticMarkup(<WebsiteContent content={{locale:'en',slug:'people',title:'People and feedback',description:'',revision:1,sections:[
  {type:'people',title:'Team',cards:[{title:'Example person',role:'Educator',organization:'Example school',text:'A short biography.',image:'/website/media/101',alt:'Portrait of example person',href:'https://example.org/profile'}]},
  {type:'testimonials',title:'Feedback',cards:[{title:'Example teacher',role:'Teacher',text:'A <script>quote</script>',image:'/website/media/102',alt:'Example author',href:'javascript:bad'}]}
 ]}}/>);
 expect(html).toContain('/website/media/101');expect(html).toContain('/website/media/102');expect(html).toContain('Portrait of example person');
 expect(html).toContain('Educator');expect(html).toContain('Example school');expect(html).toContain('A short biography.');
 expect(html).toContain('<blockquote');expect(html).toContain('&lt;script&gt;quote&lt;/script&gt;');expect(html).not.toContain('href="javascript:');
});

it('creates empty reusable profile components without fabricated endorsements or shared cards',()=>{
 const {componentCatalog,createWebsiteComponent,insertWebsiteComponent}=require('./componentCatalog');
 expect(componentCatalog).toContain('people');expect(componentCatalog).toContain('testimonials');
 const people=createWebsiteComponent('people',(k:string)=>k),testimonials=createWebsiteComponent('testimonials',(k:string)=>k);
 expect(people.cards).toEqual([]);expect(testimonials.cards).toEqual([]);
 people.cards.push({title:'Person',text:'Bio',image:'/website/media/7'});
 const copies=insertWebsiteComponent([people],people);copies[1].cards[0].image='/website/media/8';
 expect(copies[0].cards[0].image).toBe('/website/media/7');
});
it('does not nest post feeds inside the full-article dialog renderer',()=>{
 const html=renderToStaticMarkup(<WebsiteContent articleDialog content={{locale:'en',slug:'news',title:'Article',description:'',revision:1,sections:[{type:'latest-posts',title:'Other news'},{type:'text',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Full story'}]}]}}]}}/>);
 expect(html).toContain('Full story');expect(html).not.toContain('MuiListItemButton');
 const {createWebsiteComponent}=require('./componentCatalog');
 expect(createWebsiteComponent('latest-posts',(key:string)=>key)).toEqual({type:'latest-posts',title:'website.latest-posts'});
});
it('keeps the article title and body while omitting its preview description',()=>{
 const html=renderToStaticMarkup(<WebsiteContent showDescription={false} content={{locale:'en',slug:'article',title:'Article title',description:'Preview summary only',revision:1,sections:[{type:'text',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Full article body'}]}]}}]}}/>);
 expect(html).toContain('Article title');expect(html).toContain('Full article body');expect(html).not.toContain('Preview summary only');
});
it('renders reusable project logos uncropped with descriptions, links and optional funding artwork',()=>{
 const {createWebsiteComponent,insertWebsiteComponent}=require('./componentCatalog');
 const projects=createWebsiteComponent('projects',(key:string)=>key);
 projects.cards=[{title:'S.T.E.P.S.',text:'Robotics for learning',image:'/landing-media/projects/steps-logo.png',alt:'STEPS logo',href:'https://stepsproject.eu/'},{title:'FOSSBot4AI',text:'AI education',href:'javascript:bad'}];
 projects.image='/landing-media/projects/eu-co-funded.png';projects.alt='EU co-funding';projects.fundingText='Acknowledgement';
 const copy=insertWebsiteComponent([],projects)[0];copy.cards[0].title='Independent copy';expect(projects.cards[0].title).toBe('S.T.E.P.S.');
 const html=renderToStaticMarkup(<WebsiteContent content={{locale:'en',title:'Projects page',description:'',slug:'projects',revision:1,sections:[projects]}}/>);
 expect(html).toContain('STEPS logo');expect(html).toContain('/landing-media/projects/steps-logo.png');expect(html).toContain('Robotics for learning');expect(html).toContain('href="https://stepsproject.eu/"');expect(html).not.toContain('javascript:bad');expect(html).toContain('EU co-funding');expect(html).toContain('Acknowledgement');
});
