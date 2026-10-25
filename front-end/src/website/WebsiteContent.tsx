import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import RichTextContent from 'src/components/courses/RichTextContent';
import { backendUrl } from 'src/utils/backendUrl';
import type { Translation } from './api';

export function websiteHref(href?: string): string | undefined {
  if (!href || /[\x00-\x1f]/.test(href)) return undefined;
  if ((href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) || href.startsWith('https://')) return href;
  return undefined;
}

export default function WebsiteContent({ content }: { content: Translation }) {
  return <Container component="article" lang={content.locale} maxWidth="lg" sx={{ py:{xs:4,md:6} }}>
    <Stack spacing={4}>
      <Box><Typography variant="h2" component="h1">{content.title}</Typography>{content.description && <Typography color="text.secondary" sx={{mt:1}}>{content.description}</Typography>}</Box>
      {content.sections.map((section, index) => <Box key={index} component="section">
        {section.type === 'banner' ? <Box sx={{p:{xs:3,md:5},border:1,borderColor:'divider',borderRadius:2,bgcolor:'background.paper'}}>
          <Typography variant="h2" component="h2">{section.title}</Typography><Typography sx={{mt:2,whiteSpace:'pre-line'}}>{section.text}</Typography>
          {websiteHref(section.href) && <Button variant="contained" href={websiteHref(section.href)} sx={{mt:2}}>{section.buttonLabel || section.title}</Button>}
        </Box> : <>
          {section.title && <Typography variant="h4" component="h2" sx={{mb:2}}>{section.title}</Typography>}
          {section.type === 'text' && <RichTextContent content={section.content || {type:'doc',content:[]}} />}
          {section.type === 'image' && section.image && <Box component="figure" sx={{m:0}}><Box component="img" src={`${backendUrl}${section.image}`} alt={section.alt || ''} sx={{display:'block',maxWidth:'100%',maxHeight:600,objectFit:'contain',borderRadius:1}} />{section.alt && <Typography component="figcaption" variant="caption" color="text.secondary">{section.alt}</Typography>}</Box>}
          {section.type === 'button' && websiteHref(section.href) && <Button variant="contained" href={websiteHref(section.href)}>{section.buttonLabel || section.title}</Button>}
          {section.type === 'cards' && <Grid container spacing={2}>{(section.cards || []).map((card,i) => <Grid item xs={12} md={4} key={i}><Card variant="outlined" sx={{height:'100%'}}><CardContent><Typography variant="h5" component="h3">{card.title}</Typography><Typography sx={{mt:1,whiteSpace:'pre-line'}}>{card.text}</Typography>{websiteHref(card.href) && <Button href={websiteHref(card.href)} sx={{mt:1}}>{card.title}</Button>}</CardContent></Card></Grid>)}</Grid>}
        </>}
      </Box>)}
    </Stack>
  </Container>;
}
