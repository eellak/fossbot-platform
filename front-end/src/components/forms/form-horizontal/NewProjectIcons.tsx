import React, { useState } from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';

import { Grid, InputAdornment, Button } from '@mui/material';
import {
  IconFileDescription,
  IconSourceCode,
  IconUser,
  IconFileTypography,
} from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NewProjectIcons = () => {
  const { t } = useTranslation();

  const [selectedOption, setSelectedOption] = useState('Monaco');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleProjectNameChange = (event: any) => {
    setProjectName(event.target.value);
  };
  const handleDescriptionChange = (event: any) => {
    setDescription(event.target.value);
  };
  const handleEditorChange = (event: any) => {
    setSelectedOption(event.target.value);
  };

  // const handleChange = (event: any) => {
  //   setSelectedOption(event.target.value);
  // };

  const auth = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      // Call the login function
      if (projectName !== '' && description !== '' && selectedOption !== '') {
        const projectID = await auth.createProjectAction({
          name: projectName,
          description: description,
          project_type: selectedOption,
          code: '',
        });
        if (selectedOption === 'python') {
          navigate('/monaco-page/' + projectID);
        } else {
          navigate('/blockly-page/' + projectID);
        }
      }
    } catch (error) {
      // Handle errors (e.g., show an error message to the user)
      console.error('Login error:', error);
    }
  };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Grid container spacing={3}>
        {/* 2 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('projectName')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconFileTypography size="20" />
              </InputAdornment>
            }
            placeholder="Give your project a name"
            fullWidth
            onChange={handleProjectNameChange}
          />
        </Grid>
        {/* 3 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('description')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconFileDescription size="20" />
              </InputAdornment>
            }
            placeholder="Describe your project"
            fullWidth
            onChange={handleDescriptionChange}
          />
        </Grid>
        {/* 4 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            {t('editor')}
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <Select
            startAdornment={
              <InputAdornment position="start">
                <IconSourceCode size="20" />
              </InputAdornment>
            }
            fullWidth
            value={selectedOption}
            onChange={handleEditorChange}
          >
            <MenuItem value={'python'}>{t('monaco')}</MenuItem>
            <MenuItem value={'blockly'}>{t('blockly')}</MenuItem>
          </Select>
        </Grid>
        <Grid item xs={12} sm={3}></Grid>
        <Grid item xs={12} sm={9}>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            {t('submit')}
          </Button>
        </Grid>
      </Grid>
    </div>
  );
};

export default NewProjectIcons;
