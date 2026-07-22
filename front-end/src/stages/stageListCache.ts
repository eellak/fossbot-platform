import type { User } from 'src/authentication/AuthInterfaces';
import { getMarketplaceIndex, getMyMarketplaceStages, type MarketplaceIndexResponse, type MyMarketplaceStage } from './MarketplaceApi';
import { listProviderStages, type ProviderStageListItem } from './StagesApi';

export const MARKETPLACE_FIRST_PAGE_REQUEST = {
  page: 1,
  pageSize: 24,
  sort: 'updated' as const,
};

const STORAGE_PREFIX = 'fossbot:stage-list-cache:v1';
const MARKETPLACE_STORAGE_KEY = `${STORAGE_PREFIX}:marketplace-first-page`;
const USER_STORAGE_PREFIX = `${STORAGE_PREFIX}:user:`;
const MY_MARKETPLACE_STORAGE_PREFIX = `${STORAGE_PREFIX}:my-marketplace:`;
const MARKETPLACE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const USER_STAGES_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MARKETPLACE_REFRESH_AFTER_MS = 15 * 60 * 1000;
const USER_STAGES_REFRESH_AFTER_MS = 5 * 60 * 1000;

export interface StageListSnapshot<T> {
  data: T | null;
  updatedAt: number | null;
  refreshing: boolean;
  refreshError: string | null;
}

interface PersistedStageList<T> {
  data: T;
  updatedAt: number;
}

type Listener = () => void;

interface CacheRecord<T> {
  snapshot: StageListSnapshot<T>;
  listeners: Set<Listener>;
  refreshPromise: Promise<void> | null;
  storageKey: string;
  version: number;
}

let marketplaceCache: CacheRecord<MarketplaceIndexResponse> | null = null;
const userCaches = new Map<string, CacheRecord<ProviderStageListItem[]>>();
const myMarketplaceCaches = new Map<string, CacheRecord<MyMarketplaceStage[]>>();

function emptySnapshot<T>(): StageListSnapshot<T> {
  return { data: null, updatedAt: null, refreshing: false, refreshError: null };
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readPersisted<T>(storageKey: string, fallbackMs: number): StageListSnapshot<T> {
  if (!storageAvailable()) return emptySnapshot<T>();
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as PersistedStageList<T> | null;
    if (!stored || !stored.data || typeof stored.updatedAt !== 'number' || Date.now() - stored.updatedAt > fallbackMs) {
      window.localStorage.removeItem(storageKey);
      return emptySnapshot<T>();
    }
    return { data: stored.data, updatedAt: stored.updatedAt, refreshing: false, refreshError: null };
  } catch {
    return emptySnapshot<T>();
  }
}

function persist<T>(cache: CacheRecord<T>): void {
  if (!storageAvailable() || !cache.snapshot.data || !cache.snapshot.updatedAt) return;
  window.localStorage.setItem(cache.storageKey, JSON.stringify({ data: cache.snapshot.data, updatedAt: cache.snapshot.updatedAt }));
}

function notify<T>(cache: CacheRecord<T>): void {
  cache.listeners.forEach((listener) => listener());
}

function createCache<T>(storageKey: string, fallbackMs: number): CacheRecord<T> {
  return {
    snapshot: readPersisted<T>(storageKey, fallbackMs),
    listeners: new Set(),
    refreshPromise: null,
    storageKey,
    version: 0,
  };
}

function marketplaceRecord(): CacheRecord<MarketplaceIndexResponse> {
  if (!marketplaceCache) marketplaceCache = createCache<MarketplaceIndexResponse>(MARKETPLACE_STORAGE_KEY, MARKETPLACE_FALLBACK_MS);
  return marketplaceCache;
}

function userRecord(userKey: string): CacheRecord<ProviderStageListItem[]> {
  const existing = userCaches.get(userKey);
  if (existing) return existing;
  const created = createCache<ProviderStageListItem[]>(`${USER_STORAGE_PREFIX}${encodeURIComponent(userKey)}`, USER_STAGES_FALLBACK_MS);
  userCaches.set(userKey, created);
  return created;
}

function myMarketplaceRecord(userKey: string): CacheRecord<MyMarketplaceStage[]> {
  const existing = myMarketplaceCaches.get(userKey);
  if (existing) return existing;
  const created = createCache<MyMarketplaceStage[]>(`${MY_MARKETPLACE_STORAGE_PREFIX}${encodeURIComponent(userKey)}`, USER_STAGES_FALLBACK_MS);
  myMarketplaceCaches.set(userKey, created);
  return created;
}

function subscribe<T>(cache: CacheRecord<T>, listener: Listener): () => void {
  cache.listeners.add(listener);
  return () => cache.listeners.delete(listener);
}

function isFreshEnough(updatedAt: number | null, thresholdMs: number): boolean {
  return !!updatedAt && Date.now() - updatedAt < thresholdMs;
}

