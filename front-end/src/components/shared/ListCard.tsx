import React from 'react';
import { Box, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';

const IMAGE_MASK = 'linear-gradient(to right, #000 0%, transparent 85%)';

export type ListCardProps = {
  title: string;
  description?: string | null;
  /** Resolved image URL (object URL for private local previews, cover, or public URL). */
  previewUrl?: string | null;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  notice?: string | null;
  fallbackIcon?: React.ReactNode;
  onOpen: () => void;
  action?: React.ReactNode;
  /** Extra content rendered under the meta line, inside the open target. */
  children?: React.ReactNode;
  /** Accessible label for the open target. Defaults to `Open {title}`. */
  openLabel?: string;
  /** Shown, italic, when no description is available. */
  emptyDescription?: string;
  /** `card` draws its own border (grids); `row` relies on a parent list boundary. */
  surface?: 'card' | 'row';
  divided?: boolean;
};

/**
 * Shared row/card used by the Stages panel, the editor stage picker, and the
 * Courses panels so collections read the same: optional full-bleed preview,
 * primary title, equal-height description, one meta line.
 */
export function ListCard({
  title,
  description,
  previewUrl,
  meta,
  status,
  notice,
  fallbackIcon,
  onOpen,
  action,
  children,
  openLabel,
  emptyDescription = 'No description',
  surface = 'card',
  divided = false,
}: ListCardProps) {
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
        '&:hover .list-title': { color: 'primary.main', textDecoration: 'underline' },
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
            WebkitMaskImage: IMAGE_MASK,
            maskImage: IMAGE_MASK,
          }}
        />
      )}
      <ButtonBase
        onClick={onOpen}
        aria-label={openLabel || `Open ${title}`}
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
            <Typography className="list-title" variant="body2" color="primary.main" fontWeight={600} noWrap>{title}</Typography>
            {status}
          </Stack>
          <Typography
            variant="body2"
            noWrap
            sx={{ minHeight: '1.5em', color: description ? 'text.secondary' : 'text.disabled', fontStyle: description ? 'normal' : 'italic' }}
          >
            {description || emptyDescription}
          </Typography>
          {meta ? <Typography component="div" variant="caption" color="text.secondary" noWrap>{meta}</Typography> : null}
          {notice ? <Typography variant="caption" color="error" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{notice}</Typography> : null}
          {children}
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

export default ListCard;

export function ListCardSkeleton() {
  return <Skeleton variant="rounded" height={96} />;
}
