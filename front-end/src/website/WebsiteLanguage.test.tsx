import React from 'react';
import {act} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import Language from 'src/layouts/full/vertical/header/Language';
import {loadUiPreferences,saveUiPreferences} from 'src/utils/uiPreferences';
declare const it:any,expect:any,jest:any;
const mockDispatch=jest.fn(),mockChangeLanguage=jest.fn(),mockCms=jest.fn();
jest.mock('src/store/Store',()=>({useDispatch:()=>mockDispatch,useSelector:(select:any)=>select({customizer:{isLanguage:'en'}})}));
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key,i18n:{changeLanguage:mockChangeLanguage}})}));
jest.mock('./api',()=>({cms:(...args:any[])=>mockCms(...args),contentLocale:(lang:string)=>lang==='gr'?'el':lang}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

it('offers additional published website languages and dispatches their locale',async()=>{
 mockCms.mockResolvedValue(['en','el','fr-CA']);
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 try{
  await act(async()=>root.render(<Language website/>));
  await act(async()=>container.querySelector('button')!.click());
  const french=Array.from(document.querySelectorAll('[role="menuitem"]')).find(node=>node.textContent?.includes('FR-CA')) as HTMLElement;
  expect(french).toBeDefined();
  await act(async()=>french.click());
  expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({payload:'fr-CA'}));
  expect(mockCms).toHaveBeenCalledWith('/public/locales');
 }finally{act(()=>root.unmount());container.remove();}
});

it('remembers additional language codes on reload and ignores invalid values',()=>{
 saveUiPreferences({language:'fr-CA'});expect(loadUiPreferences().language).toBe('fr-CA');
 saveUiPreferences({language:'bad/locale'});expect(loadUiPreferences().language).toBeUndefined();
 window.localStorage.clear();
});
