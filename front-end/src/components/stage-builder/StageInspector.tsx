import React from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, FormControlLabel,
  MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Sketch, Swatch } from '@uiw/react-color';
import type { EditorCameraObject, EditorStageObject, StageAudioSourceType, StageLabelFace, StageLightSubtype, StageSemanticKind, Vec2, Vec3 } from './types';
import { displayObjectType, STAGE_OBJECT_CATALOG } from './stageBuilderCatalog';
import { editorColors, editorType } from './stageBuilderEditorTheme';
import { StageBuilderNumberField } from './StageBuilderNumberField';

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function supportsColor(object: EditorStageObject): object is Extract<EditorStageObject, { color: string }> {
  return object.kind === 'base' || object.kind === 'cube' || object.kind === 'cylinder' || object.kind === 'line' || object.kind === 'text' || object.kind === 'light';
}

function supportsAppearance(object: EditorStageObject): boolean {
  return supportsColor(object);
}

function updateVec3(vec: Vec3, index: number, value: unknown): Vec3 {
  const next: Vec3 = [...vec] as Vec3;
  next[index] = num(value, vec[index]);
  return next;
}

function updateVec2(vec: Vec2, index: number, value: unknown): Vec2 {
  const next: Vec2 = [...vec] as Vec2;
  next[index] = num(value, vec[index]);
  return next;
}

function deg(rad: number): number {
  return Number((rad * 180 / Math.PI).toFixed(2));
}

function rad(degValue: number): number {
  return degValue * Math.PI / 180;
}

function isLabelAttachTarget(object: EditorStageObject): boolean {
  return object.kind === 'base' || object.kind === 'cube' || object.kind === 'cylinder';
}

function defaultLabelFace(parent?: EditorStageObject | null): StageLabelFace {
  return parent?.kind === 'base' ? 'top' : 'front';
}

function labelStyle(object: Extract<EditorStageObject, { kind: 'text' }>) {
  return {
    backgroundVisible: object.style?.backgroundVisible ?? true,
    backgroundSize: object.style?.backgroundSize || [object.scale, object.scale * 0.3125] as [number, number],
    backgroundColor: object.style?.backgroundColor || '#ffffff',
    backgroundOpacity: object.style?.backgroundOpacity ?? 0.9,
    borderVisible: object.style?.borderVisible ?? true,
    borderColor: object.style?.borderColor || '#0f172a',
    borderWidth: object.style?.borderWidth ?? 8,
    fontSize: object.style?.fontSize ?? 56,
  };
}

function minPositive(value: unknown, fallback = 0.01, minimum = 0.01): number {
  return Math.max(minimum, num(value, fallback));
}

function clamp01(value: unknown, fallback: number): number {
  return Math.min(1, Math.max(0, num(value, fallback)));
}

function resolveAudioPreviewUrl(source: string, sourceType: StageAudioSourceType): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/js-simulator/')) return `/simulator${trimmed.slice('/js-simulator'.length)}`;
  if (trimmed.startsWith('js-simulator/')) return `/simulator/${trimmed.slice('js-simulator/'.length)}`;
  if (trimmed.startsWith('/')) return trimmed;
  return sourceType === 'file' ? `/simulator/${trimmed}` : trimmed;
}

const COLOR_PRESETS = [
  '#4D4D4D', '#999999', '#FFFFFF', '#F44E3B', '#FE9200', '#FCDC00',
  '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF',
  '#333333', '#808080', '#CCCCCC', '#D33115', '#E27300', '#FCC400',
  '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF',
  '#000000', '#666666', '#B3B3B3', '#9F0500', '#C45100', '#FB9E00',
  '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E',
];

let colorParserCanvas: HTMLCanvasElement | null = null;

function channelToHex(channel: number): string {
  return channel.toString(16).padStart(2, '0');
}

function normalizeHexColor(value: string): string | null {
  const match = value.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((char) => char + char).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

function cssColorToHex(value: string): string | null {
  if (typeof document === 'undefined') return null;

  const canvas = colorParserCanvas || (colorParserCanvas = document.createElement('canvas'));
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.fillStyle = '#000001';
    ctx.fillStyle = value;
    const first = String(ctx.fillStyle);
    ctx.fillStyle = '#000002';
    ctx.fillStyle = value;
    const second = String(ctx.fillStyle);
    if (first === '#000001' && second === '#000002') return null;

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = first;
    ctx.fillRect(0, 0, 1, 1);
    const [red, green, blue] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
  } catch {
    return null;
  }
}

function normalizeColorValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeHexColor(trimmed) || cssColorToHex(trimmed);
}

function colorInputValue(value: string): string {
  return normalizeColorValue(value) || '#ffffff';
}

export interface StageInspectorProps {
  object: EditorStageObject | null;
  selectedCount?: number;
  advancedOpen?: boolean;
  onAdvancedOpenChange?: (open: boolean) => void;
  onChange: (object: EditorStageObject) => void;
  objects?: EditorStageObject[];
  onLookThroughCamera?: (camera: EditorCameraObject) => void;
  // Kept for deprecated drawer callers; deletion now lives outside the inspector body.
  onDelete?: (id: string) => void;
}

