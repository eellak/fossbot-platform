import { Autocomplete, Box, Button, MenuItem, Stack, TextField, Typography, createFilterOptions } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { publicPath, type Entry, type WebsiteMenuItem } from './api';
import { menuIconId, menuIcons, WebsiteMenuIcon } from './menuIcons';
export function cmsMenuPages(entries:Entry[],locale:string) {
  return entries.flatMap(entry=>{const published=entry.translations.find(x=>x.locale===locale)?.published;
    return published?[{title:published.title,href:publicPath({...published,key:entry.key,kind:entry.kind})}]:[];});
}
export default function WebsiteMenuItemEditor({item,entries,locale,disabled,onChange,onRemove,onMoveUp,first}:{item:WebsiteMenuItem;entries:Entry[];locale:string;disabled:boolean;onChange:(patch:Partial<WebsiteMenuItem>)=>void;onRemove:()=>void;onMoveUp:()=>void;first:boolean}) {
  const update=(patch:Partial<WebsiteMenuItem>)=>onChange({icon:menuIconId(item),...patch});
  const {t,i18n}=useTranslation();const label=(key:string)=>String(t('website.'+key));
  const pages=[{title:label('home'),href:'/landing-page'},...cmsMenuPages(entries,locale).filter(p=>p.href!=='/landing-page')];
  const internal=item.linkType==='cms'||(!item.linkType&&pages.some(p=>p.href===item.href));
  const selectedPage=pages.find(p=>p.href===item.href)||null;
  const iconOptions=[{id:'',label:label('noIcon'),keywords:''},...menuIcons.map(icon=>({id:icon.id,label:icon[i18n.language.startsWith('gr')||i18n.language.startsWith('el')?'el':'en'],keywords:icon.en+' '+icon.el+' '+icon.keywords}))];
  return <Stack spacing={2} sx={{p:2,border:1,borderColor:'divider',borderRadius:1}}>
    <TextField disabled={disabled} label={label('buttonLabel')} value={item.title} onChange={e=>update({title:e.target.value})}/>
    <TextField select disabled={disabled} label={label('linkType')} value={internal?'cms':'url'} onChange={e=>update(e.target.value==='cms'?{linkType:'cms',href:selectedPage?.href||'/landing-page'}:{linkType:'url'})}>
      <MenuItem value="cms">{label('cmsPage')}</MenuItem><MenuItem value="url">{label('customUrl')}</MenuItem>
    </TextField>
    {internal?<Autocomplete<{title:string;href:string},false,false,false> disabled={disabled} options={pages} value={selectedPage} getOptionLabel={p=>p.title} isOptionEqualToValue={(a,b)=>a.href===b.href} disableClearable={false}
      onChange={(_,page)=>{if(page)update({href:page.href,...(!item.title.trim()?{title:page.title}:{})});}}
      renderOption={(props,page)=><li {...props} key={page.href}><Box><Typography>{page.title}</Typography><Typography variant="caption" color="text.secondary">{page.href}</Typography></Box></li>}
      renderInput={params=><TextField {...params} label={label('cmsPage')} error={!selectedPage} helperText={!selectedPage?label('missingMenuPage'):label('cmsPageHelp')}/>}/>
      :<TextField disabled={disabled} label={label('link')} value={item.href} helperText={label('linkHelp')} onChange={e=>update({href:e.target.value})}/>}
    <Autocomplete<{id:string;label:string;keywords:string},false,false,false> disabled={disabled} options={iconOptions} value={iconOptions.find(icon=>icon.id===menuIconId(item))||iconOptions[0]} getOptionLabel={icon=>icon.label} isOptionEqualToValue={(a,b)=>a.id===b.id}
      filterOptions={createFilterOptions({stringify:option=>option.label+' '+option.id+' '+option.keywords})}
      onChange={(_,icon)=>update({icon:icon?.id||''})}
      renderOption={(props,icon)=><li {...props} key={icon.id}><Stack direction="row" spacing={1.5} alignItems="center"><WebsiteMenuIcon id={icon.id}/><span>{icon.label}</span></Stack></li>}
      renderInput={params=><TextField {...params} label={label('menuIcon')} helperText={label('iconHelp')} InputProps={{...params.InputProps,startAdornment:<><Box sx={{display:'flex',mr:1}}><WebsiteMenuIcon id={menuIconId(item)}/></Box>{params.InputProps.startAdornment}</>}}/>}/>
    <Stack direction="row" gap={1}><Button disabled={disabled||first} onClick={onMoveUp}>{label('moveUp')}</Button><Button disabled={disabled} color="error" onClick={onRemove}>{label('remove')}</Button></Stack>
  </Stack>;
}
