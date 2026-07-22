import React from 'react';
import DashboardCard from '../shared/DashboardCardWithChildren';
import Fab from '@mui/material/Fab';
import PageContainer from 'src/components/container/PageContainer';
import MenuItem from '@mui/material/MenuItem';
import { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Select,
  Checkbox,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { IconUserFilled } from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import { useTranslation } from 'react-i18next';
import { UserRole } from 'src/authentication/AuthInterfaces';
import googleIcon from 'src/assets/images/svgs/google-icon.svg';
import githubIcon from 'src/assets/images/svgs/github-icon.svg';

interface UsersCardProps {
  onShowSuccessAlert: (message: string) => void;
  onShowErrorAlert: (message: string) => void;
}

const UsersCard = ({ onShowSuccessAlert, onShowErrorAlert }: UsersCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const auth = useAuth();

  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await auth.getAllUsers();
        if (users) {
          setUsers(users);
        }
      } catch (error) {
        onShowErrorAlert(t('alertMessages.usersFetchError'));
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);


  const handleDeleteUser = async (userId) => {
    try {
      const success = await auth.deleteUserByIdAction(userId);
      if (success) {
        window.location.reload();
      } else {
        onShowErrorAlert(t('alertMessages.userDeleteError'));
        console.error('Error deleting project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleUserRoleChange = async (userId, event) => {
    let newRole = event.target.value;

    // Check if the new role is a valid UserRole
    if (!Object.values(UserRole).includes(newRole)) {
      onShowSuccessAlert(t('alertMessages.userRoleInvalid'));
      return;
    }

    //Update user's role
    try {
      newRole = Object.values(UserRole).find(role => role == newRole)
      const user = await auth.updateUserRole(userId, { role: newRole });
      if (user) {
        window.location.reload();
      }
    } catch (error) {
      onShowErrorAlert(t('alertMessages.userDataUpdateError'));
      console.error('Error updating user:', error);
    }
  };

  const handleMarketplaceRoleChange = async (user, role: 'verifier' | 'moderator', checked: boolean) => {
    const currentRoles = user.marketplace_roles || [];
    const roles = checked ? [...new Set([...currentRoles, role])] : currentRoles.filter((currentRole) => currentRole !== role);
    const updated = await auth.updateUserMarketplaceRoles(user.id, roles);
    if (updated) {
      setUsers((currentUsers) => currentUsers.map((currentUser) => currentUser.id === updated.id ? updated : currentUser));
      onShowSuccessAlert(`Marketplace roles updated for ${updated.username}.`);
    } else {
      onShowErrorAlert(t('alertMessages.userDataUpdateError'));
    }
  };

  const handleBetaTesterChange = async (userId, event) => {
    const isBetaTester = event.target.checked;

    try {
      const user = await auth.updateUserBetaTesterStatus(userId, { beta_tester: isBetaTester });
      if (user) {
        window.location.reload();
      }
    } catch (error) {
      onShowErrorAlert(t('alertMessages.userDataUpdateError'));
      console.error('Error updating user:', error);
    }
  };

  const handleActivatedChange = async (userId, event) => {
    const isActivated = event.target.checked;

    try {
      const user = await auth.updateUserActivatedStatus(userId, { activated: isActivated });
      if (user) {
        window.location.reload();
      }
    } catch (error) {
      onShowErrorAlert(t('alertMessages.userDataUpdateError'));
      console.error('Error updating user:', error);
    }
  };

  const handleAccessRevokedChange = async (userId, accessRevoked) => {
    try {
      const user = await auth.updateUserAccessRevokedStatus(userId, { access_revoked: accessRevoked });
      if (user) {
        window.location.reload();
      }
    } catch (error) {
      onShowErrorAlert(t('alertMessages.userDataUpdateError'));
      console.error('Error updating user:', error);
    }
  };

  const PROVIDER_LABELS: Record<string, string> = {
    google: 'Google',
    'google.com': 'Google',
    github: 'GitHub',
    'github.com': 'GitHub',
    password: 'Email/Password',
    local: 'Local',
  };

  const PROVIDER_ICONS: Record<string, string> = {
    google: googleIcon,
    'google.com': googleIcon,
    github: githubIcon,
    'github.com': githubIcon,
  };

  const parseProviders = (provider: string) => (provider || 'local')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const isLocalAccount = (user) => {
    const providers = parseProviders(user.provider);
    return !user.firebase_uid && providers.every((providerId) => ['local', 'password'].includes(providerId));
  };

  const renderProvider = (provider: string) => {
    const providers = parseProviders(provider);

    return (
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" flexWrap="wrap">
        {providers.map((providerId) => {
          const label = PROVIDER_LABELS[providerId] || providerId;
          const icon = PROVIDER_ICONS[providerId];

          if (icon) {
            return (
              <Box
                key={providerId}
                component="img"
                src={icon}
                alt={label}
                title={label}
                sx={{
                  width: 18,
                  height: 18,
                  display: 'block',
                  ...(providerId.startsWith('github') && theme.palette.mode === 'dark'
                    ? { filter: 'brightness(0) invert(1)' }
                    : {}),
                }}
              />
            );
          }

          return (
            <Typography key={providerId} variant="body2">
              {label}
            </Typography>
          );
        })}
      </Stack>
    );
  };

  return (
    <PageContainer>
      <DashboardCard>
        <TableContainer>
          <Table
            aria-label="users table"
            sx={{
              whiteSpace: 'nowrap',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('username')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('firstname')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('lastname')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('emailAddress')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('admin-panel.provider')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('betaTester')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('activated')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('admin-panel.access')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('edit')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>Marketplace roles</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('delete')}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Typography>{t('admin-panel.noUsersFound')} </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  return (
                    <TableRow key={user.id}>
                    <TableCell align="center">
                      {user.username}
                    </TableCell>
                    <TableCell align="center">
                      <Typography>{user.firstname}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography>{user.lastname}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography>{user.email}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {renderProvider(user.provider)}
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={user.beta_tester}
                        onChange={(event) => handleBetaTesterChange(user.id, event)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={user.activated}
                        onChange={(event) => handleActivatedChange(user.id, event)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {user.role !== UserRole.ADMIN && (
                        <Button
                          variant="outlined"
                          color={user.access_revoked ? 'success' : 'error'}
                          size="small"
                          onClick={() => handleAccessRevokedChange(user.id, !user.access_revoked)}
                          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                        >
                          {user.access_revoked ? t('admin-panel.restoreAccess') : t('admin-panel.revokeAccess')}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Select
                        fullWidth
                        value={user.role}
                        onChange={(event) => handleUserRoleChange(user.id, event)}
                      >
                        <MenuItem value={'user'}>{t('roles.user')}</MenuItem>
                        <MenuItem value={'tutor'}>{t('roles.tutor')}</MenuItem>
                        <MenuItem value={'admin'}>{t('roles.admin')}</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell align="center">
                      <Stack spacing={0} alignItems="flex-start" sx={{ minWidth: 132 }}>
                        {(['verifier', 'moderator'] as const).map((role) => (
                          <Box key={role} sx={{ display: 'flex', alignItems: 'center' }}>
                            <Checkbox
                              size="small"
                              checked={(user.marketplace_roles || []).includes(role)}
                              onChange={(event) => handleMarketplaceRoleChange(user, role, event.target.checked)}
                              inputProps={{ 'aria-label': `${role} role for ${user.username}` }}
                            />
                            <Typography variant="body2" textTransform="capitalize">{role}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      {isLocalAccount(user) && (
                        <Fab
                          color="error"
                          size="small"
                          aria-label="trash"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Fab>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DashboardCard>
    </PageContainer>
  );
};

export default UsersCard;