const commonNumberProps = { type: 'number', size: 'small' as const, fullWidth: true, inputProps: { step: 0.1 } };
const commonFieldProps = { size: 'small' as const, fullWidth: true };

function FieldRow({ label, children, align = 'center', noPadding = false }: { label: string; children: React.ReactNode; align?: 'center' | 'start'; noPadding?: boolean }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 0.75, alignItems: align, px: noPadding ? 0 : 1.25, py: noPadding ? 0 : 0.5 }}>
      <Typography variant="body2" sx={{ ...editorType.body, color: editorColors.textMuted, lineHeight: 1.2 }}>{label}</Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function FullRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ px: 1.25, py: 0.75 }}>{children}</Box>;
}

function InlineFields({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ minWidth: 0, '& > *': { flex: 1, minWidth: 0 } }}>
      {children}
    </Stack>
  );
}

function Section({ title, children, meta, defaultExpanded = true, expanded, onChange }: { title: string; children: React.ReactNode; meta?: string; defaultExpanded?: boolean; expanded?: boolean; onChange?: (open: boolean) => void }) {
  return (
    <Accordion defaultExpanded={expanded === undefined ? defaultExpanded : undefined} expanded={expanded} onChange={(_, open) => onChange?.(open)} disableGutters square>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ width: 18, height: 18, color: editorColors.textMuted }} />}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
          <Typography variant="caption" noWrap sx={{ ...editorType.sectionLabel, color: editorColors.textStrong }}>{title}</Typography>
          {meta && <Typography variant="caption" noWrap sx={{ ...editorType.caption, ml: 'auto' }}>{meta}</Typography>}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ py: 0.5 }}>{children}</Box>
      </AccordionDetails>
    </Accordion>
  );
}

function EnabledSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange?: (checked: boolean) => void }) {
  return <Switch size="small" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} />;
}

