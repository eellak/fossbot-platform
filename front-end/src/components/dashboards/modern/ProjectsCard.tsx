import React from 'react';
import { useState,useEffect } from 'react';
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
import {useAuth} from 'src/authentication/AuthProvider';
import python from 'src/assets/images/dashboard/python.png';
import blockly from 'src/assets/images/dashboard/blockly.png';
import { useNavigate } from "react-router-dom";
import DeleteBanner from 'src/components/widgets/banners/Banner3';
// const users = PlatformUsersData;



const ProjectsCard = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const  [showDrawer, setShowDrawer] = useState(false);

    // Add these state variables
  const [selectedProject, setSelectedProject] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  const handleDeleteProject = async (projectId) => {
    try {
      // Open the delete confirmation dialog
      setSelectedProject(projectId);
      setDeleteConfirmationOpen(true);
  
      // Optionally, you can perform additional actions before showing the confirmation dialog
  
    } catch (error) {
      console.error('Error preparing to delete project:', error);
    }
  };

  const handleDeleteConfirmation = async (confirmed) => {
    setDeleteConfirmationOpen(false);
  
    if (confirmed) {
      // User confirmed deletion, proceed with delete
      try {
        const success = await auth.getDeleteProjectAction(selectedProject);
        if (success) {
          console.log('Project deleted');
          // Update the projects state to reflect the deletion
          setProjects((prevProjects) =>
            prevProjects.filter((project) => project.id !== selectedProject)
          );
        } else {
          console.error('Error deleting project');
        }
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
    // Clear the selected project
    setSelectedProject(null);
  };
  

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


  const handleEditProject = async (projectId,project_type) => {

    if (project_type === 'python') {
      navigate(`/monaco-page/${projectId}`);
    }else{
      navigate(`/blockly-page/${projectId}`);
    }
  };


  return (
    <PageContainer>
      <DashboardCard
        title="FOSSBot Projects"
        subtitle="What kind of project will you create today?"
        action={
          <Fab color="success" aria-label="add" onClick={() => setShowDrawer(true)}>
            <FontAwesomeIcon icon={faAdd}/>
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
        <Dialog
          open={deleteConfirmationOpen}
          onClose={() => handleDeleteConfirmation(false)}
          fullWidth
          maxWidth={'xs'}
        >
          <Box p={2}>
            <DeleteBanner
              onDelete={() => handleDeleteConfirmation(true)}
              onCancel={() => handleDeleteConfirmation(false)}
            />
            {/* <Typography variant="h6" align='center'>Are you sure you want to delete this project?</Typography>
            <Stack direction="row" spacing={2} justifyContent="space-between" mt={2}>
              <Fab color="default" size="small" onClick={() => handleDeleteConfirmation(true)}>
                Yes
              </Fab>
              <Fab color="default" size="small" onClick={() => handleDeleteConfirmation(false)}>
                No
              </Fab>
            </Stack> */}
          </Box>
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
                    Type
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Title
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Description
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
            
            {projects.length === 0 ? (
              <TableRow> 
              <TableCell><Typography>No projects found</Typography></TableCell>
              
              </TableRow>
            ) : (
              projects.map(project => (
             
                <TableRow key={project.id}>                    
                <TableCell align="center" >
                {project.project_type === 'python' ?
                <Typography color="primary" >
                <IconCode/> 
                </Typography>
                :
                <Typography color="secondary">
                <IconPuzzle /> 
                </Typography>}
                </TableCell>
                <TableCell>
                <Typography >{project.name}</Typography>
                </TableCell>
                <TableCell>
                <Typography >{project.description}</Typography>
                </TableCell>
                {/* <TableCell align="center">
                    <Fab color="primary" size="small" aria-label="download">
                      <FontAwesomeIcon icon={faDownload} />
                    </Fab>
                  </TableCell> */}
                  <TableCell align="center">
                    <Fab color="primary" size="small" aria-label="pencil"  onClick={() => handleEditProject(project.id,project.project_type)}>
                      <FontAwesomeIcon icon={faPencil}/>
                    </Fab>
                  </TableCell>
                  <TableCell align="center">
                    <Fab color="error" size="small" aria-label="trash" onClick={() => handleDeleteProject(project.id)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </Fab>
                  </TableCell>                
              </TableRow>

            )))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      </DashboardCard>
    </PageContainer>
  );
};

export default ProjectsCard;
