import React from 'react';
import { useState } from 'react';
import DashboardCard from '../../shared/DashboardCardWithChildren';
// import CustomSelect from '../../forms/theme-elements/CustomSelect';
import ProjectForm from 'src/views/forms/ProjectForm';
import {
  Dialog,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  TableContainer,
  Stack,
} from '@mui/material';
import PlatformUsersData from './PlatformUsersData';
import Fab from '@mui/material/Fab';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { faAdd } from '@fortawesome/free-solid-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import PageContainer from 'src/components/container/PageContainer';
import { IconCode, IconPuzzle } from '@tabler/icons-react'; 

const users = PlatformUsersData;

const ProjectsCard = () => {

  const [showDrawer, setShowDrawer] = useState(false);

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  return (
    <PageContainer>
      <DashboardCard
        title="FOSSBot Projects"
        subtitle="What kind of project will you create today?"
        action={
          <Fab color="success" aria-label="add">
            <FontAwesomeIcon
            icon={faAdd}
            onClick={() => setShowDrawer(true)}
            />
          </Fab>
        }
      >
        <>
        <Dialog
          open={showDrawer}
          onClose={handleDrawerClose}
          fullWidth
          maxWidth={'sm'}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{ sx: { position: 'fixed', top: 30, m: 0 } }}
        >
          <ProjectForm/>
        </Dialog>
        <TableContainer>
          <Table
            aria-label="simple table"
            sx={{
              whiteSpace: 'nowrap',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Creator
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Name
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Description
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Editor
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Extract
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Edit
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Delete
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((basic) => (
                <TableRow key={basic.id}>
                  <TableCell>
                    <Stack direction="row" spacing={2}>
                      <Avatar src={basic.imgsrc} alt={basic.imgsrc} sx={{ width: 40, height: 40 }} />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {basic.name}
                        </Typography>
                        <Typography color="textSecondary" fontSize="12px" variant="subtitle2">
                          {basic.specialty}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography color="textSecondary" variant="subtitle2" fontWeight={400}>
                      {basic.pname}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{basic.pdescription}</Typography>
                  </TableCell>
                  <TableCell>
                    {basic.editor === 'Monaco' ? <IconCode /> : <IconPuzzle />}
                  </TableCell>
                  <TableCell align="center">
                    <Fab color="primary" size="small" aria-label="download">
                      <FontAwesomeIcon icon={faDownload} />
                    </Fab>
                  </TableCell>
                  <TableCell align="center">
                    <Fab color="warning" size="small" aria-label="pencil">
                      <FontAwesomeIcon icon={faPencil} />
                    </Fab>
                  </TableCell>
                  <TableCell align="center">
                    <Fab color="error" size="small" aria-label="trash">
                      <FontAwesomeIcon icon={faTrash} />
                    </Fab>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      </DashboardCard>
    </PageContainer>
  );
};

export default ProjectsCard;
