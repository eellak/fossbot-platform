export const authoringAccordionSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px !important',
  boxShadow: 'none',
  overflow: 'hidden',
  '&:before': { display: 'none' },
} as const;

export const authoringControlButtonSx = {
  minHeight: 44,
  whiteSpace: 'nowrap',
} as const;

export const authoringControlFieldSx = {
  '& .MuiInputBase-root': { minHeight: 44 },
} as const;

export const authoringIconButtonSx = {
  width: 44,
  height: 44,
  flex: '0 0 auto',
} as const;

export const authoringTitleSx = {
  fontWeight: 600,
  lineHeight: 1.35,
} as const;

export const authoringSummarySx = {
  mt: 0.25,
  overflowWrap: 'anywhere',
} as const;

// A single quiet boundary marks the exact editor element Buddy may change. The 8px radius
// matches the theme surface language so every target reads as the same highlight.
export const authoringTargetOutlineSx = {
  outline: '2px solid',
  outlineColor: 'primary.main',
  outlineOffset: 2,
  borderRadius: 1,
} as const;
