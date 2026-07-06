/**
 * Preview settings panel — temporary authoring tool.
 *
 * Keeps the authoring controls intentionally simple: make the primitive fill
 * the tile, choose a turn angle, pick a visible outline, and optionally tweak
 * color. Export still uses the live Three.js renderer, but the grid remains
 * lightweight SVG/CSS.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, FormControlLabel, IconButton, Slider, Stack, Switch, Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { StageSemanticKind } from './types';
import { PreviewShape, STAGE_BUILDER_LIBRARY_GROUPS, libraryLabel } from './StageObjectLibrary';
import { editorColors, editorTones, editorType, type EditorTone } from './stageBuilderEditorTheme';
import { PreviewImage } from './PreviewImage';
import { ColorPickerField } from './StageInspector';
import {
  buildSettingsSpec, fitDisplaySizeToTile, getKindSettings, getLibraryPreviewAreaSize, resetAllPreviewSettings, resetKindSettings, setKindSettings, setPreviewAuthoringKind, usePreviewSettingsVersion,
  DEFAULT_PREVIEW_SETTINGS, type PreviewSettings,
} from './stageBuilderPreviewSettings';
import { getKindPreview, PREVIEW_CONSTANTS } from './stageBuilderPreviews';

const PLACEABLE_KINDS = new Set(STAGE_BUILDER_LIBRARY_GROUPS.flatMap((group) => group.items));
const GRID_ICON_SIZE = 46;
const LIVE_PREVIEW_BOX = { width: 156, height: 156 };
const FILL_MIN = 70;
const FILL_MAX = 100;

const outlinePresets = [
  { label: 'Fine', thickness: 0.04 },
  { label: 'Clear', thickness: 0.06 },
  { label: 'Bold', thickness: 0.09 },
] as const;

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function kindFilename(kind: StageSemanticKind): string {
  return `preview-${kind}.png`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deg(value: number): number {
  return (value * 180) / Math.PI;
}

function rad(value: number): number {
  return (value * Math.PI) / 180;
}

function previewToneForKind(kind: StageSemanticKind, colorOverride?: string | null): EditorTone {
  const groupId = STAGE_BUILDER_LIBRARY_GROUPS.find((group) => group.items.includes(kind))?.id ?? 'structures';
  const baseTone = editorTones[groupId];
  return colorOverride ? { ...baseTone, accent: colorOverride } : baseTone;
}

function fillPercent(settings: PreviewSettings): number {
  const distanceMultiplier = Math.max(0.1, settings.padding * Math.max(0.1, settings.zoom));
  return clamp(Math.round(100 / distanceMultiplier), FILL_MIN, FILL_MAX);
}

function paddingForFill(fill: number): number {
  return Number((100 / clamp(fill, FILL_MIN, FILL_MAX)).toFixed(3));
}

function normalizedDegrees(value: number): number {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return Math.round(next);
}

function ChoiceButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={onClick}
      sx={{
        minWidth: 0,
        px: 0.875,
        bgcolor: active ? `${editorColors.accent}24` : undefined,
        borderColor: active ? `${editorColors.accentText}cc !important` : undefined,
        color: active ? `${editorColors.textStrong} !important` : undefined,
      }}
    >
      {children}
    </Button>
  );
}

function SimpleSlider({ label, value, min, max, step, valueLabel, helper, onChange }: { label: string; value: number; min: number; max: number; step: number; valueLabel: string; helper?: string; onChange: (value: number) => void }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="caption" sx={{ ...editorType.sectionLabel, color: editorColors.textMuted, flex: 1 }}>{label}</Typography>
        <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textStrong, fontWeight: 800 }}>{valueLabel}</Typography>
      </Stack>
      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, next) => onChange(Array.isArray(next) ? next[0] : next)}
        aria-label={label}
        sx={{ mt: 0.25 }}
      />
      {helper && <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textSubtle, display: 'block', mt: -0.25 }}>{helper}</Typography>}
    </Box>
  );
}

function PreviewGridItem({ kind, selected, onSelect }: { kind: StageSemanticKind; selected: boolean; onSelect: () => void }) {
  const settings = getKindSettings(kind);
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0.25,
        p: 0.5,
        border: `1px solid ${selected ? editorColors.accent : editorColors.border}`,
        borderRadius: 0.75,
        bgcolor: selected ? `${editorColors.accent}14` : editorColors.panelInset,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, background-color 120ms ease, transform 120ms ease',
        '&:hover': { borderColor: editorColors.borderStrong },
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 52 }}>
        <PreviewShape kind={kind} tone={previewToneForKind(kind, settings.objectColorOverride)} width={GRID_ICON_SIZE} height={GRID_ICON_SIZE} />
      </Box>
      <Typography variant="caption" noWrap sx={{ ...editorType.caption, color: editorColors.text, fontWeight: 700, textAlign: 'center' }}>
        {libraryLabel(kind)}
      </Typography>
    </Box>
  );
}

function KindDetails({ kind, settings, onChange, onReset }: { kind: StageSemanticKind; settings: PreviewSettings; onChange: (patch: Partial<PreviewSettings>) => void; onReset: () => void }) {
  const categoryTone = previewToneForKind(kind, settings.objectColorOverride);
  const fill = fillPercent(settings);
  const turn = normalizedDegrees(deg(settings.rotation[1]));
  const areaSize = getLibraryPreviewAreaSize();
  const fittedTileSize = areaSize ? fitDisplaySizeToTile(areaSize, { width: settings.width, height: settings.height }, 0) : settings.displaySize;
  const livePreviewSize = fitDisplaySizeToTile(LIVE_PREVIEW_BOX, { width: settings.width, height: settings.height }, 0);
  const outlinePreset = outlinePresets.reduce((closest, preset) => (
    Math.abs(preset.thickness - settings.outline.thickness) < Math.abs(closest.thickness - settings.outline.thickness) ? preset : closest
  ), outlinePresets[1]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 1.25, pb: 1.25, pt: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: categoryTone.accent, boxShadow: `0 0 0 2px ${categoryTone.surface}` }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" sx={{ ...editorType.panelTitle, lineHeight: 1.2 }}>{libraryLabel(kind)}</Typography>
          <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textSubtle }}>The matching library tile swaps to this live preview while selected.</Typography>
        </Box>
        <Tooltip title="Reset this kind to defaults">
          <IconButton size="small" onClick={onReset} aria-label="Reset to defaults">
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 174, border: `1px solid ${editorColors.border}`, borderRadius: 1, bgcolor: editorColors.panelInset }}>
        <PreviewImage kind={kind} width={livePreviewSize.width} height={livePreviewSize.height} />
      </Box>

      <Box sx={{ px: 0.875, py: 0.75, border: `1px solid ${editorColors.border}`, borderRadius: 0.75, bgcolor: `${editorColors.textMuted}0a` }}>
        <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textStrong, fontWeight: 800 }}>Library tile: auto-fit</Typography>
        <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textSubtle, display: 'block', mt: 0.25 }}>
          Uses the available image area and keeps the PNG aspect ratio. Current tile image: {Math.round(fittedTileSize.width)}×{Math.round(fittedTileSize.height)}.
        </Typography>
      </Box>

      <Box>
        <SimpleSlider
          label="Object fill"
          value={fill}
          min={FILL_MIN}
          max={FILL_MAX}
          step={1}
          valueLabel={`${fill}%`}
          helper="Bigger means less empty transparent padding. Use Max only if the silhouette still does not touch the edges."
          onChange={(value) => onChange({ padding: paddingForFill(value), zoom: 1 })}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
          <ChoiceButton active={fill === 82} onClick={() => onChange({ padding: paddingForFill(82), zoom: 1 })}>Roomy</ChoiceButton>
          <ChoiceButton active={fill === 92} onClick={() => onChange({ padding: paddingForFill(92), zoom: 1 })}>Fill</ChoiceButton>
          <ChoiceButton active={fill === 98} onClick={() => onChange({ padding: paddingForFill(98), zoom: 1 })}>Max</ChoiceButton>
        </Stack>
      </Box>

      <Box>
        <SimpleSlider
          label="Turn"
          value={turn}
          min={-180}
          max={180}
          step={15}
          valueLabel={`${turn}°`}
          helper="Rotate around the vertical axis only. The camera angle stays consistent across all primitives."
          onChange={(value) => onChange({ rotation: [settings.rotation[0], rad(value), settings.rotation[2]] })}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
          <ChoiceButton active={turn === 0} onClick={() => onChange({ rotation: [0, 0, 0] })}>Default</ChoiceButton>
          <ChoiceButton active={turn === 45} onClick={() => onChange({ rotation: [0, rad(45), 0] })}>45°</ChoiceButton>
          <ChoiceButton active={turn === 90} onClick={() => onChange({ rotation: [0, rad(90), 0] })}>90°</ChoiceButton>
        </Stack>
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ ...editorType.sectionLabel, color: editorColors.textMuted, flex: 1 }}>Outline</Typography>
          <FormControlLabel
            control={<Switch size="small" checked={settings.outline.enabled} onChange={(event) => onChange({ outline: { ...settings.outline, enabled: event.target.checked } })} />}
            label={<Typography variant="caption" sx={editorType.caption}>{settings.outline.enabled ? 'On' : 'Off'}</Typography>}
          />
        </Stack>
        <Typography variant="caption" sx={{ ...editorType.caption, color: editorColors.textSubtle, display: 'block', mt: 0.25 }}>
          White is the default because exported previews are transparent and editor tiles are dark.
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
          <ChoiceButton active={settings.outline.color.toLowerCase() === '#ffffff'} onClick={() => onChange({ outline: { ...settings.outline, enabled: true, color: '#ffffff' } })}>White</ChoiceButton>
          <ChoiceButton active={settings.outline.color.toLowerCase() === '#26323a'} onClick={() => onChange({ outline: { ...settings.outline, enabled: true, color: '#26323a' } })}>Dark</ChoiceButton>
          {outlinePresets.map((preset) => (
            <ChoiceButton
              key={preset.label}
              active={outlinePreset.label === preset.label}
              onClick={() => onChange({ outline: { ...settings.outline, enabled: true, thickness: preset.thickness } })}
            >
              {preset.label}
            </ChoiceButton>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="caption" sx={{ ...editorType.sectionLabel, color: editorColors.textMuted }}>Object color</Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <ColorPickerField
            value={settings.objectColorOverride || categoryTone.accent}
            pickerAriaLabel="Object color picker"
            valueAriaLabel="Object color value"
            onChange={(color) => onChange({ objectColorOverride: color })}
          />
          <Button size="small" variant="outlined" onClick={() => onChange({ objectColorOverride: null })}>Use category default</Button>
        </Stack>
      </Box>
    </Box>
  );
}

export function PreviewSettingsPanel() {
  const version = usePreviewSettingsVersion();
  const [selectedKind, setSelectedKind] = useState<StageSemanticKind | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const settingsByKind = useMemo(() => {
    const map = new Map<StageSemanticKind, PreviewSettings>();
    for (const group of STAGE_BUILDER_LIBRARY_GROUPS) {
      for (const kind of group.items) {
        if (!PLACEABLE_KINDS.has(kind)) continue;
        map.set(kind, getKindSettings(kind));
      }
    }
    return map;
  }, [version]);

  const orderedKinds = useMemo(() => STAGE_BUILDER_LIBRARY_GROUPS.flatMap((group) => group.items.filter((kind) => PLACEABLE_KINDS.has(kind))), []);
  const selectedSettings = selectedKind ? settingsByKind.get(selectedKind) || DEFAULT_PREVIEW_SETTINGS : null;

  useEffect(() => {
    setPreviewAuthoringKind(selectedKind);
    return () => setPreviewAuthoringKind(null);
  }, [selectedKind]);

  const handleExportPngs = async () => {
    setExporting(true);
    setExportStatus(null);
    try {
      for (const kind of orderedKinds) {
        const result = getKindPreview(kind);
        const url = typeof result === 'string' ? result : await result;
        if (url) downloadDataUrl(url, kindFilename(kind));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      setExportStatus(`Downloaded ${orderedKinds.length} PNGs.`);
    } catch (error) {
      setExportStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCopySpec = async () => {
    const spec = buildSettingsSpec(`#${PREVIEW_CONSTANTS.BACKGROUND.toString(16).padStart(6, '0')}`, PREVIEW_CONSTANTS.FOV);
    const text = JSON.stringify(spec, null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setExportStatus('Settings spec copied to clipboard.');
      } else {
        const fallback = window.prompt('Copy this settings spec:', text);
        if (fallback !== null) setExportStatus('Settings spec ready to copy.');
      }
    } catch (error) {
      setExportStatus(`Copy failed: ${(error as Error).message}`);
    }
  };

  return (
    <Stack spacing={0} sx={{ color: editorColors.text }}>
      <Box sx={{ px: 1.25, py: 0.875, borderBottom: `1px solid ${editorColors.border}`, bgcolor: editorColors.panel }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ ...editorType.panelTitle, lineHeight: 1.2 }}>Preview Primitives</Typography>
            <Typography variant="caption" sx={editorType.caption}>Simple pass: make each primitive big, outlined, and recognizable.</Typography>
          </Box>
          <Tooltip title="Reset all kinds to defaults">
            <IconButton size="small" aria-label="Reset all" onClick={resetAllPreviewSettings}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon fontSize="small" />} onClick={handleExportPngs} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export PNGs'}
          </Button>
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon fontSize="small" />} onClick={handleCopySpec}>
            Copy spec
          </Button>
        </Stack>
        {exportStatus && <Typography variant="caption" sx={{ ...editorType.caption, mt: 0.5, display: 'block' }}>{exportStatus}</Typography>}
      </Box>

      <Box sx={{ p: 1.25 }}>
        <Typography variant="caption" sx={{ ...editorType.sectionLabel, color: editorColors.textMuted }}>Kinds</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5, mt: 0.5 }}>
          {orderedKinds.map((kind) => (
            <PreviewGridItem key={kind} kind={kind} selected={kind === selectedKind} onSelect={() => setSelectedKind((current) => current === kind ? null : kind)} />
          ))}
        </Box>
      </Box>

      {selectedKind && selectedSettings && (
        <Box sx={{ borderTop: `2px solid ${editorColors.border}` }}>
          <KindDetails
            kind={selectedKind}
            settings={selectedSettings}
            onChange={(patch) => setKindSettings(selectedKind, patch)}
            onReset={() => resetKindSettings(selectedKind)}
          />
        </Box>
      )}
    </Stack>
  );
}
