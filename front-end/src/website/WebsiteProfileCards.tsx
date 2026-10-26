import { Avatar, Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { landingImage } from './LandingContext';
import type { Section } from './api';
export default function WebsiteProfileCards({section,safeHref}:{section:Section;safeHref:(href?:string)=>string|undefined}) {
 const {t}=useTranslation();const testimonials=section.type==='testimonials';
 return <Grid container spacing={3}>{(section.cards||[]).map((person,i)=>{
  const photo=person.image?landingImage(person.image):undefined;
  const initials=person.title.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('');
  return <Grid item key={i} xs={12} sm={6} md={4}><Card variant="outlined" sx={{height:'100%'}}>
   {!testimonials&&<Box sx={{aspectRatio:'4 / 3',bgcolor:'action.hover',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>{photo?<Box component="img" src={photo} alt={person.alt||person.title} loading="lazy" sx={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Avatar sx={{width:80,height:80,fontSize:'2rem'}} aria-label={person.title}>{initials}</Avatar>}</Box>}
   <CardContent><Stack spacing={2}>
    {testimonials&&<Typography component="blockquote" sx={{m:0,whiteSpace:'pre-line',fontStyle:'italic',lineHeight:1.7}}>{person.text}</Typography>}
    <Stack direction="row" spacing={2} alignItems="center">
     {testimonials&&<Avatar src={photo} alt={person.alt||person.title} sx={{width:56,height:56}}>{initials}</Avatar>}
     <Box><Typography variant="h5" component="h3">{person.title}</Typography>{person.role&&<Typography color="text.secondary">{person.role}</Typography>}{person.organization&&<Typography variant="body2" color="text.secondary">{person.organization}</Typography>}</Box>
    </Stack>
    {!testimonials&&person.text&&<Typography sx={{whiteSpace:'pre-line'}}>{person.text}</Typography>}
    {safeHref(person.href)&&<Button href={safeHref(person.href)} sx={{alignSelf:'flex-start'}}>{t(testimonials?'website.testimonialSource':'website.viewProfile')}</Button>}
   </Stack></CardContent>
  </Card></Grid>;
 })}</Grid>;
}
