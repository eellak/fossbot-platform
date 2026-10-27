import { Box, Card, CardContent, Grid, Link, Stack, Typography } from '@mui/material';
import { IconWorld } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { landingImage } from './LandingContext';
import WebsiteSectionHeading from './WebsiteSectionHeading';
import type { Section } from './api';

export default function WebsiteProjects({section,safeHref}:{section:Section;safeHref:(href?:string)=>string|undefined}) {
 const {t}=useTranslation();
 return <Stack spacing={3}>
  {section.title&&<WebsiteSectionHeading>{section.title}</WebsiteSectionHeading>}
  {section.text&&<Typography sx={{whiteSpace:'pre-line'}}>{section.text}</Typography>}
  <Grid container spacing={3}>{(section.cards||[]).map((project,index)=><Grid item key={index} xs={12} sm={6} md={(section.cards||[]).length===2?6:4}>
   <Card variant="outlined" sx={{height:'100%'}}>
    <Box sx={{height:140,p:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
     {project.image?<Box component="img" src={landingImage(project.image)} alt={project.alt||project.title} loading="lazy" sx={{width:'100%',height:'100%',objectFit:'contain'}}/>:<IconWorld size={36} aria-hidden/>}
    </Box>
    <CardContent><Stack spacing={2}>
     <Typography variant="h5" component="h3">{project.title}</Typography>
     {project.text&&<Typography sx={{whiteSpace:'pre-line'}}>{project.text}</Typography>}
     {safeHref(project.href)&&<Link href={safeHref(project.href)} sx={{alignSelf:'flex-start'}}>{t('website.visitProject')}</Link>}
    </Stack></CardContent>
   </Card>
  </Grid>)}</Grid>
  {(section.image||section.fundingText)&&<Stack spacing={2} alignItems="center" sx={{borderTop:1,borderColor:'divider',pt:3}}>
   {section.image&&<Box component="img" src={landingImage(section.image)} alt={section.alt||''} loading="lazy" sx={{maxWidth:'100%',width:340,height:100,objectFit:'contain'}}/>}
   {section.fundingText&&<Typography variant="body2" color="text.secondary" sx={{whiteSpace:'pre-line',textAlign:'center',maxWidth:'72ch'}}>{section.fundingText}</Typography>}
  </Stack>}
 </Stack>;
}
