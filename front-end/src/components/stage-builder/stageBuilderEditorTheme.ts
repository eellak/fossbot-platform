import type { SxProps, Theme } from '@mui/material/styles';
import { createContext, useContext } from 'react';

export type EditorVariant = 'studio' | 'fossbot';

export type EditorColors = {
  topbar: string;
  viewport: string;
  panel: string;
  panelRaised: string;
  panelInset: string;
  panelDisabled: string;
  glass: string;
  glassDeep: string;
  border: string;
  borderStrong: string;
  borderSoft: string;
  divider: string;
  keycapBorder: string;
  keycapBorderStrong: string;
  keycapBg: string;
  keycapInk: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textSubtle: string;
  textDisabled: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successInk: string;
  warning: string;
  warningInk: string;
  danger: string;
  dangerInk: string;
  dangerSurface: string;
  label: string;
  prefab: string;
  robot: string;
  friendlyHandleRotate: string;
  friendlyHandleResize: string;
  friendlyHandleValid: string;
  friendlyHandleInvalid: string;
  friendlyMarquee: string;
  friendlyMarqueeFill: string;
  selectionHelper: string;
  sensorUltrasonic: string;
  sensorIrProximity: string;
  sensorIrFloor: string;
  sensorLdr: string;
  sensorOther: string;
};

export type EditorTone = {
  accent: string;
  surface: string;
  text: string;
};

export type EditorTones = {
  floorPaths: EditorTone;
  structures: EditorTone;
  robot: EditorTone;
  challenge: EditorTone;
  labels: EditorTone;
  lighting: EditorTone;
  camera: EditorTone;
  audio: EditorTone;
  prefab: EditorTone;
};

export type EditorTypeStyles = {
  panelTitle: { fontSize: string; fontWeight: number; lineHeight: number; color: string };
  caption: { fontSize: string; lineHeight: number; color: string };
  body: { fontSize: string; lineHeight: number; color: string };
  sectionLabel: {
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
    textTransform: 'uppercase';
    color: string;
  };
};

// ── Studio palette (preserved verbatim) ─────────────────────────────────────

const STUDIO_COLORS: EditorColors = {
  topbar: '#0b1224',
  viewport: '#050816',
  panel: '#1b252b',
  panelRaised: '#223039',
  panelInset: '#151d22',
  panelDisabled: '#131b21',
  glass: 'rgba(11, 18, 36, 0.76)',
  glassDeep: 'rgba(18, 31, 40, 0.82)',
  border: '#2a3842',
  borderStrong: '#435560',
  borderSoft: 'rgba(148, 163, 184, 0.15)',
  divider: 'rgba(148, 163, 184, 0.2)',
  keycapBorder: 'rgba(156, 175, 184, 0.28)',
  keycapBorderStrong: 'rgba(156, 175, 184, 0.42)',
  keycapBg: 'rgba(216, 225, 232, 0.06)',
  keycapInk: '#e2e8f0',
  text: '#d8e1e8',
  textStrong: '#e6edf3',
  textMuted: '#9cafb8',
  textSubtle: '#7f929b',
  textDisabled: '#8fa3ad',
  accent: '#4aa3ff',
  accentSoft: '#173854',
  accentText: '#7cc7ff',
  success: '#5bdc8b',
  successInk: '#082114',
  warning: '#f3b84d',
  warningInk: '#3a2a08',
  danger: '#f28b74',
  dangerInk: '#3a1612',
  dangerSurface: 'rgba(242, 139, 116, 0.1)',
  label: '#c7a6ff',
  prefab: '#f0a7d7',
  robot: '#79c7ff',
  friendlyHandleRotate: '#ffb020',
  friendlyHandleResize: '#22c55e',
  friendlyHandleValid: '#22c55e',
  friendlyHandleInvalid: '#ef4444',
  friendlyMarquee: '#38bdf8',
  friendlyMarqueeFill: 'rgba(56, 189, 248, 0.14)',
  selectionHelper: '#e2e8f0',
  sensorUltrasonic: '#38bdf8',
  sensorIrProximity: '#f59e0b',
  sensorIrFloor: '#22c55e',
  sensorLdr: '#fde047',
  sensorOther: '#f472b6',
};

