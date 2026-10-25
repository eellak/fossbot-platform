import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import LpHeader from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';
import ListCard from 'src/components/shared/ListCard';
import WebsiteContent from './WebsiteContent';
import { cms, contentLocale, publicPath, type PublicEntry } from './api';

export function WebsiteNavigation() {
  const {i18n,t}=useTranslation(), [items,setItems]=useState<PublicEntry[]>([]);
  useEffect(()=>{let active=true;cms<PublicEntry[]>(`/public?locale=${contentLocale(i18n.language)}`).then(data=>{if(active)setItems(data);}).catch(()=>{if(active)setItems([]);});return()=>{active=false;};},[i18n.language]);
  if(!items.some(x=>x.kind!=='home'))return null;
  return <Box component="nav" aria-label={t('website.websitePages')} sx={{borderBottom:1,borderColor:'divider'}}><Container maxWidth="lg"><Stack direction="row" flexWrap="wrap" gap={1} sx={{py:1}}>
    {items.filter(x=>x.kind==='page').map(item=><Button key={item.key} href={publicPath(item)}>{item.title}</Button>)}
    {items.some(x=>x.kind==='post')&&<Button href="/news">{t('website.news')}</Button>}
  </Stack></Container></Box>;
}

export default function WebsitePublic({ news=false }: {news?:boolean}) {
  const {locale,slug}=useParams(),{i18n,t}=useTranslation(),navigate=useNavigate();
  const [page,setPage]=useState<PublicEntry|null>(null),[posts,setPosts]=useState<PublicEntry[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const previousLanguage=useRef(i18n.language);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setPage(null);
    const request=news?cms<PublicEntry[]>(`/public?locale=${contentLocale(i18n.language)}`):cms<PublicEntry>(`/public/resolve/${locale}/${slug}`);
    request.then(data=>{if(!active)return;if(news)setPosts((data as PublicEntry[]).filter(x=>x.kind==='post'));else setPage(data as PublicEntry);}).catch(()=>{if(active)setError(t('website.notPublished'));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[locale,slug,news,news?i18n.language:'']); // URL identifies a published translation; news uses the chosen interface language.
  useEffect(()=>{
    if(previousLanguage.current===i18n.language)return;
    previousLanguage.current=i18n.language;
    if(!page||news)return;
    let active=true;
    cms<PublicEntry>(`/public/${page.key}/${contentLocale(i18n.language)}`).then(translated=>{if(active)navigate(publicPath(translated));}).catch(()=>{if(active)setError(t('website.notPublished'));});
    return()=>{active=false;};
  },[i18n.language,page?.key,news,navigate,t]);
  return <PageContainer title={page?.title||t('website.news')} description={page?.description||''}><LpHeader /><WebsiteNavigation />
    <Box component="main">
      {loading?<Container sx={{py:4}}><Typography role="status">{t('website.loading')}</Typography></Container>:error?<Container sx={{py:4}}><Alert severity="info">{error}</Alert></Container>:page?<WebsiteContent content={page} />:<Container sx={{py:5}}><Stack spacing={3}><Typography variant="h2" component="h1">{t('website.news')}</Typography>{!posts.length&&<Typography>{t('website.noPosts')}</Typography>}{posts.map(post=><ListCard key={post.key} title={post.title} description={post.description} onOpen={()=>navigate(publicPath(post))} meta={<Typography variant="caption">{post.publishedAt?new Date(post.publishedAt).toLocaleDateString():''}</Typography>} />)}</Stack></Container>}
    </Box><Footer /></PageContainer>;
}
