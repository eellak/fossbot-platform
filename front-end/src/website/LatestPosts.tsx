import { useEffect, useId, useState } from 'react';
import { Alert, Avatar, Box, Button, ButtonBase, Dialog, DialogContent, DialogTitle, IconButton, List, ListItem, Link, Stack, Typography } from '@mui/material';
import { IconNews, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { backendUrl } from 'src/utils/backendUrl';
import { cms, contentLocale, type PostSummary, type PublicEntry } from './api';
import WebsiteContent from './WebsiteContent';

/** Standalone public feed, also available as a reusable CMS section. */
export default function LatestPosts({locale,showTitle=true}:{locale?:string;showTitle?:boolean}) {
  const {t,i18n}=useTranslation(),language=locale||contentLocale(i18n.language);
  const titleId=useId(),[dialogOpen,setDialogOpen]=useState(false);
  const [feed,setFeed]=useState<{locale:string;posts:PostSummary[]}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [selected,setSelected]=useState<PostSummary|null>(null),[article,setArticle]=useState<PublicEntry|null>(null),[articleError,setArticleError]=useState('');
  useEffect(()=>{
    let active=true;setFeed(null);setError('');setSelected(null);setDialogOpen(false);
    cms<PostSummary[]>(`/public/posts/latest?locale=${encodeURIComponent(language)}`).then(posts=>{if(active)setFeed({locale:language,posts});}).catch(()=>{if(active)setError(t('website.postsLoadError'));});
    return()=>{active=false;};
  },[language,retry,t]);
  useEffect(()=>{
    let active=true;setArticle(null);setArticleError('');
    if(selected&&selected.locale===language)cms<PublicEntry>(`/public/${selected.key}/${selected.locale}`).then(post=>{if(active)setArticle(post);}).catch(()=>{if(active)setArticleError(t('website.notPublished'));});
    return()=>{active=false;};
  },[selected,language,t]);
  const openArticle=(post:PostSummary)=>{setArticle(null);setArticleError('');setSelected({...post});setDialogOpen(true);};
  return <Stack spacing={2}>
    {showTitle&&<Typography variant="h4" component="h2">{t('website.latest-posts')}</Typography>}
    {error?<Alert severity="error" action={<Button onClick={()=>setRetry(n=>n+1)}>{t('website.retry')}</Button>}>{error}</Alert>:!feed||feed.locale!==language?<Typography role="status">{t('website.loading')}</Typography>:!feed.posts.length?<Typography color="text.secondary">{t('website.noPosts')}</Typography>:<List disablePadding sx={{border:1,borderColor:'divider',borderRadius:1,overflow:'hidden'}}>
      {feed.posts.map((post,index)=><ListItem key={post.key} divider={index<feed.posts.length-1} sx={{gap:2,p:1.5,flexWrap:{xs:'wrap',sm:'nowrap'}}}>
        <ButtonBase aria-label={post.title} onClick={()=>openArticle(post)} sx={{flexShrink:0,borderRadius:1}}>
          <Avatar variant="rounded" src={post.thumbnail?.startsWith('/website/media/')?`${backendUrl}${post.thumbnail}`:post.thumbnail||undefined} alt="" sx={{width:64,height:64,bgcolor:'background.default',color:'text.secondary'}}><IconNews size={24}/></Avatar>
        </ButtonBase>
        <Stack spacing={0.5} sx={{minWidth:0,flex:1}}>
          <ButtonBase onClick={()=>openArticle(post)} sx={{justifyContent:'flex-start',textAlign:'left',borderRadius:1}}><Typography fontWeight={600} sx={{overflowWrap:'anywhere'}}>{post.title}</Typography></ButtonBase>
          {post.publishedAt&&<Typography component="time" variant="caption" color="text.secondary" dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(language)}</Typography>}
          <Typography variant="body2" color="text.secondary" sx={{overflowWrap:'anywhere'}}>{post.description}{post.description?' ':''}<Link href={`/news/${post.locale}/${post.slug}`} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();openArticle(post);}}} aria-label={`${t('website.readMore')}: ${post.title}`} sx={{fontSize:'inherit',fontWeight:'inherit',whiteSpace:'nowrap'}}>{t('website.readMore')}</Link></Typography>
        </Stack>
      </ListItem>)}
    </List>}
    <Dialog open={dialogOpen&&!!selected&&selected.locale===language} onClose={()=>setDialogOpen(false)} fullWidth maxWidth="md" aria-labelledby={titleId}>
      <DialogTitle id={titleId} sx={{pr:7}}>{article?.title||selected?.title}<IconButton aria-label={t('website.close')} onClick={()=>setDialogOpen(false)} sx={{position:'absolute',top:8,right:8}}><IconX size={20}/></IconButton></DialogTitle>
      <DialogContent dividers>{articleError?<Alert severity="info">{articleError}</Alert>:article?<WebsiteContent content={{...article,title:'',description:''}} articleDialog/>:<Typography role="status">{t('website.loading')}</Typography>}</DialogContent>
    </Dialog>
  </Stack>;
}
