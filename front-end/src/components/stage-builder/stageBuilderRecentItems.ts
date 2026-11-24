import { useEffect, useRef, useState } from 'react';
import { catalogItem } from './stageBuilderCatalog';
import { recoverySourceKey, type StageRecoverySession } from './stageBuilderRecovery';
import type { StageSemanticKind } from './types';

export type LibraryItem = { type: 'object'; id: StageSemanticKind } | { type: 'prefab'; id: string };
export const MAX_RECENT_LIBRARY_ITEMS = 4;
type StageIdentity = Pick<StageRecoverySession['identity'], 'sourceLocator' | 'recoveryId'>;

export function sameLibraryItem(a: LibraryItem, b: LibraryItem) {
  return a.type === b.type && a.id === b.id;
}

export function toggleLibraryFavourite(items: LibraryItem[], item: LibraryItem): LibraryItem[] {
  return items.some(previous => sameLibraryItem(previous, item))
    ? items.filter(previous => !sameLibraryItem(previous, item))
    : [...items, item];
}

export function rememberLibraryItem(items: LibraryItem[], item: LibraryItem): LibraryItem[] {
  return [item, ...items.filter(previous => !sameLibraryItem(previous, item))].slice(0, MAX_RECENT_LIBRARY_ITEMS);
}

export function recentLibraryKey(scope: string | number | null | undefined, identity: StageIdentity | null): string | null {
  if (!identity) return null;
  const project = /^(Browser stage |Account stage |GitHub )/.test(identity.sourceLocator)
    ? recoverySourceKey(identity.sourceLocator)
    : `draft:${identity.recoveryId}`;
  return `fossbot.stageBuilder.recentItems.v1:${JSON.stringify([scope ?? 'anonymous', project])}`;
}

function readItems(key: string | null, limit?: number): LibraryItem[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    const items: LibraryItem[] = [];
    for (const item of value) {
      if (!item || typeof item.id !== 'string' || !item.id) continue;
      if (item.type !== 'prefab' && !(item.type === 'object' && catalogItem(item.id)?.placeable)) continue;
      if (!items.some(previous => previous.type === item.type && previous.id === item.id)) items.push({ type: item.type, id: item.id });
      if (items.length === limit) break;
    }
    return items;
  } catch (error) {
    console.warn('[stage-builder] Failed to read library items', error);
    return [];
  }
}

function writeItems(key: string | null, items: LibraryItem[]): void {
  if (!key) return;
  try {
    if (items.length) window.localStorage.setItem(key, JSON.stringify(items));
    else window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('[stage-builder] Failed to save library items', error);
  }
}

function loadLists(key: string | null) {
  return {
    key,
    recent: readItems(key, MAX_RECENT_LIBRARY_ITEMS),
    favourites: readItems(key && `${key}.favourites`),
  };
}

// A fresh, untouched stage has no recovery draft yet. Its history entry survives a reload.
export function restoreBlankStageFavourites(scope: string | number | null | undefined, identity: StageIdentity) {
  const previousId = window.history.state?.blankStageLibraryId;
  if (typeof previousId !== 'string' || previousId === identity.recoveryId) return;
  const previous = recentLibraryKey(scope, { ...identity, recoveryId: previousId });
  const favourites = readItems(`${previous}.favourites`);
  if (favourites.length) writeItems(`${recentLibraryKey(scope, identity)}.favourites`, favourites);
}

export function useLibraryShortlists(scope: string | number | null | undefined, identity: StageIdentity | null) {
  const key = recentLibraryKey(scope, identity);
  const [lists, setLists] = useState(() => loadLists(key));
  const latest = useRef(lists);
  latest.current = lists;
  if (lists.key !== key) setLists(loadLists(key));
  const blankId = identity?.sourceLocator === 'New stage' ? identity.recoveryId : null;
  useEffect(() => {
    if (blankId && window.history.state?.blankStageLibraryId !== blankId) {
      window.history.replaceState({ ...window.history.state, blankStageLibraryId: blankId }, '');
    }
  }, [blankId]);
  useEffect(() => { writeItems(lists.key, lists.recent); }, [lists.key, lists.recent]);
  useEffect(() => { writeItems(lists.key && `${lists.key}.favourites`, lists.favourites); }, [lists.key, lists.favourites]);

  return {
    recentLibraryItems: lists.recent,
    favouriteItems: lists.favourites,
    rememberRecentItem: (item: LibraryItem) => setLists(previous => ({ ...previous, recent: rememberLibraryItem(previous.recent, item) })),
    toggleFavourite: (item: LibraryItem) => setLists(previous => ({ ...previous, favourites: toggleLibraryFavourite(previous.favourites, item) })),
    carryLibraryItemsTo: (sourceLocator: string) => {
      if (!identity || latest.current.key !== key) return;
      const next = recentLibraryKey(scope, { ...identity, sourceLocator });
      writeItems(next, latest.current.recent);
      writeItems(next && `${next}.favourites`, latest.current.favourites);
    },
  };
}
