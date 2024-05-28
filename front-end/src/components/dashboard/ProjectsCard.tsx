import React from 'react';
import DashboardCard from '../shared/DashboardCardWithChildren';
import Fab from '@mui/material/Fab';
import PageContainer from 'src/components/container/PageContainer';
import NewProjectDialog from './NewProjectDialog';

import { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAdd } from '@fortawesome/free-solid-svg-icons';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { IconCode, IconPuzzle } from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SuccessAlert from '../alerts/SuccessAlert';
import ErrorAlert from '../alerts/ErrorAlert';

const ProjectsCard = () => {
  const { t } = useTranslation();

  const auth = useAuth();
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer] = useState(false);

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  const [showSuccessAlertText, setShowSuccessAlertText] = useState("");
  const [showErrorAlertText, setShowErrorAlertText] = useState("");

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
        setShowErrorAlert(true);
        setShowErrorAlertText(t('alertMessages.projectsFetchError'));
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, []);

  const handleDeleteProject = async (projectId) => {
    try {
      const success = await auth.deleteProjectByIdAction(projectId);
      if (success) {
        setShowSuccessAlert(true);
        setShowSuccessAlertText(t('alertMessages.projectDeleted'));
        // Update the projects state to reflect the deletion
        setProjects((prevProjects) => prevProjects.filter((project) => project.id !== projectId));
      } else {
        setShowErrorAlert(true);
        setShowErrorAlertText(t('alertMessages.projectDeleteError'));
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
      <NewProjectDialog
        showDrawer={showDrawer}
        handleDrawerClose={handleDrawerClose}
        isDescriptionDisabled={false}
        editorInitialValue='python'
        code=''
      />
      <DashboardCard
        title={t('projects-card.card-title')}
        subtitle={t('projects-card.subtitle')}
        action={
          <Fab color="success" aria-label="add" onClick={() => setShowDrawer(true)}>
            <FontAwesomeIcon icon={faAdd} />
          </Fab>
        }
      >
        <TableContainer>
          <Table
            aria-label="simple table"
            sx={{
              whiteSpace: 'nowrap',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('projects-card.type')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('projects-card.title')}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {t('projects-card.description')}
                  </Typography>
                </TableCell>
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
                    <TableCell align="center">
                      <Typography>{project.name}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography>{project.description}</Typography>
                    </TableCell>
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
      </DashboardCard>
      {showSuccessAlert && (
        <SuccessAlert title={showSuccessAlertText} description={""} />
      )}

      {showErrorAlert && (
        <ErrorAlert title={showErrorAlertText} description={""} />
      )}
    </PageContainer>
  );
};

export default ProjectsCard;
