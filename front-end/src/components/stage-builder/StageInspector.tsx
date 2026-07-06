import React from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, FormControlLabel,
  MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Sketch, Swatch } from '@uiw/react-color';
import type { EditorStageObject, StageSemanticKind, Vec2, Vec3 } from './types';
import { displayObjectType, semanticKindLabel, STAGE_OBJECT_CATALOG } from './stageBuilderCatalog';
import { editorColors, editorType } from './stageBuilderEditorTheme';
import { StageBuilderNumberField } from './StageBuilderNumberField';

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function minPositive(value: unknown, fallback: number, minimum = 0.01): number {
  return Math.max(minimum, num(value, fallback));
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
  // Kept for deprecated drawer callers; deletion now lives outside the inspector body.
  onDelete?: (id: string) => void;
}

const commonNumberProps = { type: 'number', size: 'small' as const, fullWidth: true, inputProps: { step: 0.1 } };
const commonFieldProps = { size: 'small' as const, fullWidth: true };

function FieldRow({ label, children, align = 'center' }: { label: string; children: React.ReactNode; align?: 'center' | 'start' }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 0.75, alignItems: align, px: 1.25, py: 0.5 }}>
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

export function StageInspector({ object, selectedCount = object ? 1 : 0, advancedOpen = false, onAdvancedOpenChange, onChange }: StageInspectorProps) {
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
            <FormControlLabel control={<EnabledSwitch checked={!object.hidden} onChange={(checked) => set({ hidden: !checked } as Partial<EditorStageObject>)} />} label="Visible" />
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
        {'position' in object && (
          <FieldRow label="Position">
            <InlineFields>
              <StageBuilderNumberField label="X" {...commonNumberProps} disabled={locked} value={object.position[0]} onChange={(event) => set({ position: updateVec3(object.position, 0, event.target.value) } as Partial<EditorStageObject>)} />
              <StageBuilderNumberField label="Y" {...commonNumberProps} disabled={locked} value={object.position[1]} onChange={(event) => set({ position: updateVec3(object.position, 1, event.target.value) } as Partial<EditorStageObject>)} />
              <StageBuilderNumberField label="Z" {...commonNumberProps} disabled={locked} value={object.position[2]} onChange={(event) => set({ position: updateVec3(object.position, 2, event.target.value) } as Partial<EditorStageObject>)} />
            </InlineFields>
          </FieldRow>
        )}

        {(object.kind === 'cube' || object.kind === 'fossbot') && (
          <FieldRow label="Rotation">
            <InlineFields>
              <StageBuilderNumberField label="X" {...commonNumberProps} disabled={locked || object.kind !== 'cube'} value={object.kind === 'cube' ? deg(object.orientation?.[0] || 0) : 0} onChange={(event) => {
                if (object.kind !== 'cube') return;
                const x = rad(num(event.target.value, deg(object.orientation?.[0] || 0)));
                onChange({ ...object, orientation: [x, object.orientation?.[1] || object.rotationY, object.orientation?.[2] || 0], rampAngle: object.semanticKind === 'ramp' ? x : object.rampAngle });
              }} />
              <StageBuilderNumberField label="Y" {...commonNumberProps} disabled={locked} value={deg(object.rotationY)} onChange={(event) => setRotationY(num(event.target.value, deg(object.rotationY)))} />
              <StageBuilderNumberField label="Z" {...commonNumberProps} disabled={locked || object.kind !== 'cube'} value={object.kind === 'cube' ? deg(object.orientation?.[2] || 0) : 0} onChange={(event) => object.kind === 'cube' && onChange({ ...object, orientation: [object.orientation?.[0] || 0, object.orientation?.[1] || object.rotationY, rad(num(event.target.value, deg(object.orientation?.[2] || 0)))] })} />
            </InlineFields>
          </FieldRow>
        )}

        {object.kind === 'base' && (
          <>
            <FieldRow label="Scale">
              <InlineFields>
                <StageBuilderNumberField label="X" {...commonNumberProps} disabled={locked} value={object.dimensions[0]} onChange={(event) => onChange({ ...object, dimensions: [minPositive(event.target.value, object.dimensions[0]), object.dimensions[1]] })} />
                <StageBuilderNumberField label="Y" {...commonNumberProps} value={1} disabled />
                <StageBuilderNumberField label="Z" {...commonNumberProps} disabled={locked} value={object.dimensions[1]} onChange={(event) => onChange({ ...object, dimensions: [object.dimensions[0], minPositive(event.target.value, object.dimensions[1])] })} />
              </InlineFields>
            </FieldRow>
            {['target', 'checkpoint', 'dangerZone', 'sensorZone'].includes(object.semanticKind || '') && <FullRow><Alert severity="info">Challenge markers export as visible floor regions plus metadata-style naming for simulator logic.</Alert></FullRow>}
          </>
        )}

        {object.kind === 'cube' && (
          <FieldRow label="Scale">
            <InlineFields>
              <StageBuilderNumberField label="X" {...commonNumberProps} disabled={locked} value={object.dimensions[0]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 0, minPositive(event.target.value, object.dimensions[0])) })} />
              <StageBuilderNumberField label="Y" {...commonNumberProps} disabled={locked} value={object.dimensions[1]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 1, minPositive(event.target.value, object.dimensions[1])) })} />
              <StageBuilderNumberField label="Z" {...commonNumberProps} disabled={locked} value={object.dimensions[2]} onChange={(event) => onChange({ ...object, dimensions: updateVec3(object.dimensions, 2, minPositive(event.target.value, object.dimensions[2])) })} />
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
                  <StageBuilderNumberField label="X" {...commonNumberProps} disabled={locked} value={point[0]} onChange={(event) => {
                    const points = [...object.points]; points[index] = updateVec2(point, 0, event.target.value); onChange({ ...object, points });
                  }} />
                  <StageBuilderNumberField label="Z" {...commonNumberProps} disabled={locked} value={point[1]} onChange={(event) => {
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
              <StageBuilderNumberField {...commonNumberProps} disabled={locked} value={object.scale} inputProps={{ step: 0.05, 'aria-label': 'Text scale' }} onChange={(event) => onChange({ ...object, scale: minPositive(event.target.value, object.scale, 0.05) })} />
            </FieldRow>
            <FieldRow label="Placement">
              <FormControlLabel control={<Checkbox checked={object.onFloor} disabled={locked} onChange={(event) => onChange({ ...object, onFloor: event.target.checked, position: [object.position[0], event.target.checked ? 0.02 : Math.max(0.3, object.position[1]), object.position[2]] })} />} label="Place on floor" />
            </FieldRow>
          </>
        )}

        {object.kind === 'fossbot' && (
          <>
            <FieldRow label="Scale">
              <InlineFields>
                <StageBuilderNumberField label="X" {...commonNumberProps} value={1} disabled />
                <StageBuilderNumberField label="Y" {...commonNumberProps} value={1} disabled />
                <StageBuilderNumberField label="Z" {...commonNumberProps} value={1} disabled />
              </InlineFields>
            </FieldRow>
            <FullRow><Alert severity="info">The robot spawn uses the FOSSBot simulator model. Adjust its position and rotation in Transform.</Alert></FullRow>
          </>
        )}
      </Section>

      <Section title="Appearance">
        {'color' in object && (
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
          <FieldRow label="Text">
            <TextField {...commonFieldProps} disabled={locked} value={object.text} inputProps={{ 'aria-label': 'Label text' }} onChange={(event) => onChange({ ...object, text: event.target.value })} />
          </FieldRow>
        )}
        <FieldRow label="Opacity">
          <TextField {...commonFieldProps} value="Default" disabled inputProps={{ 'aria-label': 'Opacity' }} />
        </FieldRow>
      </Section>

      <Section title="Collision">
        {object.kind === 'cube' || object.kind === 'cylinder' ? (
          <>
            <FieldRow label="Enabled"><EnabledSwitch checked disabled /></FieldRow>
            <FieldRow label="Type">
              <TextField {...commonFieldProps} value={object.kind === 'cube' ? 'Box' : object.dimensions[0] === 0 ? 'Cone approximation' : 'Cylinder'} disabled inputProps={{ 'aria-label': 'Collider type' }} />
            </FieldRow>
            <FieldRow label="Offset">
              <InlineFields>
                <StageBuilderNumberField label="X" {...commonNumberProps} value={0} disabled />
                <StageBuilderNumberField label="Y" {...commonNumberProps} value={0} disabled />
                <StageBuilderNumberField label="Z" {...commonNumberProps} value={0} disabled />
              </InlineFields>
            </FieldRow>
            <FieldRow label="Trigger"><EnabledSwitch checked={false} disabled /></FieldRow>
            <FieldRow label="Helper"><EnabledSwitch checked={false} disabled /></FieldRow>
          </>
        ) : ['target', 'checkpoint', 'dangerZone', 'sensorZone'].includes(object.semanticKind || '') ? (
          <FullRow><Alert severity="info">This marker behaves like a sensor/trigger region for future simulator logic. It has no solid collider.</Alert></FullRow>
        ) : (
          <FullRow><Alert severity="info">This object has no editable solid collider.</Alert></FullRow>
        )}
      </Section>

      <Section title="Rigidbody">
        {object.kind === 'cube' || object.kind === 'cylinder' ? (
          <>
            <FieldRow label="Type">
              <TextField {...commonFieldProps} select disabled={locked} value={object.immovable ? 'fixed' : 'dynamic'} inputProps={{ 'aria-label': 'Rigidbody type' }} onChange={(event) => {
                const dynamic = event.target.value === 'dynamic';
                set({ immovable: !dynamic, mass: dynamic ? Math.max(0.1, object.mass || 0.4) : 0 } as Partial<EditorStageObject>);
              }}>
                <MenuItem value="fixed">Fixed</MenuItem>
                <MenuItem value="dynamic">Dynamic</MenuItem>
                <MenuItem value="kinematic" disabled>Kinematic (reserved)</MenuItem>
              </TextField>
            </FieldRow>
            <FieldRow label="Mass">
              <StageBuilderNumberField {...commonNumberProps} disabled={locked || object.immovable} value={object.mass} inputProps={{ step: 0.1, 'aria-label': 'Mass' }} onChange={(event) => set({ mass: Math.max(0, num(event.target.value, object.mass)) } as Partial<EditorStageObject>)} />
            </FieldRow>
            <FieldRow label="Friction"><TextField {...commonFieldProps} value="Default" disabled inputProps={{ 'aria-label': 'Friction' }} /></FieldRow>
            <FieldRow label="Restitution"><TextField {...commonFieldProps} value="Default" disabled inputProps={{ 'aria-label': 'Restitution' }} /></FieldRow>
            <FieldRow label="Linear damping"><TextField {...commonFieldProps} value={object.immovable ? 'N/A' : '0.2'} disabled inputProps={{ 'aria-label': 'Linear damping' }} /></FieldRow>
            <FieldRow label="Angular damping"><TextField {...commonFieldProps} value={object.immovable ? 'N/A' : '0.2'} disabled inputProps={{ 'aria-label': 'Angular damping' }} /></FieldRow>
            <FieldRow label="Locked movement"><TextField {...commonFieldProps} value="None" disabled inputProps={{ 'aria-label': 'Locked translation axes' }} /></FieldRow>
            <FieldRow label="Locked rotation"><TextField {...commonFieldProps} value="None" disabled inputProps={{ 'aria-label': 'Locked rotation axes' }} /></FieldRow>
          </>
        ) : (
          <FullRow><Alert severity="info">No rigidbody settings are exposed for this object type.</Alert></FullRow>
        )}
      </Section>

      <Section title="Behavior">
        <FieldRow label="Role"><TextField {...commonFieldProps} value={semanticKindLabel(role)} disabled inputProps={{ 'aria-label': 'Behavior role' }} /></FieldRow>
        <FullRow><Typography variant="caption" sx={editorType.caption}>Behavior metadata is reserved for simulator logic.</Typography></FullRow>
      </Section>

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
