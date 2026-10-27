import React from 'react';
import {act} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import WebsiteEditor from './WebsiteEditor';
import {cms} from './api';
declare const it:any,expect:any,jest:any;
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key,i18n:{language:'en',getFixedT:()=>((key:string)=>key)}})}));
jest.mock('src/authentication/AuthProvider',()=>({useAuth:()=>({token:'session-token'})}));
jest.mock('src/components/shared/ConfirmDialog',()=>({useConfirmDialog:()=>({confirm:async()=>true,prompt:async()=>'fr-CA'})}));
jest.mock('./api');
jest.mock('./WebsiteApiTokens',()=>()=> 'API token panel');
jest.mock('./WebsiteContent',()=>()=>null);
jest.mock('./WebsiteComponentLibrary',()=>()=>null);
jest.mock('./WebsiteProfileCardsEditor',()=>()=>null);
jest.mock('src/components/courses/RichTextEditor',()=>()=>null);
jest.mock('src/components/landingpage/header/Header',()=>()=>null);
jest.mock('src/components/landingpage/footer/Footer',()=>()=>null);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('switches between pages, permissions and API tokens when opened through the API link',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockImplementation(async(path:string)=>path==='/access'?{role:'admin'}:path==='/permissions'?[{id:1,username:'Example admin',role:'admin'}]:[]);
 const click=async(label:string)=>{const tab=Array.from(container.querySelectorAll('[role="tab"]')).find(node=>node.textContent===label) as HTMLElement;expect(tab).toBeDefined();await act(async()=>tab.click());expect(tab.getAttribute('aria-selected')).toBe('true');};
 try {
  await act(async()=>root.render(<MemoryRouter initialEntries={['/website-admin?tab=api']}><WebsiteEditor/></MemoryRouter>));
  expect(container.textContent).toContain('API token panel');
  await click('website.pages');expect(container.textContent).toContain('website.selectPage');expect(container.textContent).not.toContain('API token panel');
  await click('website.permissions');expect(container.textContent).toContain('Example admin');expect(container.textContent).not.toContain('website.selectPage');
  await click('website.apiTokens.title');expect(container.textContent).toContain('API token panel');expect(container.textContent).not.toContain('Example admin');
  await click('website.pages');expect(container.textContent).toContain('website.selectPage');
 } finally {act(()=>root.unmount());container.remove();}
});
it('offers recoverable page and upload deletion with restore controls',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 let trashed=false,photoTrashed=false;
 const item={key:'test-page',kind:'page',translations:[{locale:'en',title:'Disposable test page'}]};
 const image={id:99,filename:'Disposable.png',url:'/website/media/99'};
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockImplementation(async(path:string,_token:string,method:string)=>{
  if(path==='/access')return {role:'admin'};
  if(path==='/entries/test-page'&&method==='DELETE'){trashed=true;return {ok:true};}
  if(path==='/entries/test-page/restore'){trashed=false;return {ok:true};}
  if(path==='/entries')return trashed?[]:[item];
  if(path==='/entries?trashed=true')return trashed?[item]:[];
  if(path==='/media/99'&&method==='DELETE'){photoTrashed=true;return {ok:true};}
  if(path==='/media/99/restore'){photoTrashed=false;return {ok:true};}
  if(path==='/media')return photoTrashed?[]:[image];
  if(path==='/media?trashed=true')return photoTrashed?[image]:[];
  return [];
 });
 const click=async(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(node=>node.textContent===text||node.getAttribute('aria-label')===text);expect(button).toBeDefined();await act(async()=>button!.click());};
 try{
  await act(async()=>root.render(<MemoryRouter><WebsiteEditor/></MemoryRouter>));
  await click('website.deleteEntry');expect(trashed).toBe(true);expect(container.textContent).not.toContain('Disposable test page');
  await click('website.trash');expect(container.textContent).toContain('Disposable test page');
  await click('website.restore');expect(trashed).toBe(false);
  await click('website.media');expect(document.body.textContent).toContain('Disposable.png');
  await click('website.deletePhoto');expect(photoTrashed).toBe(true);
  // Scope to the dialog because the page also has its own Trash control.
  const dialog=document.querySelector('[role="dialog"]')!;
  const trashButton=Array.from(dialog.querySelectorAll('button')).find(node=>node.textContent==='website.trash')!;
  await act(async()=>trashButton.click());expect(dialog.textContent).toContain('Disposable.png');
  await click('website.restore');expect(photoTrashed).toBe(false);
  expect(mockCms).toHaveBeenCalledWith('/media/99','session-token','DELETE');
  expect(mockCms).toHaveBeenCalledWith('/media/99/restore','session-token','POST');
 }finally{act(()=>root.unmount());container.remove();}
});
it('separates pages and posts for editors and creates posts from the Posts tab',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockImplementation(async(path:string,_token:string,method:string)=>path==='/access'?{role:'editor'}:path==='/entries'&&method==='POST'?{key:'created',kind:'post',translations:[]}:path==='/entries'?[{key:'page',kind:'page',translations:[{title:'Public page',locale:'en'}]},{key:'post',kind:'post',translations:[{title:'News article',locale:'en'}]}]:[]);
 try{
  await act(async()=>root.render(<MemoryRouter><WebsiteEditor/></MemoryRouter>));
  expect(container.textContent).toContain('Public page');expect(container.textContent).not.toContain('News article');
  const tab=Array.from(container.querySelectorAll('[role="tab"]')).find(node=>node.textContent==='website.posts') as HTMLElement;
  await act(async()=>tab.click());expect(tab.getAttribute('aria-selected')).toBe('true');
  expect(container.textContent).toContain('News article');expect(container.textContent).not.toContain('Public page');
  const create=Array.from(container.querySelectorAll('button')).find(node=>node.textContent==='website.create')!;
  await act(async()=>create.click());expect(mockCms).toHaveBeenCalledWith('/entries','session-token','POST',{kind:'post'});
 }finally{act(()=>root.unmount());container.remove();}
});

it('starts a new language on the same entry with the existing components and draft-only state',async()=>{
 (globalThis as any).structuredClone=(value:any)=>JSON.parse(JSON.stringify(value));
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const source={locale:'en',title:'English page',slug:'example',description:'Source description',revision:4,published:{title:'Live title'},sections:[{id:'intro',type:'banner',title:'Welcome',text:'Translate this'}]};
 const item={key:'same-page',kind:'page',translations:[source]};
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockImplementation(async(path:string,_token:string,method:string,body:any)=>path==='/access'?{role:'editor'}:method==='PUT'?{...body,revision:1}:path==='/entries'?[item]:[]);
 const click=async(text:string)=>{const button=Array.from(container.querySelectorAll('button')).find(node=>node.textContent===text||node.getAttribute('aria-label')===text);expect(button).toBeDefined();await act(async()=>button!.click());};
 try{
  await act(async()=>root.render(<MemoryRouter><WebsiteEditor/></MemoryRouter>));
  await click('website.edit English page');
  await click('website.addLanguage');
  expect(container.textContent).toContain('fr-CA');
  expect(container.textContent).toContain('website.translationStarterHelp');
  await click('website.saveDraft');
  const save=mockCms.mock.calls.find((args:any[])=>args[2]==='PUT');
  expect(save[0]).toBe('/entries/same-page/fr-CA');
  expect(save[3]).toMatchObject({locale:'fr-CA',title:'English page',expectedRevision:0,published:null,sections:source.sections});
  expect(item.translations).toHaveLength(1);
 }finally{act(()=>root.unmount());container.remove();}
});
