import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WebsiteApiTokens from './WebsiteApiTokens';
import { IconTrash, IconX } from '@tabler/icons-react';
import { Alert, Box, Button, Chip, IconButton, Tooltip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
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
import WebsiteComponentLibrary from './WebsiteComponentLibrary';
import { componentId, insertWebsiteComponent, siteSetting } from './componentCatalog';
import WebsiteProfileCardsEditor from './WebsiteProfileCardsEditor';
import WebsiteMenuItemEditor from './WebsiteMenuItemEditor';
import { withRobotNavigation } from './robotNavigation';
import { landingSections, landingFields } from './landingDefaults';
import { LandingProvider, PublishedLandingProvider, landingImage } from './LandingContext';
import LpHeader from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';

export default function WebsiteEditor() {
  const [searchParams]=useSearchParams();
  const { token } = useAuth(), { t, i18n } = useTranslation(), confirm = useConfirmDialog();
  const label = (key: string) => t(`website.${key}`);
  const [role,setRole] = useState<WebsiteRole>('none'), [loaded,setLoaded] = useState(false);
  const [entries,setEntries] = useState<Entry[]>([]), [key,setKey] = useState(''), [locale,setLocale] = useState(contentLocale(i18n.language));
  const [form,setForm] = useState<Translation|null>(null), [dirty,setDirty] = useState(false);
  const [error,setError] = useState(''), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  const [componentLibrary,setComponentLibrary]=useState(false),[homeArea,setHomeArea]=useState('content');
  const [tab,setTab] = useState(searchParams.get('tab')==='api'?2:searchParams.get('tab')==='posts'?3:0), [preview,setPreview] = useState(false);
  const [history,setHistory] = useState<{revision:number;snapshot:Translation;createdAt:string}[]|null>(null);
  const [media,setMedia] = useState<Media[]>([]), [mediaIndex,setMediaIndex] = useState<number|null>(null);
  const [trash,setTrash]=useState(false),[trashedEntries,setTrashedEntries]=useState<Entry[]>([]);
  const [mediaOpen,setMediaOpen]=useState(false),[mediaTrash,setMediaTrash]=useState(false);
  const [mediaCardIndex,setMediaCardIndex]=useState<number|null>(null);
  const [mediaField,setMediaField]=useState<string|null>(null);
  const [grants,setGrants] = useState<{id:number;username:string;role:string}[]>([]);
  const [kind,setKind] = useState<Entry['kind']>(searchParams.get('tab')==='posts'?'post':'page');
  const activeTab=role==='admin'||tab===3?tab:0;
  const parent = entries.find(e=>e.key===key);
  const visibleEntries=(trash?trashedEntries:entries).filter(e=>activeTab===3?e.kind==='post':e.kind!=='post');
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
    const source=entry.translations.find(item=>item.locale===locale)||entry.translations[0];
    if(source)return {...structuredClone(source),locale:lang,revision:0,published:null,publishedAt:null};
    const fixed = i18n.getFixedT(lang==='el'?'gr':lang);
    return {locale:lang,slug:entry.kind==='home'?'home':`${entry.kind}-${entry.key.slice(0,8)}`,title:entry.kind==='home'?'FOSSBot':label('untitled'),description:'',sections:entry.kind==='home'?landingSections(k=>String(fixed(k))):[{type:'text',content:emptyDocument}],revision:0};
  };
  const mayLeave = async () => !dirty || await confirm.confirm({title:label('unsaved'),message:label('discard'),confirmLabel:label('continue')});
  const open = async (entry:Entry,lang=locale,area='content') => {
    if(busy || !await mayLeave())return;
    const original=entry.translations.find(x=>x.locale===lang);
    const next=structuredClone(original||blank(entry,lang));
    const fixed=i18n.getFixedT(lang==='el'?'gr':lang);
    const sectionsBefore=JSON.stringify(next.sections);
    if(entry.kind==='home')next.sections=next.sections.map(s=>withRobotNavigation(s,String(fixed('website.robotPage'))));
    const menuUpgraded=sectionsBefore!==JSON.stringify(next.sections);
    setHomeArea(area);setKey(entry.key);setLocale(lang);setForm(next);setDirty(!original||menuUpgraded);setError('');setMessage('');
  };
  const change = (patch:Partial<Translation>) => {if(busy)return;setForm(current=>current?{...current,...patch}:current);setDirty(true);setMessage('');};
  const section = (index:number,patch:Partial<Section>) => {
    if(patch.cards)patch.cards=patch.cards.map(card=>({...card,id:card.id||componentId()}));
    if(patch.menu)patch.menu=patch.menu.map(item=>({...item,id:item.id||componentId()}));
    if(form)change({sections:form.sections.map((s,i)=>i===index?{...s,...patch}:s)});};
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
  const chooseImage = (index:number|null,field:string|null=null,cardIndex:number|null=null)=>run(async()=>{setMediaTrash(false);setMediaOpen(true);setMediaCardIndex(cardIndex);setMediaField(field);setMedia(await cms<Media[]>('/media',token));setMediaIndex(index);});
  const entryAction = (item:Entry,restore=false)=>run(async()=>{
    if(!await confirm.confirm({title:label(restore?'restore':'deleteEntry'),message:label(restore?'restoreEntryHelp':'deleteEntryHelp')}))return;
    await cms(`/entries/${item.key}${restore?'/restore':''}`,token,restore?'POST':'DELETE');
    if(item.key===key){setForm(null);setKey('');setDirty(false);}
    await refresh();setTrashedEntries(await cms<Entry[]>('/entries?trashed=true',token));
    setMessage(label(restore?'restored':'movedToTrash'));
  });
  const mediaAction = (image:Media)=>run(async()=>{
    if(!mediaTrash&&form&&JSON.stringify(form.sections).includes(JSON.stringify(image.url)))throw new Error(label('unsavedPhotoUse'));
    if(!await confirm.confirm({title:label(mediaTrash?'restore':'deletePhoto'),message:label(mediaTrash?'restorePhotoHelp':'deletePhotoHelp')}))return;
    await cms(`/media/${image.id}${mediaTrash?'/restore':''}`,token,mediaTrash?'POST':'DELETE');
    setMedia(await cms<Media[]>(`/media${mediaTrash?'?trashed=true':''}`,token));
  });
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
      <PageHeader title={label('title')} description={label('subtitle')} action={<Stack direction="row" gap={1}><Button variant="outlined" disabled={busy} onClick={()=>void chooseImage(null)}>{label('media')}</Button><Button href="/landing-page" variant="outlined">{label('viewWebsite')}</Button></Stack>} />
      {error&&<Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
      <Tabs value={activeTab} variant="scrollable" scrollButtons="auto" onChange={(_,value)=>void run(async()=>{if(!await mayLeave())return;setTab(value);setForm(null);setKey('');setDirty(false);if(value===0||value===3)setKind(value===3?'post':'page');if(value===1)setGrants(await cms('/permissions',token));})}>
        <Tab value={0} disabled={busy} label={label('pages')} />
        <Tab value={3} disabled={busy} label={label('posts')} />
        {role==='admin'&&<Tab value={1} disabled={busy} label={label('permissions')} />}
        {role==='admin'&&<Tab value={2} disabled={busy} label={label('apiTokens.title')} />}
      </Tabs>
      {activeTab===2 ? <WebsiteApiTokens/> : activeTab===1 ? <Stack spacing={2}><Typography>{label('permissionHelp')}</Typography>{grants.map(person=><Paper variant="outlined" key={person.id} sx={{p:2}}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography>{person.username}</Typography><TextField select size="small" label={label('role')} value={person.role} disabled={busy||person.role==='admin'} onChange={event=>void run(async()=>{await cms('/permissions',token,'PUT',{user_id:person.id,role:event.target.value});setGrants(await cms('/permissions',token));})} sx={{minWidth:180}}>
          {['none','contributor','editor','admin'].map(r=><MenuItem key={r} value={r} disabled={r==='admin'}>{label(r)}</MenuItem>)}
        </TextField></Stack></Paper>)}</Stack> : <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',lg:'300px minmax(0,1fr)'},gap:3,alignItems:'start'}}>
        <Stack spacing={2}>
          <Stack direction="row" gap={1}><TextField disabled={busy} select size="small" label={label('type')} value={kind} onChange={e=>setKind(e.target.value as Entry['kind'])} sx={{flex:1}}>{(activeTab===3?['post']:['home','page']).map(k=><MenuItem key={k} value={k}>{label(k)}</MenuItem>)}</TextField>
            <Button variant="contained" disabled={busy} onClick={()=>void run(async()=>{if(!await mayLeave())return;const created=await cms<Entry>('/entries',token,'POST',{kind});const all=await refresh();setTrash(false);setDirty(!all.find(e=>e.key===created.key)?.translations.some(x=>x.locale===locale));setKey(created.key);setForm(structuredClone(all.find(e=>e.key===created.key)?.translations.find(x=>x.locale===locale)||blank(created,locale)));})}>{label('create')}</Button></Stack>
          <Button disabled={busy} onClick={()=>void run(async()=>{if(!await mayLeave())return;setTrash(!trash);setForm(null);setKey('');setDirty(false);if(!trash)setTrashedEntries(await cms<Entry[]>('/entries?trashed=true',token));})}>{label(trash?'activeContent':'trash')}</Button>
          {visibleEntries.length===0&&<Alert severity="info">{label(trash?'emptyTrash':activeTab===3?'emptyPosts':'empty')}</Alert>}
          {visibleEntries.map(e=><ListCard key={e.key} title={e.translations.find(x=>x.locale===locale)?.title||e.translations[0]?.title||label(e.kind)} meta={<Typography variant="caption">{label(e.kind)} · {e.translations.map(x=>x.locale).join(', ')||label('noTranslations')}</Typography>}
            status={trash?<Chip size="small" label={label('trash')}/>:e.key===key?<Chip size="small" label={label('editing')} />:undefined} action={canPublish&&e.kind!=='home'?(trash?<Button disabled={busy} onClick={()=>void entryAction(e,true)}>{label('restore')}</Button>:<Tooltip title={label('deleteEntry')}><IconButton size="small" aria-label={label('deleteEntry')} disabled={busy} onClick={()=>void entryAction(e)}><IconTrash size={18}/></IconButton></Tooltip>):undefined} onOpen={()=>{if(trash){if(canPublish)void entryAction(e,true);}else void open(e);}} openLabel={`${label(trash?'restore':'edit')} ${e.translations.find(x=>x.locale===locale)?.title||e.translations[0]?.title||label(e.kind)}`} />)}
        </Stack>
        {!form ? <Alert severity="info">{label(activeTab===3?'selectPost':'selectPage')}</Alert> : <Stack spacing={2} key={`${key}-${locale}`}>
          <Paper variant="outlined" sx={{p:2}}><Stack spacing={2}>
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center"><TextField select size="small" label={label('language')} value={locale} onChange={e=>parent&&void open(parent,e.target.value)} disabled={busy} sx={{minWidth:160}}>{Array.from(new Set(['en','el',locale,...entries.flatMap(entry=>entry.translations.map(x=>x.locale))])).map(lang=><MenuItem key={lang} value={lang}>{lang==='en'?'English':lang==='el'?'Ελληνικά':lang}</MenuItem>)}</TextField>
              <Button onClick={()=>void addLanguage()} disabled={busy}>{label('addLanguage')}</Button><Chip size="small" label={form.published?label('hasPublished'):label('draft')} />{dirty&&<Chip size="small" color="warning" label={label('unsaved')} />}
            </Stack>
            <Typography variant="body2" color="text.secondary">{label('sharedStructureHelp')}</Typography>
            {!form.revision&&parent?.translations.length!==0&&<Alert severity="info">{label('translationStarterHelp')}</Alert>}
            <TextField disabled={busy} label={label('pageTitle')} value={form.title} onChange={e=>change({title:e.target.value})} inputProps={{maxLength:200}} />
            <TextField disabled={busy} label={label('slug')} value={form.slug} onChange={e=>change({slug:e.target.value})} helperText={label('slugHelp')} />
            <TextField disabled={busy} label={label('description')} value={form.description} onChange={e=>change({description:e.target.value})} multiline minRows={2} inputProps={{maxLength:500}} />
            <Stack direction="row" gap={1} flexWrap="wrap">{(parent?.kind!=='home'||homeArea==='content')&&<Button variant="outlined" disabled={busy||form.sections.length>=40} onClick={()=>setComponentLibrary(true)}>{label('addComponent')}</Button>}<Button variant="contained" disabled={busy||!dirty} onClick={()=>void save()}>{label('saveDraft')}</Button><Button variant="outlined" disabled={busy} onClick={()=>setPreview(true)}>{label('preview')}</Button>
              {canPublish&&<><Button variant="outlined" disabled={busy||dirty||!form.revision} onClick={()=>void publish('publish')}>{label('publish')}</Button><Button disabled={busy||dirty||!form.published} onClick={()=>void publish('unpublish')}>{label('unpublish')}</Button></>}
              {form.published&&parent&&<Button href={publicPath({...form.published,key,kind:parent.kind})} target="_blank" rel="noopener noreferrer">{label('viewWebsite')}</Button>}
              {canPublish&&parent&&parent.kind!=='home'&&<Tooltip title={label('deleteEntry')}><IconButton size="small" aria-label={label('deleteEntry')} disabled={busy} onClick={()=>void entryAction(parent)}><IconTrash size={18}/></IconButton></Tooltip>}
              <Button disabled={busy||!form.revision} onClick={()=>void run(async()=>setHistory(await cms(`/entries/${key}/${locale}/history`,token)))}>{label('history')}</Button>
            </Stack><Typography variant="caption" color="text.secondary">{label(canPublish?'saveBeforePublish':'contributorHelp')}</Typography>
            {parent?.kind==='home'&&<Alert severity="info">{label('homeHelp')}</Alert>}
          </Stack></Paper>
          {parent?.kind==='home'?<Tabs value={homeArea} onChange={(_,value)=>setHomeArea(value)}><Tab value="content" label={label('pageComponents')}/><Tab value="settings" label={label('siteSettings')}/></Tabs>:<Alert severity="info" action={<Button disabled={busy} onClick={()=>{const home=entries.find(e=>e.kind==='home');if(home)void open(home,locale,'settings');}}>{label('editSiteSettings')}</Button>}>{label('sharedSiteHelp')}</Alert>}
          {parent?.kind==='home'&&homeArea==='settings'&&<Alert severity="info">{label('siteSettingsHelp')}</Alert>}
          {form.sections.map((s,index)=>({s,index})).filter(({s})=>siteSetting(s)?parent?.kind==='home'&&homeArea==='settings':parent?.kind!=='home'||homeArea==='content').map(({s,index},visibleIndex)=><Paper variant="outlined" key={index} sx={{p:2}}><Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Typography variant="h5">{visibleIndex+1}. {label(s.type==='landing'?(siteSetting(s)?`landingGroups.${s.group}`:`components.${s.group}.title`):s.type)}</Typography><Stack direction="row">{!siteSetting(s)&&<Button disabled={busy||form.sections.length>=40} onClick={()=>change({sections:insertWebsiteComponent(form.sections,s,index)})}>{label('duplicateComponent')}</Button>}{!(s.type==='landing'&&['navigation','footer'].includes(s.group||''))&&<><Button disabled={busy||index===0||(form.sections[index-1].type==='landing'&&form.sections[index-1].group==='navigation')} onClick={()=>move(index,-1)} aria-label={label('moveUp')}>{label('moveUp')}</Button><Button disabled={busy||index===form.sections.length-1||(form.sections[index+1].type==='landing'&&form.sections[index+1].group==='footer')} onClick={()=>move(index,1)} aria-label={label('moveDown')}>{label('moveDown')}</Button><Button color="error" onClick={()=>change({sections:form.sections.filter((_,i)=>i!==index)})}>{label('remove')}</Button></>}</Stack></Stack>
            {s.type==='landing'&&<>
              {landingFields(s,k=>String(i18n.getFixedT(locale==='el'?'gr':locale)(k))).map(([field,value])=><Stack key={field} spacing={1}>
                <TextField disabled={busy} label={landingFieldLabel(field,label)} value={value} multiline={!field.startsWith('image:')&&!field.startsWith('href:')} onChange={e=>section(index,{values:{...s.values,[field]:e.target.value}})} />
                {field.startsWith('image:')&&<Stack direction="row" gap={2} alignItems="center"><Box component="img" src={landingImage(value)} alt="" sx={{width:160,maxHeight:100,objectFit:'contain'}}/><Button disabled={busy} onClick={()=>void chooseImage(index,field)}>{label('chooseImage')}</Button></Stack>}
              </Stack>)}
              {s.group==='navigation'&&<>{(s.menu||[]).map((item,i)=><WebsiteMenuItemEditor key={i} item={item} entries={entries} locale={locale} disabled={busy} first={i===0}
                onChange={patch=>section(index,{menu:s.menu?.map((m,j)=>j===i?{...m,...patch}:m)})}
                onMoveUp={()=>{const menu=[...(s.menu||[])];[menu[i-1],menu[i]]=[menu[i],menu[i-1]];section(index,{menu});}}
                onRemove={()=>section(index,{menu:s.menu?.filter((_,j)=>j!==i)})}/>) }
                <Button disabled={busy||(s.menu?.length||0)>=12} onClick={()=>section(index,{menu:[...(s.menu||[]),{title:'',href:'/',icon:'',linkType:'url'}]})}>{label('addMenuLink')}</Button></>}
            </>}
            {s.type!=='landing'&&<TextField disabled={busy} size="small" label={label('sectionTitle')} value={s.title||''} onChange={e=>section(index,{title:e.target.value})} />}
            {s.type==='latest-posts'&&<Alert severity="info">{label('latestPostsHelp')}</Alert>}
            {s.type==='text'&&<RichTextEditor disabled={busy} value={s.content||emptyDocument} onChange={content=>section(index,{content})} labels={tools} />}
            {(s.type==='banner'||s.type==='feature'||s.type==='projects')&&<TextField disabled={busy} label={label('content')} value={s.text||''} onChange={e=>section(index,{text:e.target.value})} multiline minRows={3} />}
            {s.type==='projects'&&<><WebsiteProfileCardsEditor section={s} disabled={busy} onChange={cards=>section(index,{cards})} onChoosePhoto={cardIndex=>void chooseImage(index,null,cardIndex)}/><Divider/><Typography variant="h6">{label('fundingImage')}</Typography><TextField disabled={busy} multiline minRows={2} label={label('fundingText')} value={s.fundingText||''} onChange={e=>section(index,{fundingText:e.target.value})}/></>}
            {(s.type==='image'||s.type==='feature'||s.type==='projects')&&<><Button variant="outlined" onClick={()=>void chooseImage(index)}>{label('chooseImage')}</Button>{s.image&&<Button disabled={busy} onClick={()=>section(index,{image:''})}>{label('removePhoto')}</Button>}{s.image&&<Box component="img" src={s.type==='feature'||s.type==='projects'?landingImage(s.image):`${backendUrl}${s.image}`} alt={s.alt||''} sx={{maxWidth:'100%',maxHeight:220,objectFit:'contain'}} />}<TextField disabled={busy} label={label('alt')} value={s.alt||''} onChange={e=>section(index,{alt:e.target.value})} /></>}
            {(s.type==='banner'||s.type==='button'||s.type==='feature')&&<><TextField disabled={busy} label={label('buttonLabel')} value={s.buttonLabel||''} onChange={e=>section(index,{buttonLabel:e.target.value})} /><TextField disabled={busy} label={label('link')} value={s.href||''} onChange={e=>section(index,{href:e.target.value})} helperText={label('linkHelp')} /></>}
            {s.type==='feature'&&<TextField disabled={busy} multiline minRows={3} label={label('featurePoints')} value={(s.cards||[]).map(point=>point.text).join('\n')} onChange={e=>section(index,{cards:e.target.value.split('\n').slice(0,12).map((text,i)=>({id:s.cards?.[i]?.id||componentId(),title:'',text}))})}/>}
            {s.type==='feature'&&<TextField select disabled={busy} label={label('imagePosition')} value={s.layout||'image-right'} onChange={e=>section(index,{layout:e.target.value as Section['layout']})}><MenuItem value="image-left">{label('imageLeft')}</MenuItem><MenuItem value="image-right">{label('imageRight')}</MenuItem></TextField>}
            {(s.type==='people'||s.type==='testimonials')&&<WebsiteProfileCardsEditor section={s} disabled={busy} onChange={cards=>section(index,{cards})} onChoosePhoto={cardIndex=>void chooseImage(index,null,cardIndex)}/>}
            {s.type==='cards'&&<>{(s.cards||[]).map((card,i)=><Stack spacing={1} key={i} sx={{p:2,border:1,borderColor:'divider',borderRadius:1}}>{(['title','text','href'] as const).map(field=><TextField key={field} size="small" label={label(field==='href'?'link':field==='text'?'content':'sectionTitle')} value={card[field]||''} onChange={e=>section(index,{cards:s.cards?.map((c,j)=>j===i?{...c,[field]:e.target.value}:c)})} />)}<Button onClick={()=>section(index,{cards:s.cards?.filter((_,j)=>j!==i)})}>{label('remove')}</Button></Stack>)}<Button disabled={(s.cards?.length||0)>=12} onClick={()=>section(index,{cards:[...(s.cards||[]),{title:'',text:''}]})}>{label('addCard')}</Button></>}
          </Stack></Paper>)}
          {(parent?.kind!=='home'||homeArea==='content')&&<Button variant="outlined" disabled={busy||form.sections.length>=40} onClick={()=>setComponentLibrary(true)}>{label('addComponent')}</Button>}
        </Stack>}
      </Box>}
    </Stack>
    <WebsiteComponentLibrary open={componentLibrary} onClose={()=>setComponentLibrary(false)} entries={entries} locale={locale} onAdd={component=>{if(form&&form.sections.length<40)change({sections:insertWebsiteComponent(form.sections,component)});setComponentLibrary(false);}}/>
    <Dialog open={preview} onClose={()=>setPreview(false)} maxWidth="lg" fullWidth><DialogTitle>{label('draftPreview')}</DialogTitle><DialogContent>{form&&(parent?.kind==='home'?<LandingProvider sections={form.sections}><LpHeader/><WebsiteContent content={form} home/><Footer/></LandingProvider>:<PublishedLandingProvider><LpHeader/><WebsiteContent content={form} showDescription={parent?.kind!=='post'}/><Footer/></PublishedLandingProvider>)}</DialogContent><DialogActions><Button onClick={()=>setPreview(false)}>{label('close')}</Button></DialogActions></Dialog>
    <Dialog open={history!==null} onClose={()=>setHistory(null)} maxWidth="sm" fullWidth><DialogTitle>{label('history')}</DialogTitle><DialogContent><Stack spacing={2}>{history?.map(item=><Box key={item.revision}><Typography>{label('revision')} {item.revision} · {new Date(item.createdAt).toLocaleString()}</Typography><Button onClick={()=>{if(form)change({...item.snapshot,revision:form.revision,published:form.published});setHistory(null);}}>{label('restoreDraft')}</Button><Divider /></Box>)}</Stack></DialogContent><DialogActions><Button onClick={()=>setHistory(null)}>{label('close')}</Button></DialogActions></Dialog>
    <Dialog open={mediaOpen} onClose={()=>setMediaOpen(false)} fullWidth maxWidth="md"><DialogTitle>{label('media')}</DialogTitle><DialogContent>
      {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
      <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="outlined" component="label" disabled={busy||mediaTrash}>{label('upload')}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}} /></Button>
        <Button disabled={busy} onClick={()=>void run(async()=>{setMedia(await cms<Media[]>(`/media${!mediaTrash?'?trashed=true':''}`,token));setMediaTrash(!mediaTrash);})}>{label(mediaTrash?'activePhotos':'trash')}</Button></Stack>
      <Typography variant="caption" sx={{display:'block',my:1}}>{label(mediaTrash?'photoTrashHelp':'imageLimit')}</Typography>
      {media.length===0&&<Alert severity="info">{label(mediaTrash?'emptyTrash':'emptyMedia')}</Alert>}
      <Box sx={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:2}}>{media.map(image=><Paper key={image.id} variant="outlined" sx={{p:1,position:'relative'}}><Stack spacing={1}>
        {!mediaTrash&&<Box component="img" src={`${backendUrl}${image.url}`} alt="" sx={{width:'100%',height:90,objectFit:'contain'}}/>}
        <Typography variant="caption" sx={{overflowWrap:'anywhere'}}>{image.filename}</Typography>
        {!mediaTrash&&mediaIndex!==null&&<Button disabled={busy} variant="outlined" onClick={()=>{
          if(mediaCardIndex!==null&&form)section(mediaIndex,{cards:form.sections[mediaIndex].cards?.map((card,i)=>i===mediaCardIndex?{...card,image:image.url}:card)});
          else if(mediaField&&form)section(mediaIndex,{values:{...form.sections[mediaIndex].values,[mediaField]:image.url}});
          else section(mediaIndex,{image:image.url});setMediaOpen(false);
        }}>{label('chooseImage')}</Button>}
        {canPublish&&(mediaTrash?<Button disabled={busy} onClick={()=>void mediaAction(image)}>{label('restore')}</Button>:<Tooltip title={label('deletePhoto')}><IconButton size="small" aria-label={label('deletePhoto')} disabled={busy} onClick={()=>void mediaAction(image)} sx={{position:'absolute',top:4,right:4,zIndex:1,bgcolor:'background.paper',border:1,borderColor:'divider','&:hover':{bgcolor:'background.default'}}}><IconX size={16}/></IconButton></Tooltip>)}
      </Stack></Paper>)}</Box>
    </DialogContent><DialogActions><Button onClick={()=>setMediaOpen(false)}>{label('close')}</Button></DialogActions></Dialog>

  </PageContainer>;
}

function landingFieldLabel(field:string,label:(key:string)=>string) {
  if(field.startsWith('image:'))return `${label('image')} · ${label('landingFields.'+field.slice(6))}`;
  if(field.startsWith('href:'))return `${label('link')} · ${label('landingFields.'+field.slice(5))}`;
  const parts=field.split('.');
  const story=parts.length===4?`${label('landingFields.'+parts[2])} · `:'';
  return story+label('landingFields.'+parts[parts.length-1]);
}
