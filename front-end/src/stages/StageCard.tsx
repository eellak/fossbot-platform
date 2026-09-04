import React from 'react';
import { Avatar, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';

export function GitHubIdentity({ username, suffix }: { username: string; suffix?: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar
        src={`https://github.com/${encodeURIComponent(username)}.png?size=40`}
        alt=""
        sx={{ width: 20, height: 20, bgcolor: 'action.selected', color: 'text.secondary' }}
      >
        <GitHubIcon sx={{ fontSize: 14 }} />
      </Avatar>
      <Typography variant="caption" color="text.secondary" noWrap>
        @{username}{suffix}
      </Typography>
    </Stack>
  );
}

export function formatStageDate(value?: string | number | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatStageRelativeTime(value?: string | number | null): string {
  if (!value) return 'Update time unknown';
  const timestamp = typeof value === 'number' ? value : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return String(value);
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes === 1) return 'Updated a minute ago';
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  return `Updated ${formatStageDate(timestamp)}`;
}

export function StagePreview({ title, previewUrl, height = 156 }: { title: string; previewUrl?: string | null; height?: number }) {
  if (previewUrl) {
    return (
      <Box
        component="img"
        src={previewUrl}
        alt={`${title} preview`}
        loading="lazy"
        sx={{ width: '100%', height, aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', bgcolor: 'grey.200' }}
      />
    );
  }
  return (
    <Box sx={{ height, aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'text.secondary' }}>
      <Stack spacing={0.25} alignItems="center">
        <Typography variant="subtitle2" fontWeight={700}>FOSSBot stage</Typography>
        <Typography variant="caption">Preview unavailable</Typography>
      </Stack>
    </Box>
  );
}

interface StageCardProps {
  title: string;
  description?: string | null;
  previewUrl?: string | null;
  metadata?: React.ReactNode;
  badges?: React.ReactNode;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void | Promise<void>;
  onOpen?: () => void;
  surface?: 'outlined' | 'embedded';
}

export function StageCard({ title, description, previewUrl, metadata, badges, actionLabel, actionDisabled, onAction, onOpen, surface = 'outlined' }: StageCardProps) {
  const interactive = !!onOpen;
  const embedded = surface === 'embedded';
  return (
    <Box
      component="article"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `View ${title}` : undefined}
      onClick={onOpen}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.();
        }
      } : undefined}
      sx={{
        height: '100%',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: embedded ? 1.5 : 2,
        bgcolor: embedded ? 'transparent' : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        cursor: interactive ? 'pointer' : 'default',
        transition: embedded
          ? 'background-color 180ms cubic-bezier(0.25, 1, 0.5, 1)'
          : 'border-color 180ms cubic-bezier(0.25, 1, 0.5, 1), transform 180ms cubic-bezier(0.25, 1, 0.5, 1)',
        '&:hover': interactive ? embedded ? { bgcolor: 'action.hover' } : { borderColor: 'primary.main', transform: 'translateY(-2px)' } : undefined,
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      }}
    >
      <StagePreview title={title} previewUrl={previewUrl} />
      <Stack spacing={1.5} sx={{ p: 2, flex: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} title={title} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {title}
          </Typography>
          {metadata}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {description || 'No description provided.'}
        </Typography>
        {badges}
        {actionLabel && onAction && (
          <Button
            size="small"
            variant="outlined"
            disabled={actionDisabled}
            onClick={(event) => { event.stopPropagation(); void onAction(); }}
            sx={{ mt: 'auto', minHeight: 44, alignSelf: 'flex-start' }}
          >
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export function StageCardSkeleton({ surface = 'outlined' }: { surface?: 'outlined' | 'embedded' }) {
  const embedded = surface === 'embedded';
  return (
    <Box sx={{ height: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: embedded ? 1.5 : 2, bgcolor: embedded ? 'transparent' : 'background.paper' }} aria-hidden="true">
      <Skeleton variant="rectangular" height={156} animation="wave" />
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Skeleton width="62%" height={24} />
        <Skeleton width="42%" height={18} />
        <Skeleton width="100%" />
        <Skeleton width="78%" />
      </Stack>
    </Box>
  );
}
