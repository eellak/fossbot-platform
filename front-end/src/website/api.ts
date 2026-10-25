import { backendUrl } from 'src/utils/backendUrl';
import type { TiptapNode } from 'src/courses/types';
export type Section = { type: 'banner'|'text'|'image'|'cards'|'button'; title?: string; text?: string; content?: TiptapNode; image?: string; alt?: string; href?: string; buttonLabel?: string; cards?: {title:string;text:string;href?:string}[] };
export type Translation = { locale: string; slug: string; title: string; description: string; sections: Section[]; revision: number; published?: Translation | null; publishedAt?: string | null };
export type Entry = { key: string; kind: 'home'|'page'|'post'; translations: Translation[] };
export type PublicEntry = Translation & { key: string; kind: Entry['kind'] };
export type Media = { id:number; filename:string; url:string };
export type WebsiteRole = 'admin'|'editor'|'contributor'|'none';
export async function cms<T>(path: string, token = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${backendUrl}/website${path}`, { method, headers: { ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(body !== undefined ? {'Content-Type':'application/json'} : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${response.status})`); }
  return response.json();
}
export const contentLocale = (language: string) => language.split('-')[0] === 'gr' ? 'el' : language.split('-')[0];
export const publicPath = (entry: PublicEntry) => entry.kind === 'home' ? '/landing-page' : `/${entry.kind === 'post' ? 'news' : 'pages'}/${entry.locale}/${entry.slug}`;
export const emptyDocument: TiptapNode = { type:'doc', content:[{type:'paragraph'}] };
