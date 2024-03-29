import React from 'react';
import DashboardCard from '../../shared/DashboardCardWithChildren';
import ProjectForm from 'src/views/forms/ProjectForm';
import Fab from '@mui/material/Fab';
import PageContainer from 'src/components/container/PageContainer';

import { useState, useEffect } from 'react';
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAdd } from '@fortawesome/free-solid-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { IconCode, IconPuzzle } from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ProjectsCard = () => {
  const { t } = useTranslation();

  const auth = useAuth();
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer] = useState(false);

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const fetchedProjects = await auth.getProjectsAction();

        if (fetchedProjects) {
          setProjects(fetchedProjects);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, []);

  const handleDeleteProject = async (projectId) => {
    try {
      const success = await auth.deleteProjectByIdAction(projectId);
      if (success) {
        console.log('Project deleted');
        // Update the projects state to reflect the deletion
        setProjects((prevProjects) => prevProjects.filter((project) => project.id !== projectId));
      } else {
        console.error('Error deleting project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleEditProject = async (projectId, project_type) => {
    if (project_type === 'python') {
      navigate(`/monaco-page/${projectId}`);
    } else {
      navigate(`/blockly-page/${projectId}`);
    }
  };

  return (
    <PageContainer>
      <DashboardCard
        title={t('projects-card.card-title')}
        subtitle={t('projects-card.subtitle')}
        action={
          <Fab color="success" aria-label="add" onClick={() => setShowDrawer(true)}>
            <FontAwesomeIcon icon={faAdd} />
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
            <ProjectForm />
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
                      {t('projects-card.type')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('projects-card.title')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('projects-card.description')}
                    </Typography>
                  </TableCell>
                  {/* <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Editor
                  </Typography>
                </TableCell> */}
                  {/* <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Extract
                  </Typography>
                </TableCell>  */}
                  <TableCell align="center">
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('projects-card.edit')}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('projects-card.delete')}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell>
                      <Typography>{t('projects-card.noProjectsFound')} </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell align="center">
                        {project.project_type === 'python' ? (
                          <Typography color="primary">
                            <IconCode />
                          </Typography>
                        ) : (
                          <Typography color="secondary">
                            <IconPuzzle />
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography>{project.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>{project.description}</Typography>
                      </TableCell>
                      {/* <TableCell align="center">
                    <Fab color="primary" size="small" aria-label="download">
                      <FontAwesomeIcon icon={faDownload} />
                    </Fab>
                  </TableCell> */}
                      <TableCell align="center">
                        <Fab
                          color="primary"
                          size="small"
                          aria-label="pencil"
                          onClick={() => handleEditProject(project.id, project.project_type)}
                        >
                          <FontAwesomeIcon icon={faPencil} />
                        </Fab>
                      </TableCell>
                      <TableCell align="center">
                        <Fab
                          color="error"
                          size="small"
                          aria-label="trash"
                          onClick={() => handleDeleteProject(project.id)}
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
        </>
      </DashboardCard>
    </PageContainer>
  );
};

export default ProjectsCard;
