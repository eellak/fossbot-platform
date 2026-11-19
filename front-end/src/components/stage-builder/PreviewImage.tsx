import React, { useContext, useEffect, useMemo, useState } from 'react';
import { createStageAssetResolver } from 'src/simulator/stages/assets';
import { Box } from '@mui/material';
import type { EditorStageObject, StageSemanticKind } from './types';
import type { StageBuilderPrefab } from './stageBuilderPrefabs';
import { useEditorTheme } from './stageBuilderEditorTheme';
import { getKindPreview, getObjectPreview, getPrefabPreview } from './stageBuilderPreviews';
import { usePreviewSettingsVersion } from './stageBuilderPreviewSettings';
import { hasSemanticArtwork, StageSemanticArtwork } from './stageBuilderLibraryArtwork';

export const PreviewAssetBaseContext = React.createContext<string | null>(null);

export interface PreviewImageProps {
  kind?: StageSemanticKind;
  object?: EditorStageObject;
  prefab?: StageBuilderPrefab;
  width?: number;
  height?: number;
  alt?: string;
  scale?: number;
}

function semanticKind(object?: EditorStageObject): StageSemanticKind | undefined {
  if (!object) return undefined;
  if (object.kind === 'model') return undefined;
  return object.semanticKind || ({ fossbot: 'robotSpawn', line: 'line', text: 'label', arrow: 'directionArrow', light: 'light', camera: 'camera', audio: 'audio' } as Partial<Record<EditorStageObject['kind'], StageSemanticKind>>)[object.kind];
}

export function PreviewImage({ kind, object, prefab, width = 44, height = 33, alt = '', scale = 1 }: PreviewImageProps) {
  const { colors } = useEditorTheme();
  const stageAssetBaseUrl = useContext(PreviewAssetBaseContext);
  const resolvedObject = useMemo(() => object?.kind === 'model'
    ? { ...object, filename: createStageAssetResolver({ stageAssetBaseUrl })(object.filename) }
    : object, [object, stageAssetBaseUrl]);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const settingsVersion = usePreviewSettingsVersion();
  const symbol = kind || semanticKind(object);
  const semantic = hasSemanticArtwork(symbol);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (semantic) return;
    setSrc(null);
    Promise.resolve().then(() => prefab ? getPrefabPreview(prefab) : resolvedObject ? getObjectPreview(resolvedObject) : kind ? getKindPreview(kind) : '')
      .then(url => { if (!cancelled) { setSrc(url || null); setFailed(!url); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [kind, resolvedObject, prefab, semantic, settingsVersion]);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  if (semantic && symbol) return <StageSemanticArtwork kind={symbol} width={w} height={h} />;
  if (!src) return <Box role="status" aria-label={failed ? 'Preview unavailable' : 'Loading preview'} sx={{ width: w, height: h, display: 'grid', placeItems: 'center', color: colors.textMuted, fontSize: '0.625rem', textAlign: 'center' }}>{failed ? 'No preview' : 'Loading…'}</Box>;
  return <img src={src} width={w} height={h} alt={alt} draggable={false} style={{ display: 'block', objectFit: 'contain', userSelect: 'none' }} />;
}
