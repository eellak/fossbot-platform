/**
 * Renders a Stage Builder object preview PNG.
 *
 * Pulls a cached data URL from `stageBuilderPreviews` and shows an `<img>`.
 * Subscribes to `stageBuilderPreviewSettings` so any setting tweak invalidates
 * the cache and the next render reflects the new look.
 *
 * Prefabs intentionally show a static placeholder — the current scope only
 * bakes per-kind primitives into static assets, not per-prefab renders.
 *
 * Use one of `kind`, `object`, or `prefab` — exactly one should be supplied.
 */

import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { EditorStageObject, StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { editorColors, editorTones } from './stageBuilderEditorTheme';
import { getKindPreview, getObjectPreview } from './stageBuilderPreviews';
import { usePreviewSettingsVersion } from './stageBuilderPreviewSettings';

export interface PreviewImageProps {
  kind?: StageSemanticKind;
  object?: EditorStageObject;
  prefab?: StageBuilderPrefab;
  width?: number;
  height?: number;
  alt?: string;
  /** Multiplier applied to the rendered image; default 1. */
  scale?: number;
}

const skeletonSx = {
  display: 'grid',
  placeItems: 'center',
  borderRadius: 0.5,
  bgcolor: editorColors.panelDisabled,
  color: editorColors.textMuted,
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
};

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown })?.then === 'function';
}

/**
 * Inline SVG placeholder for prefab tiles. Mirrors the previous
 * `PreviewShape` prefab look (2x2 colored grid) so the transition is
 * unnoticeable, but is purely declarative and doesn't depend on the live
 * preview pipeline.
 */
function PrefabPlaceholder({ width, height }: { width: number; height: number }) {
  const accent = editorTones.prefab.accent;
  const soft = `${accent}33`;
  return (
    <Box
      sx={{
        width,
        height,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '2px',
        padding: '2px',
        borderRadius: 0.5,
        bgcolor: editorColors.panelDisabled,
      }}
      role="presentation"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((cell) => (
        <Box key={cell} sx={{ bgcolor: cell === 0 ? accent : soft, border: `1px solid ${accent}66`, borderRadius: 0.25 }} />
      ))}
    </Box>
  );
}

export function PreviewImage({ kind, object, prefab, width = 44, height = 33, alt, scale = 1 }: PreviewImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  // A version counter bumped on settings changes so the effect re-fetches
  // even when `kind` is stable. Cheaper than watching the settings object.
  const settingsVersion = usePreviewSettingsVersion();

  const signature = kind ? `kind:${kind}` : object ? `object:${object.semanticKind || object.kind}` : prefab ? 'prefab' : 'empty';

  useEffect(() => {
    if (prefab) {
      // Prefabs are out of scope for the live renderer — show the static
      // placeholder immediately. No fetch, no skeleton flash.
      setSrc(null);
      return undefined;
    }
    let cancelled = false;
    setSrc(null);
    if (!kind && !object) return () => { cancelled = true; };

    const result = kind
      ? getKindPreview(kind)
      : getObjectPreview(object as EditorStageObject);

    if (typeof result === 'string') {
      setSrc(result);
      return () => { cancelled = true; };
    }
    if (isPromiseLike(result)) {
      result.then((url) => {
        if (!cancelled) setSrc(url || null);
      }).catch(() => {
        if (!cancelled) setSrc(null);
      });
    }
    return () => { cancelled = true; };
    // signature + settingsVersion intentionally drive the effect; the
    // underlying object identity is reflected in the signature.
  }, [signature, settingsVersion, kind, object, prefab]);

  const renderedWidth = Math.max(1, Math.round(width * scale));
  const renderedHeight = Math.max(1, Math.round(height * scale));

  if (prefab) {
    return <PrefabPlaceholder width={renderedWidth} height={renderedHeight} />;
  }

  if (!src) {
    return (
      <Box
        sx={{ ...skeletonSx, width: renderedWidth, height: renderedHeight }}
        aria-hidden="true"
        role="presentation"
      />
    );
  }

  return (
    <img
      src={src}
      width={renderedWidth}
      height={renderedHeight}
      alt={alt || ''}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain', userSelect: 'none' }}
    />
  );
}
