import type { SxProps, Theme } from '@mui/material/styles';

export const editorColors = {
  topbar: '#0f172a',
  viewport: '#0b1120',
  panel: '#202a30',
  panelRaised: '#263239',
  panelInset: '#1a2227',
  panelDisabled: '#172026',
  border: '#344149',
  borderStrong: '#4a5b64',
  text: '#d8e1e8',
  textStrong: '#e6edf3',
  textMuted: '#9cafb8',
  textSubtle: '#7f929b',
  textDisabled: '#8fa3ad',
  accent: '#4aa3ff',
  accentSoft: '#173854',
  accentText: '#7cc7ff',
  success: '#5bdc8b',
  warning: '#f3b84d',
  danger: '#f28b74',
  label: '#c7a6ff',
  prefab: '#f0a7d7',
} as const;

export const editorType = {
  panelTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: editorColors.textStrong,
  },
  caption: {
    fontSize: '0.6875rem',
    lineHeight: 1.25,
    color: editorColors.textMuted,
  },
  body: {
    fontSize: '0.8125rem',
    lineHeight: 1.25,
    color: editorColors.text,
  },
  sectionLabel: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    lineHeight: 1.2,
    textTransform: 'uppercase',
    color: '#b8c8d0',
  },
} as const;

export type EditorTone = {
  accent: string;
  surface: string;
  text: string;
};

export const editorTones = {
  floorPaths: { accent: '#8fd3ff', surface: '#17364a', text: '#d7f1ff' },
  structures: { accent: editorColors.warning, surface: '#3d311d', text: '#ffe3a3' },
  robot: { accent: '#79c7ff', surface: '#12364c', text: '#ccecff' },
  challenge: { accent: editorColors.success, surface: '#153b2c', text: '#c8f7d8' },
  labels: { accent: editorColors.label, surface: '#302848', text: '#eadfff' },
  prefab: { accent: editorColors.prefab, surface: '#3b2b3c', text: '#ffd8ef' },
} as const;

export const editorTabsSx: SxProps<Theme> = {
  minHeight: 36,
  bgcolor: editorColors.panelInset,
  '& .MuiTab-root': {
    minHeight: 36,
    py: 0,
    color: editorColors.textMuted,
    fontSize: '0.8125rem',
    textTransform: 'none',
  },
  '& .Mui-selected': {
    color: '#e6f4ff !important',
    bgcolor: editorColors.panel,
  },
};

export const editorPanelSx: SxProps<Theme> = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: editorColors.panel,
  color: editorColors.text,
};

export const inspectorPanelSx: SxProps<Theme> = {
  ...editorPanelSx,
  borderLeft: `1px solid ${editorColors.border}`,
  '& .MuiTypography-root': { color: 'inherit' },
  '& .MuiTypography-colorTextSecondary': { color: editorColors.textMuted },
  '& .MuiFormControlLabel-label': { color: editorColors.text, fontSize: '0.8125rem' },
  '& .MuiFormControlLabel-root.Mui-disabled .MuiFormControlLabel-label': { color: `${editorColors.textDisabled} !important` },
  '& .MuiFormControlLabel-label.Mui-disabled': { color: `${editorColors.textDisabled} !important` },
  '& .MuiTypography-root.Mui-disabled': { color: `${editorColors.textDisabled} !important` },
  '& .MuiInputBase-root': { color: editorColors.textStrong, bgcolor: editorColors.panelInset, minHeight: 32, borderRadius: 0.5 },
  '& .MuiInputBase-root.Mui-disabled': { bgcolor: editorColors.panelDisabled, opacity: 1 },
  '& .MuiInputBase-input': { color: editorColors.textStrong, fontSize: '0.8125rem', paddingTop: '7px', paddingBottom: '7px' },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: `${editorColors.textDisabled} !important`,
    color: `${editorColors.textDisabled} !important`,
    opacity: 1,
  },
  '& .MuiInputLabel-root': { color: editorColors.textMuted },
  '& .MuiInputLabel-root.Mui-disabled': { color: `${editorColors.textSubtle} !important` },
  '& .MuiInputLabel-root.Mui-focused': { color: editorColors.accentText },
  '& .MuiSelect-icon': { color: editorColors.textMuted },
  '& .MuiFormHelperText-root': { color: editorColors.textSubtle, marginLeft: 0 },
  '& .MuiFormHelperText-root.Mui-disabled': { color: `${editorColors.textSubtle} !important` },
  '& .MuiSvgIcon-root': { color: 'inherit' },
  '& .MuiSwitch-switchBase': { color: editorColors.textMuted },
  '& .MuiSwitch-switchBase.Mui-checked': { color: editorColors.accentText },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#2f89c8' },
  '& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track': { backgroundColor: '#334149', opacity: 0.8 },
  '& .MuiCheckbox-root': { color: editorColors.textMuted, padding: 0.5 },
  '& .MuiCheckbox-root.Mui-checked': { color: editorColors.accentText },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: editorColors.borderStrong },
  '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#2f3b43' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6d828d' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: editorColors.accent },
  '& .MuiDivider-root': { borderColor: editorColors.border },
  '& .MuiAccordion-root': { bgcolor: editorColors.panel, color: editorColors.text, boxShadow: 'none', borderTop: `1px solid ${editorColors.border}`, borderRadius: '0 !important', margin: '0 !important' },
  '& .MuiAccordion-root:before': { display: 'none' },
  '& .MuiAccordionSummary-root': { minHeight: 36, px: 1.25, bgcolor: editorColors.panelInset },
  '& .MuiAccordionSummary-root:hover': { bgcolor: editorColors.panelRaised },
  '& .MuiAccordionSummary-root.Mui-expanded': { minHeight: 36 },
  '& .MuiAccordionSummary-content': { my: 0.75, minWidth: 0 },
  '& .MuiAccordionSummary-content.Mui-expanded': { my: 0.75 },
  '& .MuiAccordionSummary-expandIconWrapper': { color: editorColors.textMuted },
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { color: editorColors.accentText },
  '& .MuiAccordionDetails-root': { px: 0, py: 0 },
  '& .MuiFormControlLabel-root': { m: 0, mr: 1 },
  '& .MuiButton-root': { textTransform: 'none' },
};
