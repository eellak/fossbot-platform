import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { backendUrl } from 'src/utils/backendUrl';
import { cms } from './api';
type ApiToken={id:number;name:string;prefix:string;allow_publish:boolean;created_at:string;expires_at:string;last_used_at:string|null;revoked_at:string|null};
const utcDate=(value:string)=>new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value+'Z');
export default function WebsiteApiTokens() {
 const {token}=useAuth(),{t}=useTranslation(),confirm=useConfirmDialog();const label=(key:string)=>String(t('website.apiTokens.'+key));
 const [items,setItems]=useState<ApiToken[]>([]),[name,setName]=useState(''),[days,setDays]=useState(90),[publish,setPublish]=useState(false),[secret,setSecret]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;cms<ApiToken[]>('/api-tokens',token).then(data=>{if(active)setItems(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const create=()=>run(async()=>{const created=await cms<ApiToken&{token:string}>('/api-tokens',token,'POST',{name,expires_in_days:days,allow_publish:publish});setSecret(created.token);const {token:once,...metadata}=created;setItems(current=>[metadata,...current]);setName('');setPublish(false);});
 const revoke=(item:ApiToken)=>run(async()=>{if(!await confirm.confirm({title:label('revoke'),message:label('revokeHelp')}))return;const updated=await cms<ApiToken>(`/api-tokens/${item.id}/revoke`,token,'POST');setItems(current=>current.map(row=>row.id===updated.id?updated:row));});
 const base=new URL(backendUrl||'/api',window.location.origin).href.replace(/\/$/,'');
 const example=String.raw`curl --request POST '${base}/website/api/posts' \
  --header "Authorization: Bearer $FOSSBOT_API_TOKEN" \
  --header 'Content-Type: application/json' \
  --data @post.json`;
 const payload=JSON.stringify({locale:'en',slug:'robotics-workshop',title:'Robotics workshop',description:'Activities from our classroom.',sections:[{type:'text',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Today we explored robotics.'}]}]}}],photos:[{media_id:1,alt:'Workshop photo'}],publish:false},null,2);
 return <Stack spacing={3}>
  <Typography variant="h4">{label('title')}</Typography><Alert severity="info">{label('help')}</Alert>
  {error&&<Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
  <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}><TextField disabled={busy} label={label('name')} value={name} onChange={e=>setName(e.target.value)} inputProps={{maxLength:100}}/><TextField disabled={busy} type="number" label={label('expiry')} value={days} onChange={e=>setDays(Number(e.target.value))} inputProps={{min:1,max:365}}/><FormControlLabel control={<Checkbox checked={publish} disabled={busy} onChange={e=>setPublish(e.target.checked)}/>} label={label('allowPublish')}/><Button variant="contained" sx={{alignSelf:'flex-start'}} disabled={busy||!name.trim()||!Number.isInteger(days)||days<1||days>365} onClick={()=>void create()}>{label('create')}</Button></Stack></Paper>
  {!items.length&&<Typography color="text.secondary">{label('empty')}</Typography>}
  {items.map(item=>{const expired=utcDate(item.expires_at).getTime()<=Date.now();return <Paper key={item.id} variant="outlined" sx={{p:2}}><Stack spacing={1}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h6">{item.name}</Typography><Chip size="small" label={label(item.revoked_at?'revoked':expired?'expired':'active')}/><Chip size="small" label={label(item.allow_publish?'publishing':'draftOnly')}/></Stack><Typography variant="body2">{item.prefix}… · {label('expires')}: {utcDate(item.expires_at).toLocaleString()}</Typography><Typography variant="caption" color="text.secondary">{label('lastUsed')}: {item.last_used_at?utcDate(item.last_used_at).toLocaleString():label('never')}</Typography><Button color="error" disabled={busy||!!item.revoked_at} onClick={()=>void revoke(item)} sx={{alignSelf:'flex-start'}}>{label('revoke')}</Button></Stack></Paper>;})}
  <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}><Typography variant="h5">{label('usage')}</Typography><Typography>{label('uploadHelp')}</Typography><Typography component="code" sx={{overflowWrap:'anywhere'}}>{base}/website/api/media</Typography><Typography>{label('exampleHelp')}</Typography><Box component="pre" sx={{m:0,p:2,bgcolor:'action.hover',overflow:'auto'}}>{example}</Box><Typography>post.json</Typography><Box component="pre" sx={{m:0,p:2,bgcolor:'action.hover',overflow:'auto'}}>{payload}</Box><Typography variant="caption">{label('cliHelp')}</Typography></Stack></Paper>
  <Dialog open={secret!==null} onClose={()=>setSecret(null)} fullWidth maxWidth="sm"><DialogTitle>{label('created')}</DialogTitle><DialogContent><Stack spacing={2}><Alert severity="info">{label('once')}</Alert><TextField label={label('bearer')} value={secret||''} fullWidth multiline autoComplete="off" inputProps={{readOnly:true,spellCheck:false}}/><Button onClick={()=>void run(async()=>{await navigator.clipboard.writeText(secret||'');setMessage(label('copied'));})}>{label('copy')}</Button></Stack></DialogContent><DialogActions><Button onClick={()=>setSecret(null)}>{label('done')}</Button></DialogActions></Dialog>
 </Stack>;
}