const STUDIO_TONES: EditorTones = {
  floorPaths: { accent: '#8fd3ff', surface: '#17364a', text: '#d7f1ff' },
  structures: { accent: '#f3b84d', surface: '#3d311d', text: '#ffe3a3' },
  robot: { accent: '#79c7ff', surface: '#12364c', text: '#ccecff' },
  challenge: { accent: '#5bdc8b', surface: '#153b2c', text: '#c8f7d8' },
  labels: { accent: '#c7a6ff', surface: '#302848', text: '#eadfff' },
  lighting: { accent: '#ffd27f', surface: '#3d351d', text: '#ffe9c2' },
  camera: { accent: '#5eead4', surface: '#15372e', text: '#ccfbef' },
  audio: { accent: '#f472b6', surface: '#3a2437', text: '#ffd7ed' },
  prefab: { accent: '#f0a7d7', surface: '#3b2b3c', text: '#ffd8ef' },
};

// ── FossBot palette (light, periwinkle brand) ────────────────────────────
// The "FossBot" identity is anchored in the dashboard's actual brand render:
//   - Brand periwinkle:  #6A84FA  oklch(67% 0.155 270) — the FOSSBot wordmark,
//                                                    Dashboard selected item,
//                                                    primary CTAs across the platform
//   - "Bot" half orange: #EF7F1A  oklch(71% 0.169 54.7) — wordmark only
//   - Accent teal (FAB):  #13DEB9  oklch(81% 0.121 175) — the floating action btn
//   - Off-white:         #FFFFFF  (panels), #F3F4F6 (viewport)
// Surfaces are very subtly tinted toward the brand-blue hue (270°) for
// cohesion without coloring the chrome. The wordmark orange is committed
// to ~10% of chrome (warning, structures, lighting) for emphasis.

const FOSSBOT_COLORS: EditorColors = {
  topbar: '#FFFFFF', // pure white, matches the rest of the platform
  viewport: '#F3F4F6', // oklch(96% 0.003 270) — very light grey for 3D scene
  panel: '#FFFFFF', // pure white panels
  panelRaised: '#FAFBFC', // near-white raised
  panelInset: '#F3F4F6', // light grey inset
  panelDisabled: '#F9FAFB', // very light disabled
  glass: 'rgba(255, 255, 255, 0.86)',
  glassDeep: 'rgba(255, 255, 255, 0.94)',
  border: '#E5E7EB', // oklch(91% 0.005 270) — light hairline
  borderStrong: '#D1D5DB', // oklch(85% 0.01 270) — stronger hairline
  borderSoft: 'rgba(106, 132, 250, 0.18)',
  divider: 'rgba(106, 132, 250, 0.22)',
  keycapBorder: '#D1D5DB',
  keycapBorderStrong: '#9CA3AF',
  keycapBg: 'rgba(106, 132, 250, 0.08)',
  keycapInk: '#1F2937',
  text: '#1F2937', // oklch(28% 0.02 270) — near-black for body
  textStrong: '#0F172A', // oklch(20% 0.025 270) — strong text
  textMuted: '#6B7280', // oklch(54% 0.015 270) — muted
  textSubtle: '#9CA3AF', // oklch(70% 0.01 270) — subtle
  textDisabled: '#D1D5DB',
  accent: '#6A84FA', // oklch(67% 0.155 270) — periwinkle brand
  accentSoft: '#E8ECFE', // very light periwinkle surface
  accentText: '#3D52CC', // oklch(48% 0.18 270) — darker periwinkle for text contrast
  success: '#13DEB9', // platform FAB teal-mint
  successInk: '#042F2A',
  warning: '#E08019', // oklch(60% 0.16 55) — amber darkened for light-bg contrast
  warningInk: '#3A1B05',
  danger: '#E55E3F', // oklch(56% 0.16 30) — coral darkened for light-bg contrast
  dangerInk: '#3A0F08',
  dangerSurface: 'rgba(229, 94, 63, 0.08)',
  label: '#A39BFF', // lavender for category accent
  prefab: '#F0A787', // warm orange — distinct from the bold "Bot" orange
  robot: '#6A84FA', // the robot body is periwinkle (brand identity)
  friendlyHandleRotate: '#E08019',
  friendlyHandleResize: '#13DEB9',
  friendlyHandleValid: '#13DEB9',
  friendlyHandleInvalid: '#E55E3F',
  friendlyMarquee: '#6A84FA',
  friendlyMarqueeFill: 'rgba(106, 132, 250, 0.18)',
  selectionHelper: '#3D52CC',
  sensorUltrasonic: '#49BEFF', // sky cyan (platform secondary)
  sensorIrProximity: '#E08019',
  sensorIrFloor: '#13DEB9',
  sensorLdr: '#FCD34D',
  sensorOther: '#E55E3F',
};

