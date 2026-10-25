import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import PageContainer from 'src/components/container/PageContainer';
import PageHeader from 'src/components/shared/PageHeader';
import ListCard from 'src/components/shared/ListCard';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import RichTextEditor from 'src/components/courses/RichTextEditor';
import { backendUrl } from 'src/utils/backendUrl';
import { cms, contentLocale, emptyDocument, publicPath, type Entry, type Translation, type Section, type Media, type WebsiteRole } from './api';
import WebsiteContent from './WebsiteContent';

export default function WebsiteEditor() {
  const { token } = useAuth(), { t, i18n } = useTranslation(), confirm = useConfirmDialog();
  const label = (key: string) => t(`website.${key}`);
  const [role,setRole] = useState<WebsiteRole>('none'), [loaded,setLoaded] = useState(false);
  const [entries,setEntries] = useState<Entry[]>([]), [key,setKey] = useState(''), [locale,setLocale] = useState(contentLocale(i18n.language));
  const [form,setForm] = useState<Translation|null>(null), [dirty,setDirty] = useState(false);
  const [error,setError] = useState(''), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  const [tab,setTab] = useState(0), [preview,setPreview] = useState(false);
  const [history,setHistory] = useState<{revision:number;snapshot:Translation;createdAt:string}[]|null>(null);
  const [media,setMedia] = useState<Media[]>([]), [mediaIndex,setMediaIndex] = useState<number|null>(null);
  const [grants,setGrants] = useState<{id:number;username:string;role:string}[]>([]);
  const [kind,setKind] = useState<Entry['kind']>('page');
  const parent = entries.find(e=>e.key===key);
  const canPublish = role === 'admin' || role === 'editor';
  const refresh = async () => { const all = await cms<Entry[]>('/entries',token); setEntries(all); return all; };
  useEffect(() => {
    let cancelled=false;
    cms<{role:WebsiteRole}>('/access',token).then(async result => {
      if(cancelled)return; setRole(result.role);
      if(result.role!=='none') { const all=await cms<Entry[]>('/entries',token); if(!cancelled)setEntries(all); }
    }).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoaded(true);});
    return ()=>{cancelled=true;};
  },[token]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  const run = async (action:()=>Promise<void>) => { setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);} };
  const blank = (entry:Entry,lang:string):Translation => {
    const fixed = i18n.getFixedT(lang==='el'?'gr':lang);
    return {locale:lang,slug:entry.kind==='home'?'home':`${entry.kind}-${entry.key.slice(0,8)}`,title:entry.kind==='home'?'FOSSBot':label('untitled'),description:'',sections:entry.kind==='home'?[
      {type:'banner',title:`FOSSBot ${fixed('banner-content.openTechnologies')}`,text:fixed('banner-content.democratizeEducation'),buttonLabel:fixed('banner-content.tryItNow'),href:'/dashboard'},
      {type:'text',title:fixed('landing_about.title'),content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:fixed('landing_about.intro')}]}]}}]:[{type:'text',content:emptyDocument}],revision:0};
  };
  const mayLeave = async () => !dirty || await confirm.confirm({title:label('unsaved'),message:label('discard'),confirmLabel:label('continue')});
  const open = async (entry:Entry,lang=locale) => {
    if(busy || !await mayLeave())return;
    setKey(entry.key);setLocale(lang);setForm(structuredClone(entry.translations.find(x=>x.locale===lang)||blank(entry,lang)));setDirty(!entry.translations.some(x=>x.locale===lang));setError('');setMessage('');
  };
  const change = (patch:Partial<Translation>) => {if(busy)return;setForm(current=>current?{...current,...patch}:current);setDirty(true);setMessage('');};
  const section = (index:number,patch:Partial<Section>) => {if(form)change({sections:form.sections.map((s,i)=>i===index?{...s,...patch}:s)});};
  const move = (index:number,direction:number) => {if(!form)return;const copy=[...form.sections];[copy[index],copy[index+direction]]=[copy[index+direction],copy[index]];change({sections:copy});};
  const save = () => run(async()=>{
    if(!form)return;
    const updated=await cms<Translation>(`/entries/${key}/${locale}`,token,'PUT',{...form,expectedRevision:form.revision});
    setForm(updated);setDirty(false);await refresh();setMessage(label('saved'));
  });
  const publish = (action:'publish'|'unpublish') => run(async()=>{
    if(!form || dirty)return;
    if(!await confirm.confirm({title:label(action),message:label(action==='publish'?'publishHelp':'unpublishHelp')}))return;
    const updated=await cms<Translation>(`/entries/${key}/${locale}/${action}?expectedRevision=${form.revision}`,token,'POST');
    setForm(updated);await refresh();setMessage(label(action==='publish'?'published':'unpublished'));
  });
  const addLanguage = async()=>{
    if(!parent)return;
    const lang=await confirm.prompt({title:label('addLanguage'),inputLabel:label('languageCode'),defaultValue:'fr',inputRequired:true});
    if(lang && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(lang))await open(parent,lang);
    else if(lang)setError(label('languageCode'));
  };
  const chooseImage = (index:number)=>run(async()=>{setMedia(await cms<Media[]>('/media',token));setMediaIndex(index);});
  const upload = (file:File)=>run(async()=>{
    if(file.size>5*1024*1024)throw new Error(label('imageLimit'));
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
    const image=await cms<Media>('/media',token,'POST',{filename:file.name,data});setMedia(current=>[image,...current]);
  });
  const tools = {content:label('content'),bold:label('bold'),italic:label('italic'),code:label('code'),heading:label('heading'),bullets:label('bullets'),numbered:label('numbered')};
  if(!loaded)return <Typography role="status">{label('loading')}</Typography>;
  if(role==='none')return <Alert severity="info">{error||label('noAccess')}</Alert>;
  return <PageContainer title={label('title')} description={label('subtitle')}>
    <Stack spacing={3}>
      <PageHeader title={label('title')} description={label('subtitle')} action={<Button href="/landing-page" variant="outlined">{label('viewWebsite')}</Button>} />
      {error&&<Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
      <Tabs value={tab} onChange={(_,value)=>{setTab(value);if(value===1)void run(async()=>setGrants(await cms('/permissions',token)));}}>
        <Tab disabled={busy} label={label('pagesPosts')} />{role==='admin'&&<Tab disabled={busy} label={label('permissions')} />}
      </Tabs>
      {tab===1 ? <Stack spacing={2}><Typography>{label('permissionHelp')}</Typography>{grants.map(person=><Paper variant="outlined" key={person.id} sx={{p:2}}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography>{person.username}</Typography><TextField select size="small" label={label('role')} value={person.role} disabled={busy||person.role==='admin'} onChange={event=>void run(async()=>{await cms('/permissions',token,'PUT',{user_id:person.id,role:event.target.value});setGrants(await cms('/permissions',token));})} sx={{minWidth:180}}>
          {['none','contributor','editor','admin'].map(r=><MenuItem key={r} value={r} disabled={r==='admin'}>{label(r)}</MenuItem>)}
        </TextField></Stack></Paper>)}</Stack> : <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',lg:'300px minmax(0,1fr)'},gap:3,alignItems:'start'}}>
        <Stack spacing={2}>
          <Stack direction="row" gap={1}><TextField disabled={busy} select size="small" label={label('type')} value={kind} onChange={e=>setKind(e.target.value as Entry['kind'])} sx={{flex:1}}>{['home','page','post'].map(k=><MenuItem key={k} value={k}>{label(k)}</MenuItem>)}</TextField>
            <Button variant="contained" disabled={busy} onClick={()=>void run(async()=>{if(!await mayLeave())return;const created=await cms<Entry>('/entries',token,'POST',{kind});const all=await refresh();setDirty(!all.find(e=>e.key===created.key)?.translations.some(x=>x.locale===locale));setKey(created.key);setForm(structuredClone(all.find(e=>e.key===created.key)?.translations.find(x=>x.locale===locale)||blank(created,locale)));})}>{label('create')}</Button></Stack>
          {entries.length===0&&<Alert severity="info">{label('empty')}</Alert>}
          {entries.map(e=><ListCard key={e.key} title={e.translations.find(x=>x.locale===locale)?.title||e.translations[0]?.title||label(e.kind)} meta={<Typography variant="caption">{label(e.kind)} · {e.translations.map(x=>x.locale).join(', ')||label('noTranslations')}</Typography>}
            status={e.key===key?<Chip size="small" label={label('editing')} />:undefined} onOpen={()=>void open(e)} openLabel={`${label('edit')} ${e.translations.find(x=>x.locale===locale)?.title||e.translations[0]?.title||label(e.kind)}`} />)}
        </Stack>
        {!form ? <Alert severity="info">{label('selectPage')}</Alert> : <Stack spacing={2} key={`${key}-${locale}`}>
          <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}>
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center"><TextField select size="small" label={label('language')} value={locale} onChange={e=>parent&&void open(parent,e.target.value)} disabled={busy} sx={{minWidth:160}}>{Array.from(new Set(['en','el',locale,...(parent?.translations.map(x=>x.locale)||[])])).map(lang=><MenuItem key={lang} value={lang}>{lang==='en'?'English':lang==='el'?'Ελληνικά':lang}</MenuItem>)}</TextField>
              <Button onClick={()=>void addLanguage()} disabled={busy}>{label('addLanguage')}</Button><Chip size="small" label={form.published?label('hasPublished'):label('draft')} />{dirty&&<Chip size="small" color="warning" label={label('unsaved')} />}
            </Stack>
            <TextField disabled={busy} label={label('pageTitle')} value={form.title} onChange={e=>change({title:e.target.value})} inputProps={{maxLength:200}} />
            <TextField disabled={busy} label={label('slug')} value={form.slug} onChange={e=>change({slug:e.target.value})} helperText={label('slugHelp')} />
            <TextField disabled={busy} label={label('description')} value={form.description} onChange={e=>change({description:e.target.value})} multiline minRows={2} inputProps={{maxLength:500}} />
            <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="contained" disabled={busy||!dirty} onClick={()=>void save()}>{label('saveDraft')}</Button><Button variant="outlined" disabled={busy} onClick={()=>setPreview(true)}>{label('preview')}</Button>
              {canPublish&&<><Button variant="outlined" disabled={busy||dirty||!form.revision} onClick={()=>void publish('publish')}>{label('publish')}</Button><Button disabled={busy||dirty||!form.published} onClick={()=>void publish('unpublish')}>{label('unpublish')}</Button></>}
              {form.published&&parent&&<Button href={publicPath({...form.published,key,kind:parent.kind})} target="_blank" rel="noopener noreferrer">{label('viewWebsite')}</Button>}
              <Button disabled={busy||!form.revision} onClick={()=>void run(async()=>setHistory(await cms(`/entries/${key}/${locale}/history`,token)))}>{label('history')}</Button>
            </Stack><Typography variant="caption" color="text.secondary">{label(canPublish?'saveBeforePublish':'contributorHelp')}</Typography>
            {parent?.kind==='home'&&<Alert severity="info">{label('homeHelp')}</Alert>}
          </Stack></Paper>
          {form.sections.map((s,index)=><Paper variant="outlined" key={index} sx={{p:2}}><Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Typography variant="h5">{index+1}. {label(s.type)}</Typography><Stack direction="row"><Button disabled={busy||index===0} onClick={()=>move(index,-1)} aria-label={label('moveUp')}>{label('moveUp')}</Button><Button disabled={busy||index===form.sections.length-1} onClick={()=>move(index,1)} aria-label={label('moveDown')}>{label('moveDown')}</Button><Button color="error" onClick={()=>change({sections:form.sections.filter((_,i)=>i!==index)})}>{label('remove')}</Button></Stack></Stack>
            <TextField disabled={busy} size="small" label={label('sectionTitle')} value={s.title||''} onChange={e=>section(index,{title:e.target.value})} />
            {s.type==='text'&&<RichTextEditor disabled={busy} value={s.content||emptyDocument} onChange={content=>section(index,{content})} labels={tools} />}
            {s.type==='banner'&&<TextField disabled={busy} label={label('content')} value={s.text||''} onChange={e=>section(index,{text:e.target.value})} multiline minRows={3} />}
            {s.type==='image'&&<><Button variant="outlined" onClick={()=>void chooseImage(index)}>{label('chooseImage')}</Button>{s.image&&<Box component="img" src={`${backendUrl}${s.image}`} alt={s.alt||''} sx={{maxWidth:'100%',maxHeight:220,objectFit:'contain'}} />}<TextField disabled={busy} label={label('alt')} value={s.alt||''} onChange={e=>section(index,{alt:e.target.value})} /></>}
            {(s.type==='banner'||s.type==='button')&&<><TextField disabled={busy} label={label('buttonLabel')} value={s.buttonLabel||''} onChange={e=>section(index,{buttonLabel:e.target.value})} /><TextField disabled={busy} label={label('link')} value={s.href||''} onChange={e=>section(index,{href:e.target.value})} helperText={label('linkHelp')} /></>}
            {s.type==='cards'&&<>{(s.cards||[]).map((card,i)=><Stack spacing={1} key={i} sx={{p:2,border:1,borderColor:'divider',borderRadius:1}}>{(['title','text','href'] as const).map(field=><TextField key={field} size="small" label={label(field==='href'?'link':field==='text'?'content':'sectionTitle')} value={card[field]||''} onChange={e=>section(index,{cards:s.cards?.map((c,j)=>j===i?{...c,[field]:e.target.value}:c)})} />)}<Button onClick={()=>section(index,{cards:s.cards?.filter((_,j)=>j!==i)})}>{label('remove')}</Button></Stack>)}<Button disabled={(s.cards?.length||0)>=12} onClick={()=>section(index,{cards:[...(s.cards||[]),{title:'',text:''}]})}>{label('addCard')}</Button></>}
          </Stack></Paper>)}
          <Paper variant="outlined" sx={{p:2}}><Typography variant="h6" sx={{mb:1}}>{label('addSection')}</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{(['banner','text','image','cards','button'] as const).map(type=><Button key={type} disabled={busy||form.sections.length>=40} variant="outlined" onClick={()=>change({sections:[...form.sections,{type,...(type==='text'?{content:emptyDocument}:{})}]})}>{label(type)}</Button>)}</Stack></Paper>
        </Stack>}
      </Box>}
    </Stack>
    <Dialog open={preview} onClose={()=>setPreview(false)} maxWidth="lg" fullWidth><DialogTitle>{label('draftPreview')}</DialogTitle><DialogContent>{form&&<WebsiteContent content={form} />}</DialogContent><DialogActions><Button onClick={()=>setPreview(false)}>{label('close')}</Button></DialogActions></Dialog>
    <Dialog open={history!==null} onClose={()=>setHistory(null)} maxWidth="sm" fullWidth><DialogTitle>{label('history')}</DialogTitle><DialogContent><Stack spacing={2}>{history?.map(item=><Box key={item.revision}><Typography>{label('revision')} {item.revision} · {new Date(item.createdAt).toLocaleString()}</Typography><Button onClick={()=>{if(form)change({...item.snapshot,revision:form.revision,published:form.published});setHistory(null);}}>{label('restoreDraft')}</Button><Divider /></Box>)}</Stack></DialogContent><DialogActions><Button onClick={()=>setHistory(null)}>{label('close')}</Button></DialogActions></Dialog>
    <Dialog open={mediaIndex!==null} onClose={()=>setMediaIndex(null)} fullWidth maxWidth="md"><DialogTitle>{label('media')}</DialogTitle><DialogContent>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}<Button variant="outlined" component="label" disabled={busy}>{label('upload')}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}} /></Button><Typography variant="caption" sx={{display:'block',my:1}}>{label('imageLimit')}</Typography><Box sx={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:2}}>{media.map(image=><Button key={image.id} variant="outlined" onClick={()=>{if(mediaIndex!==null)section(mediaIndex,{image:image.url});setMediaIndex(null);}}><Stack><Box component="img" src={`${backendUrl}${image.url}`} alt="" sx={{width:120,height:90,objectFit:'contain'}} /><Typography variant="caption" sx={{overflowWrap:'anywhere'}}>{image.filename}</Typography></Stack></Button>)}</Box></DialogContent><DialogActions><Button onClick={()=>setMediaIndex(null)}>{label('close')}</Button></DialogActions></Dialog>
  </PageContainer>;
}
