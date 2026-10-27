import { insertWebsiteComponent } from './componentCatalog';
import type { Section } from './api';
declare const it:any,expect:any;

it('gives copied components and their cards/menu fresh identities',()=>{
  const source:Section={id:'source',type:'people',cards:[{id:'person',title:'Name',text:'Biography'}]};
  const result=insertWebsiteComponent([source],source,0);
  expect(result[0]).toBe(source);
  expect(result[1].id).not.toBe(source.id);
  expect(result[1].cards?.[0].id).not.toBe(source.cards?.[0].id);
  expect(result[1].cards?.[0].text).toBe('Biography');
  result[1].cards![0].text='Changed';
  expect(source.cards![0].text).toBe('Biography');
  const again=insertWebsiteComponent(result,source);
  expect(new Set(again.map(section=>section.id)).size).toBe(3);
});