const FOSSBOT_TONES: EditorTones = {
  floorPaths: { accent: '#49BEFF', surface: '#E8F7FF', text: '#0E4F66' }, // sky cyan
  structures: { accent: '#E08019', surface: '#FEF3E0', text: '#5A2E05' }, // amber
  robot: { accent: '#6A84FA', surface: '#E8ECFE', text: '#2A358E' }, // periwinkle
  challenge: { accent: '#13DEB9', surface: '#E6FFFA', text: '#0A4F40' }, // mint
  labels: { accent: '#A39BFF', surface: '#EFEBFE', text: '#3D2E80' }, // lavender
  lighting: { accent: '#E08019', surface: '#FEF3E0', text: '#5A2E05' }, // amber
  camera: { accent: '#49BEFF', surface: '#E8F7FF', text: '#0E4F66' }, // cyan
  audio: { accent: '#E55E3F', surface: '#FDEDE8', text: '#5A1A0E' }, // coral
  prefab: { accent: '#F0A787', surface: '#FDEEE3', text: '#5A2A12' }, // warm orange
};

// ── Public API ──────────────────────────────────────────────────────────────

export function getEditorColors(variant: EditorVariant): EditorColors {
  return variant === 'fossbot' ? FOSSBOT_COLORS : STUDIO_COLORS;
}

export function getEditorTones(variant: EditorVariant): EditorTones {
  return variant === 'fossbot' ? FOSSBOT_TONES : STUDIO_TONES;
}

export function getEditorType(variant: EditorVariant): EditorTypeStyles {
  const colors = getEditorColors(variant);
  return {
    panelTitle: {
      fontSize: '0.875rem',
      fontWeight: 700,
      lineHeight: 1.25,
      color: colors.textStrong,
    },
    caption: {
      fontSize: '0.6875rem',
      lineHeight: 1.25,
      color: colors.textMuted,
    },
    body: {
      fontSize: '0.8125rem',
      lineHeight: 1.25,
      color: colors.text,
    },
    sectionLabel: {
      fontSize: '0.6875rem',
      fontWeight: 800,
      letterSpacing: '0.08em',
      lineHeight: 1.2,
      textTransform: 'uppercase',
      color: variant === 'fossbot' ? '#6B7280' : '#b8c8d0',
    },
  };
}

export function getEditorTabsSx(variant: EditorVariant): SxProps<Theme> {
  const colors = getEditorColors(variant);
  return {
    minHeight: 36,
    bgcolor: colors.panelInset,
    '& .MuiTab-root': {
      minHeight: 36,
      py: 0,
      color: colors.textMuted,
      fontSize: '0.8125rem',
      textTransform: 'none',
    },
    '& .Mui-selected': {
      color: `${colors.textStrong} !important`,
      bgcolor: colors.panel,
    },
  };
}

export function getEditorPanelSx(variant: EditorVariant): SxProps<Theme> {
  const colors = getEditorColors(variant);
  return {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    bgcolor: colors.panel,
    color: colors.text,
  };
}

