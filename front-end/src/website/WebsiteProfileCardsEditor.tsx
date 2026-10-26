import { Avatar, Button, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { landingImage } from './LandingContext';
import type { Section, WebsiteCard } from './api';
export default function WebsiteProfileCardsEditor({section,disabled,onChange,onChoosePhoto}:{section:Section;disabled:boolean;onChange:(cards:WebsiteCard[])=>void;onChoosePhoto:(index:number)=>void}) {
 const {t}=useTranslation(),cards=section.cards||[],testimonials=section.type==='testimonials',projects=section.type==='projects';const label=(key:string)=>String(t('website.'+key));
 const patch=(index:number,value:Partial<WebsiteCard>)=>onChange(cards.map((card,i)=>i===index?{...card,...value}:card));
 const move=(index:number,offset:number)=>{const next=[...cards];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);};
 return <Stack spacing={2}>{cards.map((card,index)=><Stack key={index} spacing={2} sx={{p:2,border:1,borderColor:'divider',borderRadius:1}}>
  <Typography variant="h6">{label(projects?'project':testimonials?'testimonial':'person')} {index+1}</Typography>
  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap"><Avatar variant={projects?'rounded':'circular'} imgProps={projects?{style:{objectFit:'contain'}}:undefined} src={card.image?landingImage(card.image):undefined} alt={card.alt||card.title} sx={{width:72,height:72}}>{card.title.trim()[0]}</Avatar><Button disabled={disabled} variant="outlined" onClick={()=>onChoosePhoto(index)}>{label(projects?'chooseLogo':'choosePhoto')}</Button>{card.image&&<Button disabled={disabled} onClick={()=>patch(index,{image:'',alt:''})}>{label('removePhoto')}</Button>}</Stack>
  <TextField disabled={disabled} label={label(projects?'projectName':'personName')} value={card.title} onChange={e=>patch(index,{title:e.target.value})}/>
  {!projects&&<><TextField disabled={disabled} label={label('personRole')} value={card.role||''} onChange={e=>patch(index,{role:e.target.value})}/>
  <TextField disabled={disabled} label={label('organization')} value={card.organization||''} onChange={e=>patch(index,{organization:e.target.value})}/></>}
  <TextField disabled={disabled} label={label(projects?'projectDescription':testimonials?'quote':'biography')} value={card.text} multiline minRows={3} onChange={e=>patch(index,{text:e.target.value})}/>
  <TextField disabled={disabled||!card.image} label={label('alt')} value={card.alt||''} onChange={e=>patch(index,{alt:e.target.value})}/>
  <TextField disabled={disabled} label={label(projects?'projectLink':'profileLink')} value={card.href||''} helperText={label('linkHelp')} onChange={e=>patch(index,{href:e.target.value})}/>
  <Stack direction="row" flexWrap="wrap"><Button disabled={disabled||index===0} onClick={()=>move(index,-1)}>{label('moveUp')}</Button><Button disabled={disabled||index===cards.length-1} onClick={()=>move(index,1)}>{label('moveDown')}</Button><Button disabled={disabled} color="error" onClick={()=>onChange(cards.filter((_,i)=>i!==index))}>{label('remove')}</Button></Stack>
 </Stack>)}<Button disabled={disabled||cards.length>=12} onClick={()=>onChange([...cards,{title:'',text:'',role:'',organization:'',image:'',alt:''}])}>{label(projects?'addProject':testimonials?'addTestimonial':'addPerson')}</Button></Stack>;
}
