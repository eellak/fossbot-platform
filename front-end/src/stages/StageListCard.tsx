import React from 'react';
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';

const STAGE_PREVIEW_MASK = 'linear-gradient(to right, #000 0%, transparent 85%)';

export type StageListCardProps = {
  title: string;
  description?: string | null;
  /** Resolved image URL (object URL for private local previews, or a public URL). */
  previewUrl?: string | null;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  notice?: string | null;
  fallbackIcon?: React.ReactNode;
  onOpen: () => void;
  action?: React.ReactNode;
  /** `card` draws its own border (grids); `row` relies on a parent list boundary. */
  surface?: 'card' | 'row';
  divided?: boolean;
};

/**
 * Shared stage row/card used by the Stages panel and the editor Stage picker so
 * both read the same: full-bleed preview, primary title, one meta line.
 */
export function StageListCard({
  title,
  description,
  previewUrl,
  meta,
  status,
  notice,
  fallbackIcon,
  onOpen,
  action,
  surface = 'card',
  divided = false,
}: StageListCardProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        ...(surface === 'card'
          ? { border: '1px solid', borderColor: 'divider', borderRadius: 1 }
          : { borderTop: divided ? '1px solid' : 'none', borderColor: 'divider' }),
        '&:hover': { bgcolor: 'action.hover' },
        '&:hover .stage-title': { color: 'primary.main', textDecoration: 'underline' },
      }}
    >
      {previewUrl && (
        <Box
          component="img"
          src={previewUrl}
          alt=""
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: { xs: 96, sm: 156 },
            height: '100%',
            objectFit: 'cover',
            bgcolor: 'action.hover',
            // The theme's action.hover is a solid fill; keep the preview above
            // the button's hover background and click-through.
            zIndex: 1,
            pointerEvents: 'none',
            WebkitMaskImage: STAGE_PREVIEW_MASK,
            maskImage: STAGE_PREVIEW_MASK,
          }}
        />
      )}
      <ButtonBase
        onClick={onOpen}
        aria-label={`Open ${title}`}
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'left',
          gap: 1.5,
          py: 2,
          pr: 1,
          pl: previewUrl ? { xs: '92px', sm: '148px' } : 2,
        }}
      >
        {!previewUrl && (
          <Box
            className="visual-language-supporting-panel"
            aria-hidden="true"
            sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}
          >
            {fallbackIcon}
          </Box>
        )}
        <Box minWidth={0} sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography className="stage-title" variant="body2" color="primary.main" fontWeight={600} noWrap>{title}</Typography>
            {status}
          </Stack>
          <Typography
            variant="body2"
            noWrap
            sx={{ minHeight: '1.5em', color: description ? 'text.secondary' : 'text.disabled', fontStyle: description ? 'normal' : 'italic' }}
          >
            {description || 'No description'}
          </Typography>
          {meta ? <Typography component="div" variant="caption" color="text.secondary" noWrap>{meta}</Typography> : null}
          {notice ? <Typography variant="caption" color="error" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{notice}</Typography> : null}
        </Box>
      </ButtonBase>
      {action ? (
        <Stack direction="row" alignItems="center" sx={{ position: 'relative', flexShrink: 0, pr: 2 }}>
          {action}
        </Stack>
      ) : null}
    </Box>
  );
}

export default StageListCard;

export function StageListCardSkeleton() {
  return <Skeleton variant="rounded" height={96} />;
}