export function ColorPickerField({
  value,
  disabled,
  onChange,
  pickerAriaLabel = 'Color picker',
  valueAriaLabel = 'Color value',
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  pickerAriaLabel?: string;
  valueAriaLabel?: string;
}) {
  const currentHex = colorInputValue(value);
  const [draftHex, setDraftHex] = React.useState(currentHex);
  const draftHexRef = React.useRef(currentHex);
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const [pickerWidth, setPickerWidth] = React.useState(180);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const setDraftColor = React.useCallback((nextValue: string) => {
    draftHexRef.current = nextValue;
    setDraftHex(nextValue);
  }, []);

  React.useEffect(() => {
    const nextHex = colorInputValue(value);
    setDraftColor(nextHex);
  }, [setDraftColor, value]);

  React.useEffect(() => {
    const element = pickerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const updateWidth = () => {
      const width = Math.floor(element.getBoundingClientRect().width);
      if (width > 0) setPickerWidth(Math.max(96, Math.min(180, width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const commitColor = React.useCallback((nextValue: string): boolean => {
    const normalized = normalizeColorValue(nextValue);
    if (!normalized) return false;
    setDraftColor(normalized);
    if (normalized.toLowerCase() !== currentHex.toLowerCase()) onChange(normalized);
    return true;
  }, [currentHex, onChange, setDraftColor]);

  const commitDraft = React.useCallback(() => {
    commitColor(draftHexRef.current);
  }, [commitColor]);

  const sketchStyle = {
    '--sketch-background': editorColors.panelInset,
    '--sketch-box-shadow': 'none',
    '--sketch-alpha-box-shadow': 'none',
    '--editable-input-label-color': editorColors.textMuted,
    '--editable-input-box-shadow': '#33424c 0 0 0 1px inset',
    '--editable-input-color': editorColors.textStrong,
    borderRadius: 6,
  } as React.CSSProperties;

  return (
    <Stack ref={pickerRef} spacing={0.75}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 0.75, alignItems: 'center' }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 0.75, bgcolor: draftHex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.24)' }} />
        <Typography variant="caption" noWrap sx={{ ...editorType.caption, color: editorColors.textMuted }}>{draftHex}</Typography>
      </Box>

      <Box sx={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        <Swatch
          aria-label={pickerAriaLabel}
          colors={COLOR_PRESETS}
          color={draftHex}
          onChange={(_, color) => commitColor(color.hex)}
          rectProps={{
            style: {
              width: 20,
              height: 20,
              marginRight: 5,
              marginBottom: 5,
              borderRadius: 3,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.24)',
            },
          }}
          style={{ maxWidth: pickerWidth }}
        />
      </Box>

      <Box
        component="button"
        type="button"
        onClick={() => setAdvancedOpen((open) => !open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          p: 0,
          border: 0,
          bgcolor: 'transparent',
          color: '#ffffff',
          font: 'inherit',
          fontSize: '0.8125rem',
          fontWeight: 650,
          cursor: 'pointer',
          '&:hover': { color: '#ffffff' },
          '&:focus-visible': { outline: 'none', textDecoration: 'underline' },
        }}
      >
        <span>Advanced color</span>
        <ExpandMoreIcon sx={{ width: 16, height: 16, color: 'inherit', transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms ease' }} />
      </Box>

      {advancedOpen && (
        <Box
          sx={{
            opacity: disabled ? 0.45 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            '& .w-color-editable-input input': {
              bgcolor: '#111820 !important',
              boxShadow: `0 0 0 1px ${editorColors.borderStrong} inset !important`,
              color: `${editorColors.textStrong} !important`,
              fontWeight: '700 !important',
            },
            '& .w-color-editable-input label': { color: `${editorColors.textMuted} !important` },
          }}
        >
          <Sketch
            aria-label={valueAriaLabel}
            color={draftHex}
            width={pickerWidth}
            disableAlpha
            editableDisable
            presetColors={false}
            style={sketchStyle}
            onChange={(color) => setDraftColor(color.hex)}
            onMouseUp={commitDraft}
            onTouchEnd={commitDraft}
            onBlur={commitDraft}
          />
        </Box>
      )}
    </Stack>
  );
}

export function StageInspector({ object, selectedCount = object ? 1 : 0, advancedOpen = false, onAdvancedOpenChange, onChange, objects = [], onLookThroughCamera }: StageInspectorProps) {
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);
  const [audioPreviewError, setAudioPreviewError] = React.useState<string | null>(null);
  const stopAudioPreview = React.useCallback(() => {
    if (!audioPreviewRef.current) return;
    audioPreviewRef.current.pause();
    audioPreviewRef.current.currentTime = 0;
    audioPreviewRef.current.onended = null;
    audioPreviewRef.current.onerror = null;
    audioPreviewRef.current = null;
  }, []);
  const testAudioPreview = React.useCallback((source: string, sourceType: StageAudioSourceType, volume: number) => {
    const url = resolveAudioPreviewUrl(source, sourceType);
    setAudioPreviewError(null);
    if (!url) {
      setAudioPreviewError('Add an audio source before testing.');
      return;
    }
    stopAudioPreview();
    const preview = new Audio(url);
    preview.volume = clamp01(volume, 0.8);
    preview.onended = () => {
      if (audioPreviewRef.current === preview) audioPreviewRef.current = null;
    };
    preview.onerror = () => {
      if (audioPreviewRef.current === preview) audioPreviewRef.current = null;
      setAudioPreviewError('Could not load this audio source. Check the path, file type, or CORS settings.');
    };
    audioPreviewRef.current = preview;
    preview.play().catch((error) => {
      console.warn('[stage-builder] audio preview failed', error);
      if (audioPreviewRef.current === preview) audioPreviewRef.current = null;
      setAudioPreviewError('Could not play this audio source. Check the path, file type, or browser audio permissions.');
    });
  }, [stopAudioPreview]);
  React.useEffect(() => stopAudioPreview, [stopAudioPreview]);

  if (!object) {
    return <FullRow><Alert severity="info">Select an object in the viewport or Scene hierarchy to inspect it.</Alert></FullRow>;
  }

  const set = (patch: Partial<EditorStageObject>) => onChange({ ...object, ...patch } as EditorStageObject);
  const locked = !!object.locked;
  const role = object.semanticKind || (object.kind === 'fossbot' ? 'robotSpawn' : undefined);

  const setRotationY = (degrees: number) => {
    const rotationY = rad(degrees);
    if (object.kind === 'cube') {
      const orientation = object.orientation ? [object.orientation[0], rotationY, object.orientation[2]] as Vec3 : undefined;
      onChange({ ...object, rotationY, orientation });
    } else if ('rotationY' in object) set({ rotationY } as Partial<EditorStageObject>);
  };

  return (
    <Stack spacing={0} sx={{ color: editorColors.text }}>
      <Section title="Entity" meta={`${displayObjectType(object)}${selectedCount > 1 ? ` · ${selectedCount} selected` : ''}${locked ? ' · Locked' : ''}`}>
        <FieldRow label="Name">
          <TextField {...commonFieldProps} value={object.name} disabled={locked} inputProps={{ 'aria-label': 'Object name' }} onChange={(event) => set({ name: event.target.value } as Partial<EditorStageObject>)} />
        </FieldRow>
        <FieldRow label="Type">
          <TextField {...commonFieldProps} value={displayObjectType(object)} disabled inputProps={{ 'aria-label': 'Object type' }} />
        </FieldRow>
        <FieldRow label="State">
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.25 }}>
            <FormControlLabel control={<EnabledSwitch checked={!object.hidden} onChange={(checked) => set({ hidden: !checked } as Partial<EditorStageObject>)} />} label="Enabled" />
            <FormControlLabel control={<EnabledSwitch checked={!!object.locked} onChange={(checked) => set({ locked: checked } as Partial<EditorStageObject>)} />} label="Locked" />
          </Stack>
        </FieldRow>
        <FieldRow label="Role">
          <TextField {...commonFieldProps} select value={role || ''} disabled={locked} inputProps={{ 'aria-label': 'Category or role' }} onChange={(event) => set({ semanticKind: event.target.value as StageSemanticKind } as Partial<EditorStageObject>)}>
            <MenuItem value="">Object</MenuItem>
            {STAGE_OBJECT_CATALOG.filter((item) => item.placeable).map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
          </TextField>
        </FieldRow>
      </Section>

      <Section title="Transform">
        {object.kind === 'base' && (
          <FieldRow label="Position">
            <InlineFields>
              <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={object.position[0]} onChange={(event) => set({ position: updateVec3(object.position, 0, event.target.value) } as Partial<EditorStageObject>)} />
              <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={object.position[2]} onChange={(event) => set({ position: updateVec3(object.position, 2, event.target.value) } as Partial<EditorStageObject>)} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind !== 'base' && 'position' in object && (
          <FieldRow label="Position">
            <InlineFields>
              <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={object.position[0]} onChange={(event) => set({ position: updateVec3(object.position, 0, event.target.value) } as Partial<EditorStageObject>)} />
              <StageBuilderNumberField axis="Y" {...commonNumberProps} disabled={locked} value={object.position[1]} onChange={(event) => set({ position: updateVec3(object.position, 1, event.target.value) } as Partial<EditorStageObject>)} />
              <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={object.position[2]} onChange={(event) => set({ position: updateVec3(object.position, 2, event.target.value) } as Partial<EditorStageObject>)} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'cube' && (
          <FieldRow label="Rotation">
            <InlineFields>
              <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={deg(object.orientation?.[0] || 0)} onChange={(event) => {
                const x = rad(num(event.target.value, deg(object.orientation?.[0] || 0)));
                onChange({ ...object, orientation: [x, object.orientation?.[1] || object.rotationY, object.orientation?.[2] || 0], rampAngle: object.semanticKind === 'ramp' ? x : object.rampAngle });
              }} />
              <StageBuilderNumberField axis="Y" {...commonNumberProps} disabled={locked} value={deg(object.rotationY)} onChange={(event) => setRotationY(num(event.target.value, deg(object.rotationY)))} />
              <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={deg(object.orientation?.[2] || 0)} onChange={(event) => onChange({ ...object, orientation: [object.orientation?.[0] || 0, object.orientation?.[1] || object.rotationY, rad(num(event.target.value, deg(object.orientation?.[2] || 0)))] })} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'fossbot' && (
          <FieldRow label="Rotation">
            <InlineFields>
              <StageBuilderNumberField axis="Y" {...commonNumberProps} disabled={locked} value={deg(object.rotationY)} onChange={(event) => setRotationY(num(event.target.value, deg(object.rotationY)))} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'light' && (object.subtype === 'directional' || object.subtype === 'spot') && (
          <FieldRow label="Rotation">
            <InlineFields>
              <StageBuilderNumberField axis="Y" {...commonNumberProps} disabled={locked} value={deg(object.rotationY)} onChange={(event) => set({ rotationY: rad(num(event.target.value, deg(object.rotationY))) } as Partial<EditorStageObject>)} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'base' && (
          <>
            <FieldRow label="Scale">
              <InlineFields>
                <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={object.dimensions[0]} onChange={(event) => onChange({ ...object, dimensions: [minPositive(event.target.value, object.dimensions[0]), object.dimensions[1]] })} />
                <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={object.dimensions[1]} onChange={(event) => onChange({ ...object, dimensions: [object.dimensions[0], minPositive(event.target.value, object.dimensions[1])] })} />
              </InlineFields>
            </FieldRow>
            {['target', 'checkpoint', 'dangerZone', 'sensorZone'].includes(object.semanticKind || '') && <FullRow><Alert severity="info">Challenge markers export as visible floor regions plus metadata-style naming for simulator logic.</Alert></FullRow>}
          </>
        )}

        {object.kind === 'cube' && (
          <FieldRow label="Scale">
            <InlineFields>
              <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={object.dimensions[0]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 0, minPositive(event.target.value, object.dimensions[0])) })} />
              <StageBuilderNumberField axis="Y" {...commonNumberProps} disabled={locked} value={object.dimensions[1]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 1, minPositive(event.target.value, object.dimensions[1])) })} />
              <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={object.dimensions[2]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 2, minPositive(event.target.value, object.dimensions[2])) })} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'cylinder' && (
          <>
            <FieldRow label="Scale">
              <InlineFields>
                <StageBuilderNumberField label="Top" {...commonNumberProps} disabled={locked} value={object.dimensions[0]} onChange={(event) => onChange({ ...object, dimensions: [Math.max(0, num(event.target.value, object.dimensions[0])), object.dimensions[1], object.dimensions[2], object.dimensions[3]] })} />
                <StageBuilderNumberField label="Height" {...commonNumberProps} disabled={locked} value={object.dimensions[2]} onChange={(event) => onChange({ ...object, dimensions: [object.dimensions[0], object.dimensions[1], minPositive(event.target.value, object.dimensions[2]), object.dimensions[3]] })} />
                <StageBuilderNumberField label="Bottom" {...commonNumberProps} disabled={locked} value={object.dimensions[1]} onChange={(event) => onChange({ ...object, dimensions: [object.dimensions[0], Math.max(0, num(event.target.value, object.dimensions[1])), object.dimensions[2], object.dimensions[3]] })} />
              </InlineFields>
            </FieldRow>
            <FieldRow label="Primitive">
              <TextField {...commonFieldProps} select disabled={locked} value={object.dimensions[0] === 0 ? 'cone' : 'cylinder'} inputProps={{ 'aria-label': 'Primitive' }} onChange={(event) => {
                if (event.target.value === 'cone') onChange({ ...object, semanticKind: 'obstacle', dimensions: [0, object.dimensions[1], object.dimensions[2], object.dimensions[3]] });
                else onChange({ ...object, semanticKind: 'cylinder', dimensions: [object.dimensions[1], object.dimensions[1], object.dimensions[2], object.dimensions[3]] });
              }}>
                <MenuItem value="cylinder">Cylinder</MenuItem>
                <MenuItem value="cone">Cone</MenuItem>
              </TextField>
            </FieldRow>
          </>
        )}

        {object.kind === 'line' && (
          <>
            <FieldRow label="Scale">
              <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={object.width} inputProps={{ step: 0.01, 'aria-label': 'Line width' }} onChange={(event) => onChange({ ...object, width: minPositive(event.target.value, object.width, 0.005) })} />
            </FieldRow>
            {object.points.map((point, index) => (
              <FieldRow key={index} label={`Point ${index + 1}`}>
                <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
                  <StageBuilderNumberField axis="X" {...commonNumberProps} disabled={locked} value={point[0]} onChange={(event) => {
                    const points = [...object.points]; points[index] = updateVec2(point, 0, event.target.value); onChange({ ...object, points });
                  }} />
                  <StageBuilderNumberField axis="Z" {...commonNumberProps} disabled={locked} value={point[1]} onChange={(event) => {
                    const points = [...object.points]; points[index] = updateVec2(point, 1, event.target.value); onChange({ ...object, points });
                  }} />
                  <Button size="small" disabled={locked || object.points.length <= 2} onClick={() => onChange({ ...object, points: object.points.filter((_, i) => i !== index) })}>Remove</Button>
                </Stack>
              </FieldRow>
            ))}
            <FullRow><Button size="small" disabled={locked} onClick={() => onChange({ ...object, points: [...object.points, [0, 0]] })}>Add point</Button></FullRow>
          </>
        )}

        {object.kind === 'text' && (
          <>
            <FieldRow label="Scale">
              <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={object.scale} inputProps={{ step: 0.05, 'aria-label': 'Text scale' }} onChange={(event) => {
                const nextScale = minPositive(event.target.value, object.scale, 0.05);
                const ratio = nextScale / Math.max(0.05, object.scale);
                const currentStyle = labelStyle(object);
                onChange({ ...object, scale: nextScale, style: { ...currentStyle, backgroundSize: [currentStyle.backgroundSize[0] * ratio, currentStyle.backgroundSize[1] * ratio] } });
              }} />
            </FieldRow>
            {!object.attachment?.parentId && (
              <FieldRow label="Placement">
                <FormControlLabel control={<Checkbox checked={object.onFloor} disabled={locked} onChange={(event) => onChange({ ...object, onFloor: event.target.checked, position: [object.position[0], event.target.checked ? 0.02 : Math.max(0.3, object.position[1]), object.position[2]] })} />} label="Place on floor" />
              </FieldRow>
            )}
          </>
        )}

      </Section>

      {supportsAppearance(object) && (
        <Section title="Appearance">
          {supportsColor(object) && (
            <FieldRow label="Color" align="start">
              <ColorPickerField
                value={object.color}
                disabled={locked}
                pickerAriaLabel="Color picker"
                valueAriaLabel="Object color value"
                onChange={(color) => set({ color } as Partial<EditorStageObject>)}
              />
            </FieldRow>
          )}
          {object.kind === 'text' && (
            <>
              <FieldRow label="Text">
                <TextField {...commonFieldProps} disabled={locked} value={object.text} inputProps={{ 'aria-label': 'Label text' }} onChange={(event) => onChange({ ...object, text: event.target.value })} />
              </FieldRow>
              <FieldRow label="Font size">
                <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={labelStyle(object).fontSize} inputProps={{ step: 1, min: 8, 'aria-label': 'Label font size' }} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), fontSize: Math.max(8, num(event.target.value, labelStyle(object).fontSize)) } })} />
              </FieldRow>
              <FieldRow label="Background">
                <FormControlLabel control={<Checkbox checked={labelStyle(object).backgroundVisible} disabled={locked} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), backgroundVisible: event.target.checked } })} />} label="Enabled" />
              </FieldRow>
              {labelStyle(object).backgroundVisible && (
                <>
                  <FieldRow label="Background size">
                    <InlineFields>
                      <StageBuilderNumberField label="W" {...commonNumberProps} disabled={locked} value={labelStyle(object).backgroundSize[0]} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), backgroundSize: [minPositive(event.target.value, labelStyle(object).backgroundSize[0], 0.05), labelStyle(object).backgroundSize[1]] } })} />
                      <StageBuilderNumberField label="H" {...commonNumberProps} disabled={locked} value={labelStyle(object).backgroundSize[1]} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), backgroundSize: [labelStyle(object).backgroundSize[0], minPositive(event.target.value, labelStyle(object).backgroundSize[1], 0.03)] } })} />
                    </InlineFields>
                  </FieldRow>
                  <FieldRow label="Background color" align="start">
                    <ColorPickerField value={labelStyle(object).backgroundColor} disabled={locked} pickerAriaLabel="Label background color picker" valueAriaLabel="Label background color value" onChange={(color) => onChange({ ...object, style: { ...labelStyle(object), backgroundColor: color } })} />
                  </FieldRow>
                  <FieldRow label="Background opacity">
                    <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={labelStyle(object).backgroundOpacity} inputProps={{ step: 0.05, min: 0, max: 1, 'aria-label': 'Label background opacity' }} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), backgroundOpacity: clamp01(event.target.value, labelStyle(object).backgroundOpacity) } })} />
                  </FieldRow>
                </>
              )}
              <FieldRow label="Border">
                <FormControlLabel control={<Checkbox checked={labelStyle(object).borderVisible} disabled={locked} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), borderVisible: event.target.checked } })} />} label="Enabled" />
              </FieldRow>
              {labelStyle(object).borderVisible && (
                <>
                  <FieldRow label="Border color" align="start">
                    <ColorPickerField value={labelStyle(object).borderColor} disabled={locked} pickerAriaLabel="Label border color picker" valueAriaLabel="Label border color value" onChange={(color) => onChange({ ...object, style: { ...labelStyle(object), borderColor: color } })} />
                  </FieldRow>
                  <FieldRow label="Border size">
                    <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={labelStyle(object).borderWidth} inputProps={{ step: 1, min: 0, 'aria-label': 'Label border width' }} onChange={(event) => onChange({ ...object, style: { ...labelStyle(object), borderWidth: Math.max(0, num(event.target.value, labelStyle(object).borderWidth)) } })} />
                  </FieldRow>
                </>
              )}
            </>
          )}
        </Section>
      )}

      {object.kind === 'text' && (
        <Section title="Attachment" meta={object.attachment?.parentId ? 'Local space' : 'Free'}>
          <FieldRow label="Parent">
            <TextField
              {...commonFieldProps}
              select
              disabled={locked}
              value={object.attachment?.parentId || ''}
              inputProps={{ 'aria-label': 'Attached label parent' }}
              onChange={(event) => {
                const parentId = event.target.value;
                const parent = objects.find((item) => item.id === parentId);
                onChange({
                  ...object,
                  parentId: parentId || undefined,
                  onFloor: parentId ? false : object.onFloor,
                  attachment: parentId && parent ? {
                    parentId,
                    face: object.attachment?.face || defaultLabelFace(parent),
                    offset: object.attachment?.offset || [0, 0],
                    rotation: object.attachment?.rotation || 0,
                    billboard: false,
                  } : undefined,
                });
              }}
            >
              <MenuItem value="">None — free label</MenuItem>
              {objects.filter((item) => item.id !== object.id && isLabelAttachTarget(item)).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </TextField>
          </FieldRow>
          {object.attachment?.parentId ? (
            <>
              <FieldRow label="Face">
                <TextField {...commonFieldProps} select disabled={locked} value={object.attachment.face} inputProps={{ 'aria-label': 'Attached label face' }} onChange={(event) => onChange({ ...object, attachment: { ...object.attachment!, face: event.target.value as StageLabelFace } })}>
                  <MenuItem value="front">Front</MenuItem>
                  <MenuItem value="back">Back</MenuItem>
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                  <MenuItem value="top">Top</MenuItem>
                  <MenuItem value="bottom">Bottom</MenuItem>
                </TextField>
              </FieldRow>
              <FieldRow label="Offset">
                <InlineFields>
                  <StageBuilderNumberField label="U" {...commonNumberProps} disabled={locked} value={object.attachment.offset[0]} onChange={(event) => onChange({ ...object, attachment: { ...object.attachment!, offset: [num(event.target.value, object.attachment!.offset[0]), object.attachment!.offset[1]] } })} />
                  <StageBuilderNumberField label="V" {...commonNumberProps} disabled={locked} value={object.attachment.offset[1]} onChange={(event) => onChange({ ...object, attachment: { ...object.attachment!, offset: [object.attachment!.offset[0], num(event.target.value, object.attachment!.offset[1])] } })} />
                </InlineFields>
              </FieldRow>
              <FieldRow label="Rotation">
                <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={deg(object.attachment.rotation)} inputProps={{ step: 1, 'aria-label': 'Attached label rotation' }} onChange={(event) => onChange({ ...object, attachment: { ...object.attachment!, rotation: rad(num(event.target.value, deg(object.attachment!.rotation))) } })} />
              </FieldRow>
              <FullRow><Alert severity="info">Attached labels are fixed in the parent object's local space. They do not follow the editor camera.</Alert></FullRow>
            </>
          ) : (
            <FullRow><Typography variant="caption" sx={editorType.caption}>Choose a parent object to pin this label to a face or surface.</Typography></FullRow>
          )}
        </Section>
      )}

      {object.kind === 'light' && (
        <Section title="Light">
          <FieldRow label="Type">
            <TextField
              {...commonFieldProps}
              select
              disabled={locked}
              value={object.subtype}
              inputProps={{ 'aria-label': 'Light type' }}
              onChange={(event) => set({ subtype: event.target.value as StageLightSubtype } as Partial<EditorStageObject>)}
            >
              <MenuItem value="point">Point</MenuItem>
              <MenuItem value="spot">Spot</MenuItem>
              <MenuItem value="directional">Directional</MenuItem>
              <MenuItem value="ambient">Ambient</MenuItem>
            </TextField>
          </FieldRow>
          <FieldRow label="Intensity">
            <StageBuilderNumberField
              {...commonNumberProps}
              disabled={locked}
              value={object.intensity}
              inputProps={{ step: 0.1, min: 0, 'aria-label': 'Light intensity' }}
              onChange={(event) => set({ intensity: Math.max(0, num(event.target.value, object.intensity)) } as Partial<EditorStageObject>)}
            />
          </FieldRow>
          {(object.subtype === 'point' || object.subtype === 'spot') && (
            <FieldRow label="Range">
              <StageBuilderNumberField
                {...commonNumberProps}
                disabled={locked}
                value={object.range}
                inputProps={{ step: 0.1, min: 0, 'aria-label': 'Light range' }}
                onChange={(event) => set({ range: Math.max(0, num(event.target.value, object.range)) } as Partial<EditorStageObject>)}
              />
            </FieldRow>
          )}
          {object.subtype === 'spot' && (
            <>
              <FieldRow label="Cone angle">
                <StageBuilderNumberField
                  {...commonNumberProps}
                  disabled={locked}
                  value={deg(object.angle)}
                  inputProps={{ step: 1, min: 0, max: 90, 'aria-label': 'Spot cone angle' }}
                  onChange={(event) => set({ angle: Math.min(Math.PI / 2, Math.max(0, rad(num(event.target.value, deg(object.angle))))) } as Partial<EditorStageObject>)}
                />
              </FieldRow>
              <FieldRow label="Penumbra">
                <StageBuilderNumberField
                  {...commonNumberProps}
                  disabled={locked}
                  value={object.penumbra}
                  inputProps={{ step: 0.05, min: 0, max: 1, 'aria-label': 'Spot penumbra' }}
                  onChange={(event) => set({ penumbra: Math.min(1, Math.max(0, num(event.target.value, object.penumbra))) } as Partial<EditorStageObject>)}
                />
              </FieldRow>
            </>
          )}
          {object.subtype === 'ambient' && (
            <FullRow><Alert severity="info">Ambient light brightens the whole stage evenly. Position and rotation do not affect it.</Alert></FullRow>
          )}
        </Section>
      )}

      {object.kind === 'camera' && (
        <Section title="Camera">
          <FieldRow label="Yaw">
            <StageBuilderNumberField
              {...commonNumberProps}
              disabled={locked}
              value={deg(object.rotationY)}
              inputProps={{ step: 1, 'aria-label': 'Camera yaw' }}
              onChange={(event) => set({ rotationY: rad(num(event.target.value, deg(object.rotationY))) } as Partial<EditorStageObject>)}
            />
          </FieldRow>
          <FieldRow label="Pitch" align="start">
            <Stack spacing={0.5}>
              <StageBuilderNumberField
                {...commonNumberProps}
                disabled={locked}
                value={deg(object.pitch)}
                inputProps={{ step: 1, min: -89, max: 89, 'aria-label': 'Camera pitch' }}
                onChange={(event) => set({ pitch: Math.min(Math.PI / 2 - 0.01, Math.max(-(Math.PI / 2 - 0.01), rad(num(event.target.value, deg(object.pitch))))) } as Partial<EditorStageObject>)}
              />
              <Typography variant="caption" sx={editorType.caption}>Positive values tilt down.</Typography>
            </Stack>
          </FieldRow>
          <FieldRow label="FOV °">
            <StageBuilderNumberField
              {...commonNumberProps}
              disabled={locked}
              value={object.fov}
              inputProps={{ step: 1, min: 10, max: 120, 'aria-label': 'Camera field of view' }}
              onChange={(event) => set({ fov: Math.min(120, Math.max(10, num(event.target.value, object.fov))) } as Partial<EditorStageObject>)}
            />
          </FieldRow>
          <FullRow>
            <Stack spacing={0.5}>
              <Button fullWidth size="small" variant="outlined" disabled={!!object.hidden} onClick={() => onLookThroughCamera?.(object as EditorCameraObject)}>Preview from camera</Button>
              <Typography variant="caption" sx={editorType.caption}>Preview locks editor orbit controls until you exit.</Typography>
            </Stack>
          </FullRow>
        </Section>
      )}

      {object.kind === 'audio' && (
        <Section title="Audio">
          <FieldRow label="Source type">
            <TextField
              {...commonFieldProps}
              select
              disabled={locked}
              value={object.sourceType}
              inputProps={{ 'aria-label': 'Audio source type' }}
              onChange={(event) => set({ sourceType: event.target.value as StageAudioSourceType } as Partial<EditorStageObject>)}
            >
              <MenuItem value="url">URL</MenuItem>
              <MenuItem value="file">File reference</MenuItem>
            </TextField>
          </FieldRow>
          <FieldRow label="Source">
            <TextField
              {...commonFieldProps}
              disabled={locked}
              value={object.source}
              placeholder={object.sourceType === 'url' ? 'https://example.com/sound.mp3' : 'sounds/start.mp3'}
              inputProps={{ 'aria-label': 'Audio source' }}
              onChange={(event) => set({ source: event.target.value } as Partial<EditorStageObject>)}
            />
          </FieldRow>
          <FieldRow label="Volume">
            <StageBuilderNumberField
              {...commonNumberProps}
              disabled={locked}
              value={object.volume}
              inputProps={{ step: 0.05, min: 0, max: 1, 'aria-label': 'Audio volume' }}
              onChange={(event) => set({ volume: Math.min(1, Math.max(0, num(event.target.value, object.volume))) } as Partial<EditorStageObject>)}
            />
          </FieldRow>
          <FieldRow label="Playback">
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.25 }}>
              <FormControlLabel control={<EnabledSwitch checked={object.autoplay} disabled={locked} onChange={(checked) => set({ autoplay: checked } as Partial<EditorStageObject>)} />} label="Start on run" />
              <FormControlLabel control={<EnabledSwitch checked={object.loop} disabled={locked} onChange={(checked) => set({ loop: checked } as Partial<EditorStageObject>)} />} label="Loop" />
            </Stack>
          </FieldRow>
          <FieldRow label="Spatial">
            <FormControlLabel control={<EnabledSwitch checked={object.spatial} disabled={locked} onChange={(checked) => set({ spatial: checked } as Partial<EditorStageObject>)} />} label="Positional audio" />
          </FieldRow>
          {object.spatial && (
            <FieldRow label="Range">
              <StageBuilderNumberField
                {...commonNumberProps}
                disabled={locked}
                value={object.range}
                inputProps={{ step: 0.1, min: 0.1, 'aria-label': 'Audio range' }}
                onChange={(event) => set({ range: Math.max(0.1, num(event.target.value, object.range)) } as Partial<EditorStageObject>)}
              />
            </FieldRow>
          )}
          <FullRow>
            <Stack spacing={0.5}>
              <Button fullWidth size="small" variant="outlined" disabled={!object.source.trim()} onClick={() => testAudioPreview(object.source, object.sourceType, object.volume)}>Test audio</Button>
              <Typography variant="caption" sx={editorType.caption}>Plays this source once in the editor at the configured volume.</Typography>
              {audioPreviewError && <Alert severity="warning" sx={{ py: 0 }}>{audioPreviewError}</Alert>}
            </Stack>
          </FullRow>
        </Section>
      )}

      {(object.kind === 'cube' || object.kind === 'cylinder') && (
        <Section title="Collision">
          <FieldRow label="Enabled"><EnabledSwitch checked disabled /></FieldRow>
          <FieldRow label="Type">
            <TextField {...commonFieldProps} value={object.kind === 'cube' ? 'Box' : object.dimensions[0] === 0 ? 'Cone approximation' : 'Cylinder'} disabled inputProps={{ 'aria-label': 'Collider type' }} />
          </FieldRow>
        </Section>
      )}

      {(object.kind === 'cube' || object.kind === 'cylinder') && (
        <Section title="Rigidbody">
          <FieldRow label="Type">
            <TextField {...commonFieldProps} select disabled={locked} value={object.immovable ? 'fixed' : 'dynamic'} inputProps={{ 'aria-label': 'Rigidbody type' }} onChange={(event) => {
              const dynamic = event.target.value === 'dynamic';
              set({ immovable: !dynamic, mass: dynamic ? Math.max(0.1, object.mass || 0.4) : 0 } as Partial<EditorStageObject>);
            }}>
              <MenuItem value="fixed">Fixed</MenuItem>
              <MenuItem value="dynamic">Dynamic</MenuItem>
            </TextField>
          </FieldRow>
          <FieldRow label="Mass">
            <StageBuilderNumberField {...commonNumberProps} disabled={locked || object.immovable} value={object.mass} inputProps={{ step: 0.1, 'aria-label': 'Mass' }} onChange={(event) => set({ mass: Math.max(0, num(event.target.value, object.mass)) } as Partial<EditorStageObject>)} />
          </FieldRow>
        </Section>
      )}

      <Section title="Advanced" expanded={advancedOpen} onChange={onAdvancedOpenChange} defaultExpanded={false}>
        <FieldRow label="Object ID"><TextField {...commonFieldProps} value={object.id} disabled inputProps={{ 'aria-label': 'Object ID' }} /></FieldRow>
        <FieldRow label="Internal type"><TextField {...commonFieldProps} value={object.kind} disabled inputProps={{ 'aria-label': 'Internal type' }} /></FieldRow>
        <FieldRow label="Group ID"><TextField {...commonFieldProps} value={object.groupId || 'None'} disabled inputProps={{ 'aria-label': 'Group ID' }} /></FieldRow>
        <FieldRow label="Prefab source"><TextField {...commonFieldProps} value={object.prefabSourceId || 'None'} disabled inputProps={{ 'aria-label': 'Prefab source' }} /></FieldRow>
        <FieldRow label="Raw metadata" align="start">
          <TextField {...commonFieldProps} multiline minRows={4} value={JSON.stringify(object, null, 2)} disabled inputProps={{ 'aria-label': 'Raw metadata preview' }} />
        </FieldRow>
      </Section>
    </Stack>
  );
}
