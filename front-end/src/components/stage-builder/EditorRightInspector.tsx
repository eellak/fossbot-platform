import React from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { EditorStage, EditorStageObject } from './types';
import { ColorPickerField, StageInspector } from './StageInspector';
import { StageValidationPanel } from './StageValidationPanel';
import { StageBuilderNumberField } from './StageBuilderNumberField';
import type { StageBuilderValidationResult } from './stageBuilderValidation';
import type { StageBuilderPreferences } from './stageBuilderPreferences';
import { defaultStageBuilderPreferences, type StageBuilderRotationSnapPreset, type StageBuilderSnapPreset } from './stageBuilderPreferences';
import { rotationSnapPresetLabel, snapPresetLabel } from './stageBuilderSnapping';
import { editorColors, editorType, inspectorPanelSx } from './stageBuilderEditorTheme';

export type InspectorTab = 'object' | 'stage' | 'validation' | 'settings';

export interface EditorRightInspectorProps {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  stage: EditorStage;
  selectedObject: EditorStageObject | null;
  selectedCount: number;
  validationResults: StageBuilderValidationResult[];
  prefs: StageBuilderPreferences;
  onStageChange: (stage: EditorStage) => void;
  onObjectChange: (object: EditorStageObject) => void;
  onToggleValidationOverride: (id: string, enabled: boolean) => void;
  onPrefsChange: (patch: Partial<StageBuilderPreferences>) => void;
  onResetPrefs: () => void;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapOptions() {
  return [
    { value: 'off', label: snapPresetLabel('off') },
    { value: 'fine', label: snapPresetLabel('fine') },
    { value: 'medium', label: snapPresetLabel('medium') },
    { value: 'coarse', label: snapPresetLabel('coarse') },
  ];
}

function rotationOptions() {
  return [
    { value: 'off', label: rotationSnapPresetLabel('off') },
    { value: '15', label: rotationSnapPresetLabel('15') },
    { value: '30', label: rotationSnapPresetLabel('30') },
    { value: '45', label: rotationSnapPresetLabel('45') },
  ];
}

const commonNumberProps = { type: 'number', size: 'small' as const, fullWidth: true };
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

function Section({ title, children, defaultExpanded = true }: { title: string; children: React.ReactNode; defaultExpanded?: boolean }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters square>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ width: 18, height: 18, color: editorColors.textMuted }} />}>
        <Typography variant="caption" noWrap sx={{ ...editorType.sectionLabel, color: editorColors.textStrong }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ py: 0.5 }}>{children}</Box>
      </AccordionDetails>
    </Accordion>
  );
}

function ContextHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ px: 1.25, py: 0.875, borderBottom: `1px solid ${editorColors.border}`, bgcolor: editorColors.panel }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" sx={{ ...editorType.panelTitle, lineHeight: 1.2 }}>{title}</Typography>
          <Typography variant="caption" sx={editorType.caption}>{description}</Typography>
        </Box>
        {action}
      </Stack>
    </Box>
  );
}

