import type { SxProps, Theme } from '@mui/material/styles';

export const editorColors = {
  topbar: '#0b1224',
  viewport: '#050816',
  panel: '#1b252b',
  panelRaised: '#223039',
  panelInset: '#151d22',
  panelDisabled: '#131b21',
  border: '#2a3842',
  borderStrong: '#435560',
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
  lighting: { accent: '#ffd27f', surface: '#3d351d', text: '#ffe9c2' },
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
  '& .MuiInputBase-root': { color: editorColors.textStrong, bgcolor: '#172027', minHeight: 26, borderRadius: 0.5 },
  '& .MuiInputBase-root.Mui-disabled': { bgcolor: editorColors.panelDisabled, opacity: 1 },
  '& .MuiInputBase-input': { color: editorColors.textStrong, fontSize: '0.8125rem', padding: '4px 6px' },
  '& input[type="number"]::-webkit-inner-spin-button, & input[type="number"]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
  '& input[type="number"]': { MozAppearance: 'textfield' },
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
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#33424c' },
  '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#2a363f' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5f6b' },
  '& .MuiOutlinedInput-root.Mui-focused': { bgcolor: '#18242c' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5aa9ec', borderWidth: '1px' },
  '& .MuiDivider-root': { borderColor: editorColors.border },
  '& .MuiAccordion-root': { bgcolor: editorColors.panel, color: editorColors.text, boxShadow: 'none', borderTop: `2px solid ${editorColors.border}`, borderRadius: '0 !important', margin: '0 !important' },
  '& .MuiAccordion-root:before': { display: 'none' },
  '& .MuiAccordionSummary-root': { minHeight: 34, px: 1.25, bgcolor: 'transparent', borderBottom: '2px solid rgba(42, 56, 66, 0.45)' },
  '& .MuiAccordionSummary-root:hover': { bgcolor: 'rgba(74, 163, 255, 0.05)' },
  '& .MuiAccordionSummary-root.Mui-expanded': { minHeight: 34 },
  '& .MuiAccordionSummary-content': { my: 0.625, minWidth: 0 },
  '& .MuiAccordionSummary-content.Mui-expanded': { my: 0.625 },
  '& .MuiAccordionSummary-expandIconWrapper': { color: editorColors.textMuted },
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { color: editorColors.accentText },
  '& .MuiAccordionDetails-root': { px: 0, py: 0 },
  '& .MuiFormControlLabel-root': { m: 0, mr: 1 },
  '& .MuiButton-root': { textTransform: 'none', borderRadius: 0.75 },
  '& .MuiButton-outlined': { borderColor: '#3a4a55', color: editorColors.accentText },
  '& .MuiButton-outlined:hover': { borderColor: '#4d6680', bgcolor: 'rgba(74, 163, 255, 0.08)' },
  '& .MuiAlert-root': {
    border: '1px solid',
    borderRadius: 0.75,
    '& .MuiAlert-icon': {
      opacity: 0.9,
    },
    '& .MuiTypography-root': {
      fontWeight: 600,
    },
    '&.MuiAlert-severityInfo': {
      borderColor: 'rgba(74, 163, 255, 0.25)',
      bgcolor: 'rgba(74, 163, 255, 0.06)',
      color: `${editorColors.accentText} !important`,
      '& .MuiTypography-root': { color: `${editorColors.accentText} !important` },
      '& .MuiSvgIcon-root': { color: `${editorColors.accentText} !important` },
    },
    '&.MuiAlert-severityWarning': {
      borderColor: 'rgba(243, 184, 77, 0.25)',
      bgcolor: 'rgba(243, 184, 77, 0.06)',
      color: `${editorColors.warning} !important`,
      '& .MuiTypography-root': { color: `${editorColors.warning} !important` },
      '& .MuiSvgIcon-root': { color: `${editorColors.warning} !important` },
    },
    '&.MuiAlert-severityError': {
      borderColor: 'rgba(242, 139, 116, 0.25)',
      bgcolor: 'rgba(242, 139, 116, 0.06)',
      color: `${editorColors.danger} !important`,
      '& .MuiTypography-root': { color: `${editorColors.danger} !important` },
      '& .MuiSvgIcon-root': { color: `${editorColors.danger} !important` },
    },
    '&.MuiAlert-severitySuccess': {
      borderColor: 'rgba(91, 220, 139, 0.25)',
      bgcolor: 'rgba(91, 220, 139, 0.06)',
      color: `${editorColors.success} !important`,
      '& .MuiTypography-root': { color: `${editorColors.success} !important` },
      '& .MuiSvgIcon-root': { color: `${editorColors.success} !important` },
    },
  },
};
