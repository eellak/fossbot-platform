import React, { useEffect, useRef, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export type ExpandableDescriptionProps = {
  /** Description text. */
  text?: string | null;
  /** Lines shown while collapsed. Defaults to two. */
  lines?: number;
  /** Upper bound for the collapsed text block. */
  maxWidth?: number | string;
  /** Opens the inline editor. Short descriptions call this on a single click. */
  onEdit?: () => void;
  /** Accessible label while the text is clamped. */
  expandLabel?: string;
  /** Accessible label while the text is expanded. */
  collapseLabel?: string;
  sx?: SxProps<Theme>;
};

/**
 * Description block that keeps long text in check: it clamps to `lines` rows,
 * reveals the full text in a tooltip on hover, and expands in place on click.
 * Descriptions that already fit keep the old click-to-edit behavior.
 */
export function ExpandableDescription({
  text,
  lines = 2,
  maxWidth = 480,
  onEdit,
  expandLabel,
  collapseLabel,
  sx,
}: ExpandableDescriptionProps) {
  const value = text || '';
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // A new description starts collapsed again.
  useEffect(() => {
    setExpanded(false);
  }, [value]);

  // Track whether the collapsed text actually overflows its line clamp. The
  // observer keeps the answer correct when panes or the window resize.
  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return undefined;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, value]);

  const interactive = clamped || expanded;
  const toggle = () => {
    setTooltipOpen(false);
    setExpanded((current) => !current);
  };
  const handleClick = () => {
    if (interactive) {
      toggle();
      return;
    }
    onEdit?.();
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLParagraphElement>) => {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggle();
  };

  return (
    <Tooltip
      title={(
        <Box sx={{ maxWidth: 420, maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {value}
        </Box>
      )}
      placement="bottom-start"
      enterDelay={400}
      // Controlled so expanding the text can dismiss a tooltip that is already
      // open instead of leaving it floating over the full description.
      open={tooltipOpen}
      onOpen={() => setTooltipOpen(true)}
      onClose={() => setTooltipOpen(false)}
      disableHoverListener={!clamped || expanded}
      disableFocusListener={!clamped || expanded}
    >
      <Typography
        ref={textRef}
        variant="caption"
        color="text.secondary"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-expanded={interactive ? expanded : undefined}
        aria-label={interactive ? (expanded ? collapseLabel : expandLabel) : undefined}
        onClick={handleClick}
        onDoubleClick={onEdit}
        onKeyDown={handleKeyDown}
        sx={{
          display: expanded ? 'block' : '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lines,
          overflow: expanded ? 'visible' : 'hidden',
          overflowWrap: 'anywhere',
          maxWidth,
          cursor: interactive ? 'pointer' : onEdit ? 'text' : 'default',
          borderRadius: 0.5,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          ...sx,
        }}
      >
        {value}
      </Typography>
    </Tooltip>
  );
}

export default ExpandableDescription;
