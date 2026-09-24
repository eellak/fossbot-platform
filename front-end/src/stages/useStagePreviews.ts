import { useEffect, useRef, useState } from 'react';
import { fetchLocalStagePreview } from './LocalStagesApi';

/**
 * Loads private local-stage previews as object URLs, keyed by the protected
 * `previewUrl`. The preview endpoint needs the bearer token, so an `<img src>`
 * cannot point at it directly.
 *
 * The key is derived from the URLs (not the array) so callers can pass a fresh
 * array each render without re-running the effect.
 */
export function useStagePreviews(token: string | null, previewUrls: Array<string | null | undefined>): Record<string, string> {
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const previewKey = previewUrls.filter((url): url is string => Boolean(url)).join('|');

  useEffect(() => {
    if (!token || !previewKey) return undefined;
    let active = true;
    previewKey.split('|').forEach((previewUrl) => {
      if (objectUrlsRef.current.has(previewUrl)) return;
      void fetchLocalStagePreview(token, previewUrl)
        .then((objectUrl) => {
          if (!active) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          objectUrlsRef.current.set(previewUrl, objectUrl);
          setObjectUrls((current) => ({ ...current, [previewUrl]: objectUrl }));
        })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, [previewKey, token]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  return objectUrls;
}
