import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { IconCheck, IconChevronDown, IconCopy, IconDotsVertical, IconFlask, IconLock, IconLockOpen, IconPlus, IconRefresh, IconTrash, IconUserCheck, IconUserOff } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import PageContainer from 'src/components/container/PageContainer';
import PageHeader from 'src/components/shared/PageHeader';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole, type MarketplaceRole, type User } from 'src/authentication/AuthInterfaces';
import { useFeatureFlags } from 'src/config/FeatureFlags';
import googleIcon from 'src/assets/images/svgs/google-icon.svg';
import githubIcon from 'src/assets/images/svgs/github-icon.svg';

// Development-only proposal for the admin panel. It reads the same users API as the
// production page and keeps every capability, but follows the approved browsing-page
// composition: one PageHeader, filters, then a collection with a single surface.

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  'google.com': 'Google',
  github: 'GitHub',
  'github.com': 'GitHub',
};

const PROVIDER_ICONS: Record<string, string> = {
  google: googleIcon,
  'google.com': googleIcon,
  github: githubIcon,
  'github.com': githubIcon,
};

const MARKETPLACE_ROLES: MarketplaceRole[] = ['verifier', 'moderator'];

// Sample rows for the comparison preview only. Negative ids mark them as fixtures so
// they render read-only and never reach the users API.
const isFixtureUser = (user: User) => user.id < 0;

const PREVIEW_FIXTURES: User[] = [
  { id: -1, username: 'ada_google', firstname: 'Ada', lastname: 'Lovelace', email: 'ada.lovelace@example.com', role: UserRole.USER, beta_tester: false, activated: true, provider: 'google', firebase_uid: 'preview-google', access_revoked: false, marketplace_roles: [] },
  { id: -2, username: 'alan_github', firstname: 'Alan', lastname: 'Turing', email: 'alan.turing@example.com', role: UserRole.TUTOR, beta_tester: true, activated: true, provider: 'github', firebase_uid: 'preview-github', access_revoked: false, marketplace_roles: ['verifier'] },
  { id: -3, username: 'grace_linked', firstname: 'Grace', lastname: 'Hopper', email: 'grace.hopper@example.com', role: UserRole.USER, beta_tester: false, activated: false, provider: 'google,github', firebase_uid: 'preview-linked', access_revoked: true, marketplace_roles: ['moderator'] },
  ...Array.from({ length: 17 }, (_, index): User => {
    const n = index + 1;
    return {
      id: -(n + 10),
      username: `sample_user_${String(n).padStart(2, '0')}`,
      firstname: 'Sample',
      lastname: `User ${n}`,
      email: `sample.user.${n}@example.com`,
      role: n % 5 === 0 ? UserRole.ADMIN : n % 2 === 0 ? UserRole.TUTOR : UserRole.USER,
      beta_tester: n % 4 === 0,
      activated: n % 7 !== 0,
      provider: n % 3 === 0 ? 'github' : n % 3 === 1 ? 'google' : 'google,github',
      firebase_uid: `preview-sample-${n}`,
      access_revoked: n % 9 === 0,
      marketplace_roles: n % 3 === 0 ? ['verifier'] : n % 4 === 0 ? ['moderator'] : [],
    };
  }),
];

const parseProviders = (provider: string) => (provider || 'local')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const isLocalAccount = (user: User) => {
  const providers = parseProviders(user.provider);
  return !user.firebase_uid && providers.every((providerId) => ['local', 'password'].includes(providerId));
};