export function getInspectorPanelSx(variant: EditorVariant): SxProps<Theme> {
  const colors = getEditorColors(variant);
  const inputBg = colors.panelInset;
  const inputBgFocused = colors.panel;
  const switchCheckedTrack = colors.accent;
  const outlineBorder = colors.border;
  const outlineBorderDisabled = colors.border;
  const outlineBorderHover = colors.borderStrong;
  const outlineBorderFocused = colors.accentText;
  const buttonOutlinedBorder = colors.border;
  const buttonOutlinedBorderHover = colors.borderStrong;
  const accordionHover = `${colors.accent}10`;
  const buttonOutlinedHover = `${colors.accent}18`;
  return {
    ...getEditorPanelSx(variant),
    borderLeft: `1px solid ${colors.border}`,
    '& .MuiTypography-root': { color: 'inherit' },
    '& .MuiTypography-colorTextSecondary': { color: colors.textMuted },
    '& .MuiFormControlLabel-label': { color: colors.text, fontSize: '0.8125rem' },
    '& .MuiFormControlLabel-root.Mui-disabled .MuiFormControlLabel-label': { color: `${colors.textDisabled} !important` },
    '& .MuiFormControlLabel-label.Mui-disabled': { color: `${colors.textDisabled} !important` },
    '& .MuiTypography-root.Mui-disabled': { color: `${colors.textDisabled} !important` },
    '& .MuiInputBase-root': { color: colors.textStrong, bgcolor: inputBg, minHeight: 26, borderRadius: 0.5 },
    '& .MuiInputBase-root.Mui-disabled': { bgcolor: colors.panelDisabled, opacity: 1 },
    '& .MuiInputBase-input': { color: colors.textStrong, fontSize: '0.8125rem', padding: '4px 6px' },
    '& input[type="number"]::-webkit-inner-spin-button, & input[type="number"]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type="number"]': { MozAppearance: 'textfield' },
    '& .MuiInputBase-input.Mui-disabled': {
      WebkitTextFillColor: `${colors.textDisabled} !important`,
      color: `${colors.textDisabled} !important`,
      opacity: 1,
    },
    '& .MuiInputLabel-root': { color: colors.textMuted },
    '& .MuiInputLabel-root.Mui-disabled': { color: `${colors.textSubtle} !important` },
    '& .MuiInputLabel-root.Mui-focused': { color: colors.accentText },
    '& .MuiSelect-icon': { color: colors.textMuted },
    '& .MuiFormHelperText-root': { color: colors.textSubtle, marginLeft: 0 },
    '& .MuiFormHelperText-root.Mui-disabled': { color: `${colors.textSubtle} !important` },
    '& .MuiSvgIcon-root': { color: 'inherit' },
    '& .MuiSwitch-switchBase': { color: colors.textMuted },
    '& .MuiSwitch-switchBase.Mui-checked': { color: colors.accentText },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: switchCheckedTrack },
    '& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track': { backgroundColor: colors.border, opacity: 0.8 },
    '& .MuiCheckbox-root': { color: colors.textMuted, padding: 0.5 },
    '& .MuiCheckbox-root.Mui-checked': { color: colors.accentText },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: outlineBorder },
    '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: outlineBorderDisabled },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: outlineBorderHover },
    '& .MuiOutlinedInput-root.Mui-focused': { bgcolor: inputBgFocused },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: outlineBorderFocused, borderWidth: '1px' },
    '& .MuiDivider-root': { borderColor: colors.border },
    '& .MuiAccordion-root': { bgcolor: colors.panel, color: colors.text, boxShadow: 'none', borderTop: `1px solid ${colors.border}`, borderRadius: '0 !important', margin: '0 !important' },
    '& .MuiAccordion-root:before': { display: 'none' },
    '& .MuiAccordionSummary-root': { minHeight: 34, px: 1.25, bgcolor: 'transparent', borderBottom: `1px solid ${colors.divider}` },
    '& .MuiAccordionSummary-root:hover': { bgcolor: accordionHover },
    '& .MuiAccordionSummary-root.Mui-expanded': { minHeight: 34 },
    '& .MuiAccordionSummary-content': { my: 0.625, minWidth: 0 },
    '& .MuiAccordionSummary-content.Mui-expanded': { my: 0.625 },
    '& .MuiAccordionSummary-expandIconWrapper': { color: colors.textMuted },
    '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { color: colors.accentText },
    '& .MuiAccordionDetails-root': { px: 0, py: 0 },
    '& .MuiFormControlLabel-root': { m: 0, mr: 1 },
    '& .MuiButton-root': { textTransform: 'none', borderRadius: 0.75 },
    '& .MuiButton-outlined': { borderColor: buttonOutlinedBorder, color: colors.accentText },
    '& .MuiButton-outlined:hover': { borderColor: buttonOutlinedBorderHover, bgcolor: buttonOutlinedHover },
    '& .MuiAlert-root': {
      border: '1px solid',
      borderRadius: 0.75,
      '& .MuiAlert-icon': { opacity: 0.9 },
      '& .MuiTypography-root': { fontWeight: 600 },
      '&.MuiAlert-severityInfo': {
        borderColor: `${colors.accent}4d`,
        bgcolor: `${colors.accent}14`,
        color: `${colors.accentText} !important`,
        '& .MuiTypography-root': { color: `${colors.accentText} !important` },
        '& .MuiSvgIcon-root': { color: `${colors.accentText} !important` },
      },
      '&.MuiAlert-severityWarning': {
        borderColor: `${colors.warning}4d`,
        bgcolor: `${colors.warning}14`,
        color: `${colors.warning} !important`,
        '& .MuiTypography-root': { color: `${colors.warning} !important` },
        '& .MuiSvgIcon-root': { color: `${colors.warning} !important` },
      },
      '&.MuiAlert-severityError': {
        borderColor: `${colors.danger}4d`,
        bgcolor: `${colors.dangerSurface}`,
        color: `${colors.danger} !important`,
        '& .MuiTypography-root': { color: `${colors.danger} !important` },
        '& .MuiSvgIcon-root': { color: `${colors.danger} !important` },
      },
      '&.MuiAlert-severitySuccess': {
        borderColor: `${colors.success}4d`,
        bgcolor: `${colors.success}14`,
        color: `${colors.success} !important`,
        '& .MuiTypography-root': { color: `${colors.success} !important` },
        '& .MuiSvgIcon-root': { color: `${colors.success} !important` },
      },
    },
  };
}

