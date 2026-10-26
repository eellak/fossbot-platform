import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import LatestPosts from './LatestPosts';
import { cms } from './api';
declare const it:any,expect:any,jest:any;
const mockT=(key:string)=>key;
jest.mock('react-i18next',()=>({useTranslation:()=>({t:mockT,i18n:{language:'en'}})}));
jest.mock('./api');
jest.mock('./WebsiteContent',()=>({__esModule:true,default:({content,articleDialog}:any)=><div>{content.sections?.[0]?.text}{articleDialog?' article dialog':''}</div>}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('opens full published articles on demand, closes the dialog and reloads for the page language',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockImplementation(async(path:string)=>path.startsWith('/public/posts/latest')?[{key:'post-1',kind:'post',locale:path.endsWith('el')?'el':'en',title:'Latest classroom news',description:'Short preview description',slug:'classroom',thumbnail:'/website/media/1',publishedAt:'2026-10-26T10:00:00'}]:{title:'Latest classroom news',description:'Summary hidden in the full article',sections:[{text:'Full published story'}]});
 try{
  await act(async()=>root.render(<LatestPosts locale="en"/>));
  expect(container.textContent).toContain('Latest classroom news');expect(container.textContent).toContain('Short preview description');expect(container.textContent).toContain('website.readMore');
  expect(mockCms).toHaveBeenCalledTimes(1);expect(container.querySelector('img')?.getAttribute('src')).toContain('/website/media/1');
  await act(async()=>(container.querySelector('[aria-label="website.readMore: Latest classroom news"]') as HTMLElement).click());
  expect(mockCms).toHaveBeenCalledWith('/public/post-1/en');expect(document.body.textContent).toContain('Full published story article dialog');expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Summary hidden in the full article');
  const close=document.querySelector('[aria-label="website.close"]') as HTMLElement;
  await act(async()=>close.click());
  await act(async()=>root.render(<LatestPosts locale="el"/>));
  expect(mockCms).toHaveBeenCalledWith('/public/posts/latest?locale=el');
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,250));});
  expect(document.querySelector('[role="dialog"]')).toBeNull();
 }finally{act(()=>root.unmount());container.remove();}
});
it('handles feed failures with retry and an empty published-post state',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const mockCms=cms as any;mockCms.mockReset();mockCms.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
 try{
  await act(async()=>root.render(<LatestPosts locale="en"/>));expect(container.textContent).toContain('website.postsLoadError');
  await act(async()=>(container.querySelector('button') as HTMLElement).click());expect(container.textContent).toContain('website.noPosts');
 }finally{act(()=>root.unmount());container.remove();}
});
