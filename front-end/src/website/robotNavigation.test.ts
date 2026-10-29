import { withRobotNavigation } from './robotNavigation';
import { landingFields, landingSections } from './landingDefaults';
import type { Section } from './api';
declare const it: any, expect: any;
it('upgrades an older menu without duplicating the robot link or changing existing links', () => {
  const old: Section = { type: 'landing', group: 'navigation', menu: [{id:'custom',title:'Custom',href:'/news',icon:'news'}] };
  const upgraded = withRobotNavigation(old, 'The robot');
  expect(upgraded.menu?.map(x=>x.href)).toEqual(['/robot','/news']);
  expect(old.menu).toHaveLength(1);
  expect(withRobotNavigation(upgraded,'Other')).toBe(upgraded);
  expect(withRobotNavigation({...old,menu:[{title:'My robot',href:'/robot',icon:'star'}]},'The robot').menu).toEqual([{title:'My robot',href:'/robot',icon:'star'}]);
});
it('respects saved order, title, icon and removal after the upgrade', () => {
  const first = withRobotNavigation({type:'landing',group:'navigation',menu:[]},'The robot');
  const edited = {...first,menu:[{title:'News',href:'/news'},{...first.menu![0],title:'Build FOSSBot',icon:'tool'}]};
  expect(withRobotNavigation(edited,'The robot')).toBe(edited);
  const removed={...edited,menu:edited.menu.filter(x=>x.href!=='/robot')};
  expect(withRobotNavigation(removed,'The robot').menu).toHaveLength(1);
  expect(landingFields(first,x=>x).some(([key])=>key==='robotMenuInstalled')).toBe(false);
  expect(landingSections(x=>x)[0].menu?.[0].href).toBe('/robot');
});
