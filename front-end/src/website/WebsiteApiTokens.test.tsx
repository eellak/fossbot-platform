import React from 'react';
import {act, Simulate} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import WebsiteApiTokens from './WebsiteApiTokens';
import {cms} from './api';
declare const it:any,expect:any,jest:any;
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
jest.mock('src/authentication/AuthProvider',()=>({useAuth:()=>({token:'session-token'})}));
jest.mock('src/components/shared/ConfirmDialog',()=>({useConfirmDialog:()=>({confirm:async()=>true})}));
jest.mock('./api');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows a created credential once, clears it on close, and revokes through the session API',async()=>{
 jest.useFakeTimers();
 const container=document.createElement('div');document.body.appendChild(container);const root=createRoot(container);
 const metadata={id:7,name:'My PC',prefix:'fbwp_example',allow_publish:false,created_at:'2026-10-26T00:00:00',expires_at:'2099-10-26T00:00:00',last_used_at:null,revoked_at:null};
 const secret='fbwp_private_test_credential';
 const mocked=cms as any;mocked.mockReset();mocked.mockResolvedValueOnce([]);
 const button=(key:string)=>Array.from(document.querySelectorAll('button')).find(node=>node.textContent==='website.apiTokens.'+key)!;
 try {
  await act(async()=>root.render(<WebsiteApiTokens/>));
  const input=container.querySelector('input[type="text"]')!;
  act(()=>Simulate.change(input,{target:{value:'My PC'}} as any));
  mocked.mockResolvedValueOnce({...metadata,token:secret});
  await act(async()=>button('create').click());
  expect(mocked).toHaveBeenLastCalledWith('/api-tokens','session-token','POST',{name:'My PC',expires_in_days:90,allow_publish:false});
  expect(Array.from(document.querySelectorAll('textarea')).some(node=>node.value===secret)).toBe(true);
  act(()=>button('done').click());act(()=>jest.advanceTimersByTime(1000));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(Array.from(document.querySelectorAll('textarea')).some(node=>node.value===secret)).toBe(false);
  expect(container.innerHTML).not.toContain(secret);
  expect(container.textContent).toContain(metadata.prefix);
  mocked.mockResolvedValueOnce({...metadata,revoked_at:'2026-10-26T01:00:00'});
  await act(async()=>button('revoke').click());
  expect(mocked).toHaveBeenLastCalledWith('/api-tokens/7/revoke','session-token','POST');
  expect(button('revoke').disabled).toBe(true);
 } finally {act(()=>root.unmount());container.remove();jest.useRealTimers();}
});
