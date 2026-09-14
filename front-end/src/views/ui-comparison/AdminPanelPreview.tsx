import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
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
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { IconCheck, IconChevronDown, IconDotsVertical, IconFlask, IconLock, IconLockOpen, IconPlus, IconRefresh, IconRobot, IconTrash, IconUserCheck, IconUserOff } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
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

function UserIdentity({ user, isSelf }: { user: User; isSelf: boolean }) {
  const { t } = useTranslation();
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(' ');
  return <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
    <Avatar sx={{ width: 36, height: 36, flex: '0 0 auto', bgcolor: 'primary.light', color: 'primary.main', fontSize: '0.8125rem', fontWeight: 600 }}>
      {initialsFor(user)}
    </Avatar>
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{user.username}</Typography>
        {isSelf && <Chip size="small" label={t('admin-panel.you')} />}
        {isFixtureUser(user) && <Chip size="small" variant="outlined" label={t('admin-panel.testUser')} />}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {fullName && <Typography variant="body2" color="text.secondary" noWrap>{fullName}</Typography>}
        <ProviderBadges provider={user.provider} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography>
    </Box>
  </Stack>;
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
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await auth.getAllUsers();
    setUsers([...(result || []), ...PREVIEW_FIXTURES]);
    if (!result) setError(t('alertMessages.usersFetchError'));
    setLoading(false);
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
    const ok = await auth.deleteUserByIdAction(target.id);
    setDeleteBusy(false);
    if (ok) {
      setUsers((current) => current.filter((user) => user.id !== target.id));
      notify(t('admin-panel.userDeleted', { username: target.username }), { severity: 'success' });
      setPendingDelete(null);
    } else {
      notifyError(t('alertMessages.userDeleteError'));
    }
  };

  const renderUserCard = (user: User) => {
    const disabled = busyId === user.id || isFixtureUser(user);
    const isSelf = auth.user?.id === user.id;
    return <Paper key={user.id} variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}><UserIdentity user={user} isSelf={isSelf} /></Box>
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
      <TableCell sx={{ ...bodyCellSx, ...columnSx.user }}><UserIdentity user={user} isSelf={isSelf} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.role }}><RoleControl user={user} disabled={disabled} onChange={changeRole} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.status }}><AccountStatusBadge user={user} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.access }}><AccessBadge user={user} /></TableCell>
      <TableCell sx={{ ...bodyCellSx, ...columnSx.beta }}><BetaBadge user={user} /></TableCell>
      {marketplace && <TableCell sx={{ ...bodyCellSx, ...columnSx.marketplace }}><MarketplaceRolesStatus user={user} /></TableCell>}
      <TableCell align="right" sx={{ ...bodyCellSx, ...columnSx.actions }}><UserActionsMenu user={user} isSelf={isSelf} disabled={disabled} marketplace={marketplace} onToggleBeta={(target, checked) => void toggleBeta(target, checked)} onToggleActivated={(target, checked) => void toggleActivated(target, checked)} onToggleAccess={(target, revoked) => void toggleAccess(target, revoked)} onChangeMarketplaceRole={changeMarketplaceRole} onRequestDelete={setPendingDelete} /></TableCell>
    </TableRow>;
  };

  return <PageContainer title={t('admin-panel.title')} description={t('admin-panel.usageDescription')}>
    <Stack spacing={3}>
      <PageHeader
        title={t('admin-panel.title')}
        description={t('admin-panel.usageDescription')}
        action={<Button component={Link} to="/admin/ai" variant="outlined" startIcon={<IconRobot size={18} />}>{t('aiAdmin.open')}</Button>}
      />
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            fullWidth
            label={t('admin-panel.searchUsers')}
            placeholder={t('admin-panel.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            select
            size="small"
            label={t('admin-panel.role')}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            sx={{ width: { xs: '100%', sm: 168 }, flexShrink: 0 }}
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
            sx={{ width: { xs: '100%', sm: 176 }, flexShrink: 0 }}
          >
            <MenuItem value="">{t('admin-panel.allAccess')}</MenuItem>
            <MenuItem value="active">{t('admin-panel.accessAllowed')}</MenuItem>
            <MenuItem value="revoked">{t('admin-panel.accessDenied')}</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {t('admin-panel.userCount', { count: filtered.length })}
          </Typography>
          {(search || roleFilter || accessFilter) && filtered.length > 0
            ? <Button size="small" onClick={clearFilters} sx={{ flexShrink: 0 }}>{t('admin-panel.clearFilters')}</Button>
            : null}
        </Stack>
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
                  ? <Stack spacing={2}>{filtered.map(renderUserCard)}</Stack>
                  : <TableContainer component={Paper} variant="outlined">
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
                      <TableBody>{filtered.map(renderUserRow)}</TableBody>
                    </Table>
                  </TableContainer>}
      </Stack>
    </Stack>
    <Dialog open={Boolean(pendingDelete)} onClose={deleteBusy ? undefined : () => setPendingDelete(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{t('admin-panel.deleteUserTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{pendingDelete ? t('admin-panel.deleteUserBody', { username: pendingDelete.username }) : ''}</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={deleteBusy} onClick={() => setPendingDelete(null)}>{t('cancel')}</Button>
        <Button variant="contained" color="error" disabled={deleteBusy} onClick={() => void confirmDelete()}>{t('admin-panel.deleteUserConfirm')}</Button>
      </DialogActions>
    </Dialog>
  </PageContainer>;
}