function invalidate<T>(cache: CacheRecord<T>): void {
  cache.version += 1;
  cache.snapshot = { ...cache.snapshot, updatedAt: null, refreshing: false, refreshError: null };
  if (storageAvailable()) window.localStorage.removeItem(cache.storageKey);
  notify(cache);
}

function refresh<T>(cache: CacheRecord<T>, load: () => Promise<T>, force = false, thresholdMs: number): Promise<void> {
  if (cache.refreshPromise) {
    return force ? cache.refreshPromise.then(() => refresh(cache, load, true, thresholdMs)) : cache.refreshPromise;
  }
  if (!force && isFreshEnough(cache.snapshot.updatedAt, thresholdMs)) return Promise.resolve();

  const requestVersion = cache.version;
  cache.snapshot = { ...cache.snapshot, refreshing: true, refreshError: null };
  notify(cache);
  cache.refreshPromise = load()
    .then((data) => {
      if (cache.version !== requestVersion) return;
      cache.snapshot = { data, updatedAt: Date.now(), refreshing: false, refreshError: null };
      persist(cache);
    })
    .catch(() => {
      if (cache.version !== requestVersion) return;
      cache.snapshot = {
        ...cache.snapshot,
        refreshing: false,
        refreshError: cache.snapshot.data ? 'Couldn’t check for updates. Showing the most recent list.' : 'Couldn’t check for updates.',
      };
    })
    .finally(() => {
      cache.refreshPromise = null;
      notify(cache);
    });
  return cache.refreshPromise;
}

/** Returns a stable key for data that must never cross signed-in users. */
export function stageListUserKey(user: User | null): string | null {
  if (!user) return null;
  return `platform:${user.id}:${user.username}`;
}

export function marketplaceFirstPageSnapshot(): StageListSnapshot<MarketplaceIndexResponse> {
  return marketplaceRecord().snapshot;
}

export function subscribeMarketplaceFirstPage(listener: Listener): () => void {
  return subscribe(marketplaceRecord(), listener);
}

export function refreshMarketplaceFirstPage(options: { force?: boolean } = {}): Promise<void> {
  return refresh(
    marketplaceRecord(),
    () => getMarketplaceIndex({ ...MARKETPLACE_FIRST_PAGE_REQUEST, refresh: !!options.force }),
    options.force,
    MARKETPLACE_REFRESH_AFTER_MS,
  );
}

export function invalidateMarketplaceFirstPage(): void {
  invalidate(marketplaceRecord());
}

export function userStagesSnapshot(userKey: string): StageListSnapshot<ProviderStageListItem[]> {
  return userRecord(userKey).snapshot;
}

export function subscribeUserStages(userKey: string, listener: Listener): () => void {
  return subscribe(userRecord(userKey), listener);
}

export function refreshUserStages(userKey: string, token: string, options: { force?: boolean } = {}): Promise<void> {
  return refresh(userRecord(userKey), () => listProviderStages(token), options.force, USER_STAGES_REFRESH_AFTER_MS);
}

export function invalidateUserStages(userKey: string): void {
  invalidate(userRecord(userKey));
}

/** Private cached marketplace listings authored by the signed-in GitHub account. */
export function myMarketplaceStagesSnapshot(userKey: string): StageListSnapshot<MyMarketplaceStage[]> {
  return myMarketplaceRecord(userKey).snapshot;
}

export function subscribeMyMarketplaceStages(userKey: string, listener: Listener): () => void {
  return subscribe(myMarketplaceRecord(userKey), listener);
}

export function refreshMyMarketplaceStages(userKey: string, token: string, options: { force?: boolean } = {}): Promise<void> {
  return refresh(myMarketplaceRecord(userKey), async () => (await getMyMarketplaceStages(token)).stages, options.force, USER_STAGES_REFRESH_AFTER_MS);
}

export function invalidateMyMarketplaceStages(userKey: string): void {
  invalidate(myMarketplaceRecord(userKey));
}

/** Refreshes both shared lists without clearing either currently visible result. */
export async function refreshStageLists(userKey: string | null, token: string, options: { force?: boolean } = {}): Promise<void> {
  const requests = [refreshMarketplaceFirstPage(options)];
  if (userKey && token) requests.push(refreshUserStages(userKey, token, options));
  await Promise.all(requests);
}

/** Removes all private stage metadata when a user signs out. */
export function clearUserStageCaches(): void {
  if (storageAvailable()) {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(USER_STORAGE_PREFIX) || key.startsWith(MY_MARKETPLACE_STORAGE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  }
  userCaches.forEach((cache) => {
    cache.version += 1;
    cache.snapshot = emptySnapshot();
    notify(cache);
  });
  userCaches.clear();
  myMarketplaceCaches.forEach((cache) => {
    cache.version += 1;
    cache.snapshot = emptySnapshot();
    notify(cache);
  });
  myMarketplaceCaches.clear();
}