const initialsFor = (user: User) => {
  const first = (user.firstname || '').trim();
  const last = (user.lastname || '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (user.username || first || last || '?').slice(0, 2).toUpperCase();
};

const fullNameFor = (user: User) => [user.firstname, user.lastname]
  .map((value) => (value || '').trim())
  .filter(Boolean)
  .join(' ');

// Shared cell rhythm and a deliberate column grid: one flexible identity column,
// content-sized controls.
const headCellSx = { color: 'text.secondary', fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' as const, px: 2, py: 1.5, verticalAlign: 'middle' as const };
const bodyCellSx = { px: 2, py: 1.5, verticalAlign: 'middle' as const };
const columnSx = {
  user: { width: 320, minWidth: 280 },
  role: { minWidth: 150 },
  beta: { minWidth: 110 },
  status: { minWidth: 120 },
  access: { minWidth: 120 },
  marketplace: { minWidth: 170 },
  actions: { minWidth: 56 },
};

// Tone → badge styling. Amber is reserved for a Pending account status once the API exposes one.
const badgeTones = {
  primary: { bgcolor: 'primary.light', color: 'primary.main' },
  success: { bgcolor: 'success.light', color: 'success.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
  neutral: { bgcolor: 'action.hover', color: 'text.secondary' },
} as const;
type BadgeTone = keyof typeof badgeTones;

const menuGroupSx = { bgcolor: 'transparent', pl: 2, pr: 2, pt: 1, pb: 0.25, lineHeight: '18px', fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' };

function MenuIcon({ children }: { children: ReactNode }) {
  return <Box component="span" sx={{ width: 18, mr: 1.25, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>{children}</Box>;
}

function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <Chip size="small" label={label} sx={{ ...badgeTones[tone], fontWeight: 600 }} />;
}

function BetaBadge({ user }: { user: User }) {
  const { t } = useTranslation();
  return user.beta_tester
    ? <StatusBadge tone="primary" label={t('admin-panel.betaBadge')} />
    : <StatusBadge tone="neutral" label={t('admin-panel.standardBadge')} />;
}

function AccountStatusBadge({ user }: { user: User }) {
  const { t } = useTranslation();
  return user.activated
    ? <StatusBadge tone="success" label={t('admin-panel.active')} />
    : <StatusBadge tone="neutral" label={t('admin-panel.deactivated')} />;
}

function AccessBadge({ user }: { user: User }) {
  const { t } = useTranslation();
  return user.access_revoked
    ? <StatusBadge tone="error" label={t('admin-panel.accessDenied')} />
    : <StatusBadge tone="success" label={t('admin-panel.accessAllowed')} />;
}

function ProviderBadges({ provider }: { provider: string }) {
  const theme = useTheme();
  const external = parseProviders(provider).filter((providerId) => PROVIDER_ICONS[providerId]);
  if (!external.length) return null;
  return <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
    {external.map((providerId) => {
      const label = PROVIDER_LABELS[providerId] || providerId;
      return <Tooltip key={providerId} title={label}><Box component="img" src={PROVIDER_ICONS[providerId]} alt={label} sx={{
        width: 16,
        height: 16,
        display: 'block',
        ...(providerId.startsWith('github') && theme.palette.mode === 'dark' ? { filter: 'brightness(0) invert(1)' } : {}),
      }} /></Tooltip>;
    })}
  </Stack>;
}

function UserIdentity({ user, isSelf, onOpenDetails }: { user: User; isSelf: boolean; onOpenDetails: (user: User) => void }) {
  const { t } = useTranslation();
  const fullName = fullNameFor(user);
  const detailsLabel = t('admin-panel.viewUserDetails', { username: user.username });
  return <ButtonBase
    onClick={() => onOpenDetails(user)}
    aria-label={detailsLabel}
    aria-haspopup="dialog"
    sx={{ maxWidth: '100%', minWidth: 0, justifyContent: 'flex-start', gap: 1.5, borderRadius: 1, cursor: 'pointer', textAlign: 'left', '&:hover .user-name': { color: 'text.secondary' } }}
  >
    <Avatar src={user.image_url || undefined} sx={{ width: 36, height: 36, bgcolor: 'primary.light', color: 'primary.main', fontSize: '0.8125rem', fontWeight: 600 }}>
      {initialsFor(user)}
    </Avatar>
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography className="user-name" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{user.username}</Typography>
        {isSelf && <Chip size="small" label={t('admin-panel.you')} />}
        {isFixtureUser(user) && <Chip size="small" variant="outlined" label={t('admin-panel.testUser')} />}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {fullName && <Typography variant="body2" color="text.secondary" noWrap>{fullName}</Typography>}
        <ProviderBadges provider={user.provider} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography>
    </Box>
  </ButtonBase>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '152px minmax(0, 1fr)' }, gap: { xs: 0.25, sm: 2 }, py: 1 }}>
    <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
    <Box component="dd" sx={{ m: 0, minWidth: 0 }}>{children}</Box>
  </Box>;
}

function CopyableValue({ label, text, onCopy }: { label: string; text?: string | null; onCopy: (label: string, text: string) => void }) {
  const { t } = useTranslation();
  if (!text) return <Typography variant="body2">—</Typography>;
  const copyLabel = t('admin-panel.copyValue', { label });
  return <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
    <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{text}</Typography>
    <Tooltip title={copyLabel}>
      <IconButton
        size="small"
        aria-label={copyLabel}
        onClick={() => onCopy(label, text)}
        sx={{ flex: '0 0 auto', width: 40, height: 40 }}
      >
        <IconCopy size={16} />
      </IconButton>
    </Tooltip>
  </Stack>;
}

function UserDetailsDialog({ user, isSelf, onClose }: { user: User | null; isSelf: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useNotifications();
  if (!user) return null;
  const fullName = fullNameFor(user);
  const providers = parseProviders(user.provider);
  const accountType = isLocalAccount(user)
    ? t('admin-panel.localAccount')
    : providers.length > 1
      ? t('admin-panel.linkedAccount')
      : t('admin-panel.externalAccount');
  const providerLabels = isLocalAccount(user)
    ? [t('admin-panel.localAccount')]
    : providers.map((providerId) => PROVIDER_LABELS[providerId] || providerId);
  const value = (text?: string | null) => <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{text || '—'}</Typography>;
  const copyValue = async (label: string, text: string) => {
    if (!navigator.clipboard?.writeText) {
      notify(t('admin-panel.copyUnavailable'), { severity: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify(t('admin-panel.copied', { label }), { severity: 'success' });
    } catch {
      notify(t('admin-panel.copyFailed', { label }), { severity: 'error' });
    }
  };

  return <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="user-details-title">
    <DialogTitle id="user-details-title">{t('admin-panel.userDetails')}</DialogTitle>
    <DialogContent>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ pb: 2 }}>
        <Avatar src={user.image_url || undefined} sx={{ width: 48, height: 48, bgcolor: 'primary.light', color: 'primary.main', fontSize: '1rem', fontWeight: 600 }}>
          {initialsFor(user)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>{fullName || user.username}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>@{user.username}</Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
            {isSelf && <Chip size="small" label={t('admin-panel.you')} />}
            {isFixtureUser(user) && <Chip size="small" variant="outlined" label={t('admin-panel.testUser')} />}
          </Stack>
        </Box>
      </Stack>
      {isFixtureUser(user) && <Box className="visual-language-supporting-panel" sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="body2">{t('admin-panel.fixtureReadOnly')}</Typography>
      </Box>}

      <Divider />
      <Typography component="h3" variant="h6" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>{t('admin-panel.identityDetails')}</Typography>
      <Box component="dl" sx={{ m: 0 }}>
        <DetailRow label={t('admin-panel.userId')}><CopyableValue label={t('admin-panel.userId')} text={String(user.id)} onCopy={(label, text) => void copyValue(label, text)} /></DetailRow>
        <DetailRow label={t('admin-panel.username')}>{value(user.username)}</DetailRow>
        <DetailRow label={t('admin-panel.firstName')}>{value(user.firstname)}</DetailRow>
        <DetailRow label={t('admin-panel.lastName')}>{value(user.lastname)}</DetailRow>
        <DetailRow label={t('admin-panel.email')}><CopyableValue label={t('admin-panel.email')} text={user.email} onCopy={(label, text) => void copyValue(label, text)} /></DetailRow>
        {user.image_url && <DetailRow label={t('admin-panel.profileImage')}>
          <Box component="details" sx={{ '& > summary': { cursor: 'pointer', color: 'text.secondary', fontSize: '0.875rem' }, '& > summary:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 } }}>
            <Box component="summary">{t('admin-panel.viewProfileImageUrl')}</Box>
            <Box sx={{ pt: 1 }}><CopyableValue label={t('admin-panel.profileImage')} text={user.image_url} onCopy={(label, text) => void copyValue(label, text)} /></Box>
          </Box>
        </DetailRow>}
      </Box>

      <Divider />
      <Typography component="h3" variant="h6" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>{t('admin-panel.accountDetails')}</Typography>
      <Box component="dl" sx={{ m: 0 }}>
        <DetailRow label={t('admin-panel.accountType')}>{value(accountType)}</DetailRow>
        <DetailRow label={t('admin-panel.signInProviders')}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <ProviderBadges provider={user.provider} />
            {value(providerLabels.join(', '))}
          </Stack>
        </DetailRow>
        {user.firebase_uid && <DetailRow label={t('admin-panel.externalAccountId')}><CopyableValue label={t('admin-panel.externalAccountId')} text={user.firebase_uid} onCopy={(label, text) => void copyValue(label, text)} /></DetailRow>}
      </Box>

      <Divider />
      <Typography component="h3" variant="h6" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>{t('admin-panel.permissionsAndStatus')}</Typography>
      <Box component="dl" sx={{ m: 0 }}>
        <DetailRow label={t('admin-panel.role')}>{value(t(`roles.${user.role}`))}</DetailRow>
        <DetailRow label={t('admin-panel.status')}><AccountStatusBadge user={user} /></DetailRow>
        <DetailRow label={t('admin-panel.access')}><AccessBadge user={user} /></DetailRow>
        <DetailRow label={t('betaTester')}><BetaBadge user={user} /></DetailRow>
        <DetailRow label={t('admin-panel.marketplaceRoles')}><MarketplaceRolesStatus user={user} /></DetailRow>
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{t('admin-panel.closeDetails')}</Button>
    </DialogActions>
  </Dialog>;
}

function RoleControl({ user, disabled, onChange }: { user: User; disabled: boolean; onChange: (user: User, role: UserRole) => void }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const label = t('admin-panel.roleAria', { username: user.username });
  return <>
    <Button
      size="small"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={Boolean(anchor)}
      onClick={(event) => setAnchor(event.currentTarget)}
      endIcon={<IconChevronDown size={16} />}
      sx={{ color: 'text.primary', fontWeight: 700, border: 1, borderColor: 'divider', px: 1.5, '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary' } }}
    >
      {t(`roles.${user.role}`)}
    </Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
      {Object.values(UserRole).map((role) => <MenuItem key={role} selected={user.role === role} onClick={() => { close(); if (user.role !== role) onChange(user, role); }}>
        <ListItemText>{t(`roles.${role}`)}</ListItemText>
        {user.role === role && <IconCheck size={16} />}
      </MenuItem>)}
    </Menu>
  </>;
}

function MarketplaceRolesStatus({ user }: { user: User }) {
  const { t } = useTranslation();
  const assigned = MARKETPLACE_ROLES.filter((role) => (user.marketplace_roles || []).includes(role));
  if (!assigned.length) return <Typography variant="body2" color="text.secondary" aria-label={t('admin-panel.noRoles')}>—</Typography>;
  return <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
    {assigned.map((role) => <Chip key={role} size="small" variant="outlined" label={t(`admin-panel.${role}`)} />)}
  </Stack>;
}

function UserActionsMenu({ user, isSelf, disabled, marketplace, onToggleBeta, onToggleActivated, onToggleAccess, onChangeMarketplaceRole, onRequestDelete }: {
  user: User;
  isSelf: boolean;
  disabled: boolean;
  marketplace: boolean;
  onToggleBeta: (user: User, checked: boolean) => void;
  onToggleActivated: (user: User, checked: boolean) => void;
  onToggleAccess: (user: User, revoked: boolean) => void;
  onChangeMarketplaceRole: (user: User, role: MarketplaceRole, checked: boolean) => void;
  onRequestDelete: (user: User) => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const beta = Boolean(user.beta_tester);
  const activated = Boolean(user.activated);
  const revoked = Boolean(user.access_revoked);
  const isAdmin = user.role === UserRole.ADMIN;
  const assigned = user.marketplace_roles || [];
  const canDelete = isLocalAccount(user) && !isSelf;
  const label = t('admin-panel.manageUser', { username: user.username });
  return <>
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          disabled={disabled}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <IconDotsVertical size={18} />
        </IconButton>
      </span>
    </Tooltip>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
      <ListSubheader disableSticky role="presentation" sx={menuGroupSx}>{t('admin-panel.accountGroup')}</ListSubheader>
      <MenuItem onClick={() => { close(); onToggleBeta(user, !beta); }}>
        <MenuIcon><IconFlask size={18} /></MenuIcon>
        <ListItemText>{beta ? t('admin-panel.removeFromBeta') : t('admin-panel.addToBeta')}</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { close(); onToggleActivated(user, !activated); }}>
        <MenuIcon>{activated ? <IconUserOff size={18} /> : <IconUserCheck size={18} />}</MenuIcon>
        <ListItemText>{activated ? t('admin-panel.deactivateAccount') : t('admin-panel.activateAccount')}</ListItemText>
      </MenuItem>
      {!isAdmin && <MenuItem onClick={() => { close(); onToggleAccess(user, !revoked); }}>
        <MenuIcon>{revoked ? <IconLockOpen size={18} /> : <IconLock size={18} />}</MenuIcon>
        <ListItemText>{revoked ? t('admin-panel.allowAccess') : t('admin-panel.revokeAccess')}</ListItemText>
      </MenuItem>}
      {marketplace && <ListSubheader disableSticky role="presentation" sx={menuGroupSx}>{t('admin-panel.marketplaceRoles')}</ListSubheader>}
      {marketplace && MARKETPLACE_ROLES.map((role) => {
        const has = assigned.includes(role);
        return <MenuItem key={role} onClick={() => { close(); onChangeMarketplaceRole(user, role, !has); }}>
          <MenuIcon>{has ? <IconCheck size={18} /> : <IconPlus size={18} />}</MenuIcon>
          <ListItemText>{t(`admin-panel.${role}`)}</ListItemText>
        </MenuItem>;
      })}
      {canDelete && <ListSubheader disableSticky role="presentation" sx={menuGroupSx}>{t('admin-panel.dangerGroup')}</ListSubheader>}
      {canDelete && <MenuItem onClick={() => { close(); onRequestDelete(user); }} sx={{ color: 'error.main' }}>
        <MenuIcon><IconTrash size={18} /></MenuIcon>
        <ListItemText>{t('delete')}</ListItemText>
      </MenuItem>}
    </Menu>
  </>;
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{children}</Box>
  </Stack>;
}

export default function AdminPanelPreview() {
  const { t } = useTranslation();
  const { notify } = useNotifications();
  const auth = useAuth();
  const { marketplace } = useFeatureFlags();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await auth.getAllUsers();
      setUsers([...(result || []), ...PREVIEW_FIXTURES]);
      if (!result) setError(t('alertMessages.usersFetchError'));
    } catch {
      setUsers(PREVIEW_FIXTURES);
      setError(t('alertMessages.usersFetchError'));
    } finally {
      setLoading(false);
    }
  }, [auth, t]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (accessFilter === 'active' && user.access_revoked) return false;
      if (accessFilter === 'revoked' && !user.access_revoked) return false;
      if (!query) return true;
      return [user.username, user.firstname, user.lastname, user.email].some((value) => (value || '').toLowerCase().includes(query));
    });
  }, [users, search, roleFilter, accessFilter]);

  useEffect(() => { setPage(0); }, [search, roleFilter, accessFilter, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);
  const paged = useMemo(() => filtered.slice(page * pageSize, page * pageSize + pageSize), [filtered, page, pageSize]);

  const clearFilters = () => { setSearch(''); setRoleFilter(''); setAccessFilter(''); };
  const notifyError = (message: string) => notify(message, { severity: 'error' });
  const applyResult = async (user: User, action: () => Promise<boolean>, next: User, message: string) => {
    if (isFixtureUser(user)) return;
    setBusyId(user.id);
    try {
      const ok = await action();
      if (ok) {
        setUsers((current) => current.map((item) => (item.id === user.id ? next : item)));
        notify(message, { severity: 'success' });
      } else {
        notifyError(t('alertMessages.userDataUpdateError'));
      }
    } catch {
      notifyError(t('alertMessages.userDataUpdateError'));
    } finally {
      setBusyId(null);
    }
  };
  const applyUser = async (user: User, action: () => Promise<User | undefined>, message: string) => {
    if (isFixtureUser(user)) return;
    setBusyId(user.id);
    try {
      const updated = await action();
      if (updated) {
        setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
        notify(message, { severity: 'success' });
      } else {
        notifyError(t('alertMessages.userDataUpdateError'));
      }
    } catch {
      notifyError(t('alertMessages.userDataUpdateError'));
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (user: User, role: UserRole) => applyUser(
    user,
    () => auth.updateUserRole(user.id, { role }),
    t('admin-panel.roleUpdated', { username: user.username }),
  );
  const toggleBeta = (user: User, checked: boolean) => applyResult(
    user,
    () => auth.updateUserBetaTesterStatus(user.id, { beta_tester: checked }),
    { ...user, beta_tester: checked },
    t('admin-panel.betaUpdated', { username: user.username }),
  );
  const toggleActivated = (user: User, checked: boolean) => applyResult(
    user,
    () => auth.updateUserActivatedStatus(user.id, { activated: checked }),
    { ...user, activated: checked },
    t('admin-panel.activatedUpdated', { username: user.username }),
  );
  const toggleAccess = (user: User, revoked: boolean) => applyResult(
    user,
    () => auth.updateUserAccessRevokedStatus(user.id, { access_revoked: revoked }),
    { ...user, access_revoked: revoked },
    revoked ? t('admin-panel.accessRevoked', { username: user.username }) : t('admin-panel.accessRestored', { username: user.username }),
  );
  const changeMarketplaceRole = (user: User, role: MarketplaceRole, checked: boolean) => {
    const current = user.marketplace_roles || [];
    const roles = checked ? [...new Set([...current, role])] : current.filter((item) => item !== role);
    return applyUser(user, () => auth.updateUserMarketplaceRoles(user.id, roles), t('admin-panel.roleUpdated', { username: user.username }));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleteBusy(true);
    try {
      const ok = await auth.deleteUserByIdAction(target.id);
      if (ok) {
        setUsers((current) => current.filter((user) => user.id !== target.id));
        notify(t('admin-panel.userDeleted', { username: target.username }), { severity: 'success' });
        setPendingDelete(null);
      } else {
        notifyError(t('alertMessages.userDeleteError'));
      }
    } catch {
      notifyError(t('alertMessages.userDeleteError'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const renderUserCard = (user: User) => {
    const disabled = busyId === user.id || isFixtureUser(user);
    const isSelf = auth.user?.id === user.id;
    return <Paper key={user.id} variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}><UserIdentity user={user} isSelf={isSelf} onOpenDetails={setSelectedUser} /></Box>
        <UserActionsMenu
          user={user}
          isSelf={isSelf}
          disabled={disabled}
          marketplace={marketplace}
          onToggleBeta={(target, checked) => void toggleBeta(target, checked)}
          onToggleActivated={(target, checked) => void toggleActivated(target, checked)}
          onToggleAccess={(target, revoked) => void toggleAccess(target, revoked)}
          onChangeMarketplaceRole={changeMarketplaceRole}
          onRequestDelete={setPendingDelete}
        />
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Stack spacing={1.5}>
        <SettingRow label={t('admin-panel.role')}><RoleControl user={user} disabled={disabled} onChange={changeRole} /></SettingRow>
        <SettingRow label={t('admin-panel.status')}><AccountStatusBadge user={user} /></SettingRow>
        <SettingRow label={t('admin-panel.access')}><AccessBadge user={user} /></SettingRow>
        <SettingRow label={t('betaTester')}><BetaBadge user={user} /></SettingRow>
        {marketplace && <SettingRow label={t('admin-panel.marketplaceRoles')}><MarketplaceRolesStatus user={user} /></SettingRow>}
      </Stack>
    </Paper>;
  };

  const renderUserRow = (user: User) => {
    const disabled = busyId === user.id || isFixtureUser(user);
    const isSelf = auth.user?.id === user.id;
    return <TableRow key={user.id} hover>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.user }}><UserIdentity user={user} isSelf={isSelf} onOpenDetails={setSelectedUser} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.role }}><RoleControl user={user} disabled={disabled} onChange={changeRole} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.status }}><AccountStatusBadge user={user} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.access }}><AccessBadge user={user} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.beta }}><BetaBadge user={user} /></TableCell>
      {marketplace && <TableCell sx={{ ...bodyCellSx, ...columnSx.marketplace }}><MarketplaceRolesStatus user={user} /></TableCell>}
      <TableCell align="right" sx={{ ...bodyCellSx, ...columnSx.actions }}><UserActionsMenu user={user} isSelf={isSelf} disabled={disabled} marketplace={marketplace} onToggleBeta={(target, checked) => void toggleBeta(target, checked)} onToggleActivated={(target, checked) => void toggleActivated(target, checked)} onToggleAccess={(target, revoked) => void toggleAccess(target, revoked)} onChangeMarketplaceRole={changeMarketplaceRole} onRequestDelete={setPendingDelete} /></TableCell>
    </TableRow>;
  };

  const pagination = <TablePagination
    component="div"
    count={filtered.length}
    page={page}
    onPageChange={(_, next) => setPage(next)}
    rowsPerPage={pageSize}
    onRowsPerPageChange={(event) => setPageSize(Number(event.target.value))}
    rowsPerPageOptions={[5, 10, 25, 50, 100]}
    labelRowsPerPage={t('admin-panel.rowsPerPage')}
    labelDisplayedRows={({ from, to, count }) => t('admin-panel.displayedRows', { from, to, count })}
    getItemAriaLabel={(type) => (type === 'next' ? t('admin-panel.nextPage') : t('admin-panel.previousPage'))}
    sx={{
      overflow: 'hidden',
      '& .MuiTablePagination-toolbar': { minHeight: 56, px: { xs: 1, sm: 2 }, flexWrap: { xs: 'wrap', sm: 'nowrap' }, rowGap: 0.5 },
      '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } },
      '& .MuiTablePagination-selectLabel': { ml: 0 },
      '& .MuiTablePagination-displayedRows': { ml: { xs: 1, sm: 4 } },
    }}
  />;

  return <PageContainer title={t('admin-panel.title')} description={t('admin-panel.usageDescription')}>
    <Stack spacing={3}>
      <PageHeader title={t('admin-panel.title')} description={t('admin-panel.usageDescription')} />
      <Stack spacing={2}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'minmax(240px, 1fr) 168px 176px auto' },
          gap: 2,
          alignItems: 'center',
        }}>
          <TextField
            size="small"
            fullWidth
            label={t('admin-panel.searchUsers')}
            placeholder={t('admin-panel.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 0, gridColumn: { sm: '1 / -1', lg: 'auto' } }}
          />
          <TextField
            select
            size="small"
            label={t('admin-panel.role')}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            sx={{ width: '100%' }}
          >
            <MenuItem value="">{t('admin-panel.allRoles')}</MenuItem>
            {Object.values(UserRole).map((role) => <MenuItem key={role} value={role}>{t(`roles.${role}`)}</MenuItem>)}
          </TextField>
          <TextField
            select
            size="small"
            label={t('admin-panel.access')}
            value={accessFilter}
            onChange={(event) => setAccessFilter(event.target.value)}
            sx={{ width: '100%' }}
          >
            <MenuItem value="">{t('admin-panel.allAccess')}</MenuItem>
            <MenuItem value="active">{t('admin-panel.accessAllowed')}</MenuItem>
            <MenuItem value="revoked">{t('admin-panel.accessDenied')}</MenuItem>
          </TextField>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ sm: 'flex-end', lg: 'flex-start' }}
            sx={{ minWidth: 0, gridColumn: { sm: '1 / -1', lg: 'auto' } }}
          >
            <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
              {t('admin-panel.userCount', { count: filtered.length })}
            </Typography>
            {(search || roleFilter || accessFilter) && filtered.length > 0
              ? <Button size="small" onClick={clearFilters}>{t('admin-panel.clearFilters')}</Button>
              : null}
          </Stack>
        </Box>
        {error && <Alert severity="error" action={<Button color="inherit" startIcon={<IconRefresh size={16} />} onClick={() => void load()}>{t('retry')}</Button>}>{error}</Alert>}
        {loading
          ? <Stack spacing={1.5} aria-busy="true" aria-label={t('loading')}>{[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} variant="rounded" height={84} />)}</Stack>
          : error && users.length === 0
            ? null
            : users.length === 0
              ? <Alert severity="info">{t('admin-panel.noUsersFound')}</Alert>
              : filtered.length === 0
                ? <Alert severity="info" action={<Button color="inherit" onClick={clearFilters}>{t('admin-panel.clearFilters')}</Button>}>{t('admin-panel.noResults')}</Alert>
                : isCompact
                  ? <>
                      <Stack spacing={2}>{paged.map(renderUserCard)}</Stack>
                      {pagination}
                    </>
                  : <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                      <TableContainer>
                        <Table aria-label={t('manageUsers')}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'background.default' }}>
                              <TableCell sx={{ ...headCellSx, ...columnSx.user }}>{t('admin-panel.user')}</TableCell>
                              <TableCell sx={{ ...headCellSx, ...columnSx.role }}>{t('admin-panel.role')}</TableCell>
                              <TableCell sx={{ ...headCellSx, ...columnSx.status }}>{t('admin-panel.status')}</TableCell>
                              <TableCell sx={{ ...headCellSx, ...columnSx.access }}>{t('admin-panel.access')}</TableCell>
                              <TableCell sx={{ ...headCellSx, ...columnSx.beta }}>{t('betaTester')}</TableCell>
                              {marketplace && <TableCell sx={{ ...headCellSx, ...columnSx.marketplace }}>{t('admin-panel.marketplaceRoles')}</TableCell>}
                              <TableCell align="right" sx={{ ...headCellSx, ...columnSx.actions }}>{t('admin-panel.actions')}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>{paged.map(renderUserRow)}</TableBody>
                        </Table>
                      </TableContainer>
                      <Divider />
                      {pagination}
                    </Paper>}
      </Stack>
    </Stack>
    <Dialog open={Boolean(pendingDelete)} onClose={deleteBusy ? undefined : () => setPendingDelete(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{t('admin-panel.deleteUserTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{pendingDelete ? t('admin-panel.deleteUserBody', { username: pendingDelete.username }) : ''}</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={deleteBusy} onClick={() => setPendingDelete(null)}>{t('cancel')}</Button>
        <Button
          variant="contained"
          color="error"
          disabled={deleteBusy}
          startIcon={deleteBusy ? <CircularProgress color="inherit" size={16} /> : undefined}
          onClick={() => void confirmDelete()}
        >
          {deleteBusy ? t('admin-panel.deletingUser') : t('admin-panel.deleteUserConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
    <UserDetailsDialog user={selectedUser} isSelf={auth.user?.id === selectedUser?.id} onClose={() => setSelectedUser(null)} />
  </PageContainer>;
}
