import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { componentCatalog, createWebsiteComponent, siteSetting } from './componentCatalog';
import type { Entry, Section } from './api';
export default function WebsiteComponentLibrary({open,onClose,onAdd,entries,locale}:{open:boolean;onClose:()=>void;onAdd:(section:Section)=>void;entries:Entry[];locale:string}) {
 const {t,i18n}=useTranslation(),[query,setQuery]=useState(''),[source,setSource]=useState('');const label=(key:string)=>String(t('website.'+key));
 const fixed=i18n.getFixedT(locale==='el'?'gr':locale);
 useEffect(()=>{if(open){setQuery('');setSource('');}},[open,locale]);
 const sourceEntry=entries.find(e=>e.key===source)?.translations.find(tr=>tr.locale===locale);
 return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{label('componentLibrary')}</DialogTitle><DialogContent><Stack spacing={2}>
  <Typography color="text.secondary">{label('componentHelp')}</Typography>
  <TextField label={label('searchComponents')} value={query} onChange={e=>setQuery(e.target.value)}/>
  <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:2}}>{componentCatalog.filter(kind=>(kind+' '+label('components.'+kind+'.title')+' '+label('components.'+kind+'.description')).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(kind=><Button key={kind} variant="outlined" onClick={()=>onAdd(createWebsiteComponent(kind,key=>String(fixed(key))))} sx={{justifyContent:'flex-start',textAlign:'left',p:2}}><Stack spacing={1}><Typography variant="h6" component="span">{label('components.'+kind+'.title')}</Typography><Typography variant="body2" component="span" color="text.secondary">{label('components.'+kind+'.description')}</Typography></Stack></Button>)}</Box>
  <Divider/><Typography variant="h6">{label('copyFromPage')}</Typography><TextField select label={label('sourcePage')} value={source} onChange={e=>setSource(e.target.value)}>
   {entries.filter(e=>e.translations.some(tr=>tr.locale===locale)).map(e=><MenuItem key={e.key} value={e.key}>{e.translations.find(tr=>tr.locale===locale)?.title}</MenuItem>)}
  </TextField>
  {sourceEntry?.sections.filter(s=>!siteSetting(s)).map((section,i)=><Button key={i} variant="outlined" onClick={()=>onAdd(section)} sx={{justifyContent:'flex-start'}}>{label('copy')} {i+1}. {section.title||label(section.type==='landing'?'components.'+section.group+'.title':section.type)}</Button>)}
 </Stack></DialogContent><DialogActions><Button onClick={onClose}>{label('close')}</Button></DialogActions></Dialog>;
}