// ── Backward-compatible static exports (resolve to Studio) ──────────────────
// New code should use getEditorColors(variant) / getEditorTones(variant) or the
// EditorThemeContext hook. These remain so legacy imports still compile and so
// the theme is debuggable from the browser console.

export const editorColors: EditorColors = STUDIO_COLORS;
export const editorTones: EditorTones = STUDIO_TONES;
export const editorType: EditorTypeStyles = getEditorType('studio');
export const editorTabsSx: SxProps<Theme> = getEditorTabsSx('studio');
export const editorPanelSx: SxProps<Theme> = getEditorPanelSx('studio');
export const inspectorPanelSx: SxProps<Theme> = getInspectorPanelSx('studio');

// ── React context (use inside the editor / test pages) ──────────────────────

export type EditorThemeContextValue = {
  variant: EditorVariant;
  colors: EditorColors;
  tones: EditorTones;
  type: EditorTypeStyles;
  panelSx: SxProps<Theme>;
  tabsSx: SxProps<Theme>;
  inspectorSx: SxProps<Theme>;
};

const EditorThemeContext = createContext<EditorThemeContextValue>({
  variant: 'studio',
  colors: STUDIO_COLORS,
  tones: STUDIO_TONES,
  type: getEditorType('studio'),
  panelSx: getEditorPanelSx('studio'),
  tabsSx: getEditorTabsSx('studio'),
  inspectorSx: getInspectorPanelSx('studio'),
});

export const EditorThemeProvider = EditorThemeContext.Provider;

export function useEditorTheme(): EditorThemeContextValue {
  return useContext(EditorThemeContext);
}
