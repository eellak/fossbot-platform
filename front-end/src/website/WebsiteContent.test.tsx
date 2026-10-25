import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WebsiteContent, { websiteHref } from './WebsiteContent';
import { contentLocale, publicPath, type Translation } from './api';
declare const it:any,expect:any;
it('renders structured text and sections without executing embedded HTML',()=>{
 const content:Translation={locale:'el',slug:'test',title:'<script>bad</script>',description:'Περιγραφή',revision:1,sections:[
  {type:'text',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'<img onerror="bad" />'}]}]}},
  {type:'cards',cards:[{title:'Κάρτα',text:'Safe',href:'/dashboard'}]},
  {type:'button',buttonLabel:'Open',href:'/news'},
 ]};
 const html=renderToStaticMarkup(<WebsiteContent content={content} />);
 expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');expect(html).not.toContain('<script>');
 expect(html).toContain('Κάρτα');expect(html).toContain('href="/dashboard"');expect(html).toContain('href="/news"');
});
it('maps Greek interface codes to content locales and generates localized URLs',()=>{
 expect(contentLocale('gr')).toBe('el');expect(contentLocale('en-US')).toBe('en');
 expect(publicPath({kind:'post',locale:'el',slug:'nea'} as any)).toBe('/news/el/nea');
 expect(publicPath({kind:'page',locale:'en',slug:'about'} as any)).toBe('/pages/en/about');
});

it('blocks executable and protocol-relative links even in unsaved previews',()=>{
 expect(websiteHref('javascript:alert(1)')).toBeUndefined();
 expect(websiteHref('//untrusted.example')).toBeUndefined();
 expect(websiteHref('/\\untrusted.example')).toBeUndefined();
 expect(websiteHref('/safe')).toBe('/safe');
 expect(websiteHref('https://example.org')).toBe('https://example.org');
});
