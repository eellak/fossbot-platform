import { backendUrl } from 'src/utils/backendUrl';
import type { TiptapNode } from 'src/courses/types';
export type WebsiteMenuItem = {id?:string;title:string;href:string;icon?:string;linkType?:'cms'|'url'};
export type WebsiteCard = {id?:string;title:string;text:string;href?:string;role?:string;organization?:string;image?:string;alt?:string};
export type Section = { id?:string; type: 'banner'|'text'|'image'|'cards'|'button'|'landing'|'feature'|'people'|'testimonials'|'latest-posts'|'projects'; group?: string; layout?: 'image-left'|'image-right'; values?: Record<string,string>; menu?: WebsiteMenuItem[]; title?: string; text?: string; fundingText?: string; content?: TiptapNode; image?: string; alt?: string; href?: string; buttonLabel?: string; cards?: WebsiteCard[] };
export type Translation = { locale: string; slug: string; title: string; description: string; sections: Section[]; revision: number; published?: Translation | null; publishedAt?: string | null };
export type Entry = { key: string; kind: 'home'|'page'|'post'; translations: Translation[] };
export type PublicEntry = Translation & { key: string; kind: Entry['kind'] };
export type PostSummary = Pick<PublicEntry,'key'|'kind'|'locale'|'title'|'description'|'slug'|'publishedAt'> & {thumbnail:string|null};
export type Media = { id:number; filename:string; url:string };
export type WebsiteRole = 'admin'|'editor'|'contributor'|'none';
export async function cms<T>(path: string, token = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${backendUrl}/website${path}`, { method, headers: { ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(body !== undefined ? {'Content-Type':'application/json'} : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${response.status})`); }
  return response.json();
}
export const contentLocale = (language: string) => language === 'gr' ? 'el' : language;
export const publicPath = (entry: PublicEntry) => entry.kind === 'home' ? '/landing-page' : `/${entry.kind === 'post' ? 'news' : 'pages'}/${entry.locale}/${entry.slug}`;
export const emptyDocument: TiptapNode = { type:'doc', content:[{type:'paragraph'}] };
