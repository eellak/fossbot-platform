import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import RichTextContent from 'src/components/courses/RichTextContent';
import { backendUrl } from 'src/utils/backendUrl';
import LatestPosts from './LatestPosts';
import WebsiteProjects from './WebsiteProjects';
import WebsiteProfileCards from './WebsiteProfileCards';
import LandingSection from './LandingSection';
import { LandingProvider, landingImage } from './LandingContext';
import type { Translation } from './api';

export function websiteHref(href?: string): string | undefined {
  if (!href || /[\x00-\x1f]/.test(href)) return undefined;
  if ((href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) || href.startsWith('https://')) return href;
  return undefined;
}

export default function WebsiteContent({ content, home=false, articleDialog=false, showDescription=true }: { content: Translation; home?:boolean; articleDialog?:boolean; showDescription?:boolean }) {
  if(content.sections.some(s=>s.type==='landing')) return <LandingProvider sections={content.sections}><Box component="article" lang={content.locale}>
    {!home&&content.title&&<Container maxWidth="lg" sx={{py:4}}><Typography variant="h2" component="h1">{content.title}</Typography>{showDescription&&content.description&&<Typography sx={{mt:1}} color="text.secondary">{content.description}</Typography>}</Container>}
    {content.sections.map((s,i)=>s.type==='landing'?<LandingSection key={i} section={s} sectionId={i===content.sections.findIndex(x=>x.group===s.group)?undefined:`cms-section-${i}`} primary={home&&i===content.sections.findIndex(x=>x.group==='hero')}/>:<WebsiteContent key={i} articleDialog={articleDialog} content={{...content,title:'',description:'',sections:[s]}}/>)}</Box></LandingProvider>;
  return <Container component="article" lang={content.locale} maxWidth="lg" sx={{ py:{xs:4,md:6} }}>
    <Stack spacing={4}>
      {content.title&&<Box><Typography variant="h2" component="h1">{content.title}</Typography>{showDescription&&content.description && <Typography color="text.secondary" sx={{mt:1}}>{content.description}</Typography>}</Box>}
      {content.sections.map((section, index) => <Box key={index} component="section">
        {section.type === 'banner' ? <Box sx={{p:{xs:3,md:5},border:1,borderColor:'divider',borderRadius:2,bgcolor:'background.paper'}}>
          <Typography variant="h2" component="h2">{section.title}</Typography><Typography sx={{mt:2,whiteSpace:'pre-line'}}>{section.text}</Typography>
          {websiteHref(section.href) && <Button variant="contained" href={websiteHref(section.href)} sx={{mt:2}}>{section.buttonLabel || section.title}</Button>}
        </Box> : <>
          {section.title && <Typography variant="h4" component="h2" sx={{mb:2}}>{section.title}</Typography>}
          {section.type==='projects'&&<WebsiteProjects section={section} safeHref={websiteHref}/>}
          {(section.type==='people'||section.type==='testimonials')&&<WebsiteProfileCards section={section} safeHref={websiteHref}/>}
          {section.type === 'feature' && <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={section.image?6:12} sx={{order:{xs:1,md:section.layout==='image-left'?2:1}}}><Typography sx={{whiteSpace:'pre-line',lineHeight:1.6}}>{section.text}</Typography>{!!section.cards?.length&&<Box component="ul" sx={{pl:2.5}}>{section.cards.map((point,i)=><Typography key={i} component="li" sx={{mt:1}}>{point.text}</Typography>)}</Box>}{websiteHref(section.href)&&<Button variant="outlined" href={websiteHref(section.href)} sx={{mt:2}}>{section.buttonLabel||section.title}</Button>}</Grid>
            {section.image&&<Grid item xs={12} md={6} sx={{order:{xs:2,md:section.layout==='image-left'?1:2}}}><Box component="figure" sx={{m:0}}><Box component="img" src={landingImage(section.image)} alt={section.alt||''} sx={{display:'block',width:'100%',height:'auto'}}/>{section.alt&&<Typography component="figcaption" variant="caption">{section.alt}</Typography>}</Box></Grid>}
          </Grid>}
          {section.type === 'latest-posts' && !articleDialog && <LatestPosts locale={content.locale} showTitle={false}/>}
          {section.type === 'text' && <RichTextContent content={section.content || {type:'doc',content:[]}} />}
          {section.type === 'image' && section.image && <Box component="figure" sx={{m:0}}><Box component="img" src={`${backendUrl}${section.image}`} alt={section.alt || ''} sx={{display:'block',maxWidth:'100%',maxHeight:600,objectFit:'contain',borderRadius:1}} />{section.alt && <Typography component="figcaption" variant="caption" color="text.secondary">{section.alt}</Typography>}</Box>}
          {section.type === 'button' && websiteHref(section.href) && <Button variant="contained" href={websiteHref(section.href)}>{section.buttonLabel || section.title}</Button>}
          {section.type === 'cards' && <Grid container spacing={2}>{(section.cards || []).map((card,i) => <Grid item xs={12} md={4} key={i}><Card variant="outlined" sx={{height:'100%'}}><CardContent><Typography variant="h5" component="h3">{card.title}</Typography><Typography sx={{mt:1,whiteSpace:'pre-line'}}>{card.text}</Typography>{websiteHref(card.href) && <Button href={websiteHref(card.href)} sx={{mt:1}}>{card.title}</Button>}</CardContent></Card></Grid>)}</Grid>}
        </>}
      </Box>)}
    </Stack>
  </Container>;
}
