import React from 'react';
import DashboardCard from '../shared/DashboardCardWithChildren';
import Fab from '@mui/material/Fab';
import PageContainer from 'src/components/container/PageContainer';
import SuccessAlert from '../alerts/SuccessAlert';
import ErrorAlert from '../alerts/ErrorAlert';
import MenuItem from '@mui/material/MenuItem';
import { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Select,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { IconUserFilled } from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import { useTranslation } from 'react-i18next';
import { UserRole } from 'src/authentication/AuthInterfaces';


const UsersCard = () => {
  const { t } = useTranslation();

  const auth = useAuth();

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  const [showSuccessAlertText, setShowSuccessAlertText] = useState("");
  const [showErrorAlertText, setShowErrorAlertText] = useState("");

  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await auth.getAllUsers();
        if (users) {
          setUsers(users);
        }
      } catch (error) {
        setShowErrorAlert(true);
        setShowErrorAlertText(t('alertMessages.usersFetchError'));
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
        setShowErrorAlert(true);
        setShowErrorAlertText(t('alertMessages.userDeleteError'));
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
      setShowErrorAlert(true);
      setShowErrorAlertText(t('alertMessages.userRoleInvalid'));
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
      setShowErrorAlert(true);
      setShowErrorAlertText(t('alertMessages.userDataUpdateError'));
      console.error('Error updating user:', error);
    }
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
                <TableCell align="center" size='small'>
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
                    {t('edit')}
                  </Typography>
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
                  <TableCell colSpan={6}>
                    <Typography>{t('admin-panel.noUsersFound')} </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell align="center">
                      <Typography color="black">
                        <IconUserFilled />
                      </Typography>
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
                      <Fab
                        color="error"
                        size="small"
                        aria-label="trash"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Fab>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DashboardCard>
      {showSuccessAlert && (
        <SuccessAlert title={showSuccessAlertText} description={""} />
      )}

      {showErrorAlert && (
        <ErrorAlert title={showErrorAlertText} description={""} />
      )}
      {/* // </PageContainer> */}
    </PageContainer>
  );
};

export default UsersCard;