function StageContext({ stage, prefs, onStageChange, onPrefsChange }: Pick<EditorRightInspectorProps, 'stage' | 'prefs' | 'onStageChange' | 'onPrefsChange'>) {
  const gridVisible = stage.metadata.gridVisible ?? true;
  const gridSize = stage.metadata.gridSize ?? 0.5;
  const defaultSnapPreset = stage.metadata.defaultSnapPreset || (prefs.snapPreset === 'free' || prefs.snapPreset === 'grid' ? 'medium' : prefs.snapPreset) as StageBuilderSnapPreset;
  const defaultRotationSnapPreset = stage.metadata.defaultRotationSnapPreset || prefs.rotationSnapPreset;

  const patchMetadata = (patch: Partial<EditorStage['metadata']>) => onStageChange({ ...stage, metadata: { ...stage.metadata, ...patch } });

  return (
    <Stack spacing={0} sx={{ color: editorColors.text }}>
      <ContextHeader title="Stage" description="Whole-stage settings. Select an object to inspect object options." />

      <Section title="Stage">
        <FieldRow label="Name">
          <TextField {...commonFieldProps} value={stage.title} inputProps={{ 'aria-label': 'Stage name' }} onChange={(event) => onStageChange({ ...stage, title: event.target.value })} />
        </FieldRow>
        <FieldRow label="Description" align="start">
          <TextField {...commonFieldProps} multiline minRows={3} value={stage.description} inputProps={{ 'aria-label': 'Stage description' }} onChange={(event) => onStageChange({ ...stage, description: event.target.value })} />
        </FieldRow>
      </Section>

      <Section title="Floor">
        <FieldRow label="Size">
          <InlineFields>
            <StageBuilderNumberField label="Width" {...commonNumberProps} inputProps={{ step: 0.1, min: 0.5 }} value={stage.floor.dimensions[0]} onChange={(event) => onStageChange({ ...stage, floor: { ...stage.floor, dimensions: [Math.max(0.5, num(event.target.value, stage.floor.dimensions[0])), stage.floor.dimensions[1]] } })} />
            <StageBuilderNumberField label="Depth" {...commonNumberProps} inputProps={{ step: 0.1, min: 0.5 }} value={stage.floor.dimensions[1]} onChange={(event) => onStageChange({ ...stage, floor: { ...stage.floor, dimensions: [stage.floor.dimensions[0], Math.max(0.5, num(event.target.value, stage.floor.dimensions[1]))] } })} />
          </InlineFields>
        </FieldRow>
        <FieldRow label="Color" align="start">
          <ColorPickerField
            value={stage.floor.color}
            pickerAriaLabel="Floor color picker"
            valueAriaLabel="Floor color value"
            onChange={(color) => onStageChange({ ...stage, floor: { ...stage.floor, color } })}
          />
        </FieldRow>
      </Section>

      <Section title="Grid and Defaults">
        <FieldRow label="Grid"><FormControlLabel control={<Switch size="small" checked={gridVisible} onChange={(event) => patchMetadata({ gridVisible: event.target.checked })} />} label="Visible" /></FieldRow>
        <FieldRow label="Grid size">
          <StageBuilderNumberField {...commonNumberProps} inputProps={{ step: 0.1, min: 0.1, 'aria-label': 'Grid size' }} value={gridSize} onChange={(event) => patchMetadata({ gridSize: Math.max(0.1, num(event.target.value, gridSize)) })} />
        </FieldRow>
        <FieldRow label="Move snap">
          <TextField {...commonFieldProps} select value={defaultSnapPreset} inputProps={{ 'aria-label': 'Default snap size' }} onChange={(event) => {
            const snapPreset = event.target.value as StageBuilderSnapPreset;
            patchMetadata({ defaultSnapPreset: snapPreset as EditorStage['metadata']['defaultSnapPreset'] });
            onPrefsChange({ snapPreset });
          }}>
            {snapOptions().map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </FieldRow>
        <FieldRow label="Rotate snap">
          <TextField {...commonFieldProps} select value={defaultRotationSnapPreset} inputProps={{ 'aria-label': 'Default rotation snap' }} onChange={(event) => {
            const rotationSnapPreset = event.target.value as StageBuilderRotationSnapPreset;
            patchMetadata({ defaultRotationSnapPreset: rotationSnapPreset });
            onPrefsChange({ rotationSnapPreset });
          }}>
            {rotationOptions().map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </FieldRow>
      </Section>


      <Section title="Metadata" defaultExpanded={false}>
        <FieldRow label="Version"><TextField {...commonFieldProps} value={stage.metadata.version} disabled inputProps={{ 'aria-label': 'Editor metadata version' }} /></FieldRow>
        <FieldRow label="Groups"><TextField {...commonFieldProps} value={stage.metadata.groups.length} disabled inputProps={{ 'aria-label': 'Groups' }} /></FieldRow>
      </Section>
    </Stack>
  );
}

function SettingsContext({ prefs, onPrefsChange, onResetPrefs }: Pick<EditorRightInspectorProps, 'prefs' | 'onPrefsChange' | 'onResetPrefs'>) {
  return (
    <Stack spacing={0} sx={{ color: editorColors.text }}>
      <ContextHeader title="Editor Settings" description="Workspace preferences stored locally for this editor." />

      <Section title="Workspace">
        <FieldRow label="Style">
          <TextField {...commonFieldProps} select value={prefs.styleVariant} inputProps={{ 'aria-label': 'Editor style' }} onChange={(event) => onPrefsChange({ styleVariant: event.target.value as StageBuilderPreferences['styleVariant'] })}>
            <MenuItem value="playful">Playful</MenuItem>
            <MenuItem value="studio">Technical</MenuItem>
          </TextField>
        </FieldRow>
        <FieldRow label="Selection">
          <TextField {...commonFieldProps} select value={prefs.lockMode} inputProps={{ 'aria-label': 'Selection behavior' }} onChange={(event) => onPrefsChange({ lockMode: event.target.value as StageBuilderPreferences['lockMode'] })}>
            <MenuItem value="ignore">Ignore other objects</MenuItem>
            <MenuItem value="selectThrough">Select through</MenuItem>
            <MenuItem value="stopAtFirstHit">Stop at first hit</MenuItem>
          </TextField>
        </FieldRow>
        <FieldRow label="Transform">
          <TextField {...commonFieldProps} select value={prefs.transformSpace} inputProps={{ 'aria-label': 'Transform orientation' }} onChange={(event) => onPrefsChange({ transformSpace: event.target.value as StageBuilderPreferences['transformSpace'] })}>
            <MenuItem value="world">World</MenuItem>
            <MenuItem value="local">Local</MenuItem>
          </TextField>
        </FieldRow>
      </Section>

      <Section title="Snapping">
        <FieldRow label="Move snap">
          <TextField {...commonFieldProps} select value={prefs.snapPreset === 'free' || prefs.snapPreset === 'grid' ? 'medium' : prefs.snapPreset} inputProps={{ 'aria-label': 'Snapping' }} onChange={(event) => onPrefsChange({ snapPreset: event.target.value as StageBuilderSnapPreset })}>
            {snapOptions().map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </FieldRow>
        <FieldRow label="Rotate snap">
          <TextField {...commonFieldProps} select value={prefs.rotationSnapPreset} inputProps={{ 'aria-label': 'Rotation snap' }} onChange={(event) => onPrefsChange({ rotationSnapPreset: event.target.value as StageBuilderRotationSnapPreset })}>
            {rotationOptions().map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
        </FieldRow>
      </Section>

      <Section title="Input">
        <FieldRow label="Keyboard"><FormControlLabel control={<Switch size="small" checked={prefs.keyboardShortcutsEnabled} onChange={(event) => onPrefsChange({ keyboardShortcutsEnabled: event.target.checked })} />} label="Shortcuts" /></FieldRow>
        <FieldRow label="Viewport"><FormControlLabel control={<Switch size="small" checked={prefs.captureKeyboardInViewport} onChange={(event) => onPrefsChange({ captureKeyboardInViewport: event.target.checked })} />} label="Capture keys" /></FieldRow>
        <FieldRow label="Inspector"><FormControlLabel control={<Switch size="small" checked={prefs.showAdvancedInspector} onChange={(event) => onPrefsChange({ showAdvancedInspector: event.target.checked })} />} label="Advanced section" /></FieldRow>
        <FullRow>
          <Button size="small" variant="outlined" onClick={() => { onPrefsChange(defaultStageBuilderPreferences); onResetPrefs(); }}>Reset editor settings</Button>
        </FullRow>
      </Section>
    </Stack>
  );
}

function ValidationContext({ results, onToggleOverride, onBack }: { results: StageBuilderValidationResult[]; onToggleOverride: (id: string, enabled: boolean) => void; onBack: () => void }) {
  return (
    <Stack spacing={0} sx={{ color: editorColors.text }}>
      <ContextHeader
        title="Validation"
        description="Blocking issues and warnings before export or Run Test."
        action={<Button size="small" variant="outlined" onClick={onBack}>Stage</Button>}
      />
      <Box sx={{ p: 1.25 }}>
        <StageValidationPanel results={results} onToggleOverride={onToggleOverride} />
      </Box>
    </Stack>
  );
}

export function EditorRightInspector({
  tab,
  onTabChange,
  stage,
  selectedObject,
  selectedCount,
  validationResults,
  prefs,
  onStageChange,
  onObjectChange,
  onToggleValidationOverride,
  onPrefsChange,
  onResetPrefs,
}: EditorRightInspectorProps) {
  const context = tab === 'validation' ? 'validation' : tab === 'settings' ? 'settings' : selectedObject ? 'object' : 'stage';

  return (
    <Box sx={inspectorPanelSx}>
      <Box sx={{ flex: 1, overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {context === 'object' && (
          <StageInspector
            object={selectedObject}
            selectedCount={selectedCount}
            advancedOpen={prefs.showAdvancedInspector}
            onAdvancedOpenChange={(showAdvancedInspector) => onPrefsChange({ showAdvancedInspector })}
            onChange={onObjectChange}
          />
        )}
        {context === 'stage' && <StageContext stage={stage} prefs={prefs} onStageChange={onStageChange} onPrefsChange={onPrefsChange} />}
        {context === 'settings' && <SettingsContext prefs={prefs} onPrefsChange={onPrefsChange} onResetPrefs={onResetPrefs} />}
        {context === 'validation' && <ValidationContext results={validationResults} onToggleOverride={onToggleValidationOverride} onBack={() => onTabChange('stage')} />}
      </Box>
    </Box>
  );
}
