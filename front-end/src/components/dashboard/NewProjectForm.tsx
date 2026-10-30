import React, { useState } from 'react';
import Breadcrumb from 'src/layouts/full/shared/breadcrumb/Breadcrumb';
import PageContainer from 'src/components/container/PageContainer';
import ParentCard from 'src/components/shared/ParentCard';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CustomOutlinedInput from 'src/components/forms/theme-elements/CustomOutlinedInput';
import CustomFormLabel from 'src/components/forms/theme-elements/CustomFormLabel';
import DescriptionField from 'src/components/shared/DescriptionField';

import { Grid, InputAdornment, Button } from '@mui/material';
import {
  IconFileDescription,
  IconSourceCode,
  IconFileTypography,
} from '@tabler/icons-react';
import { useAuth } from 'src/authentication/AuthProvider';
import type { ProjectStageReference, SharedProjectSave } from 'src/authentication/AuthInterfaces';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import { guestProjectRepository } from 'src/guest/guestProjects';
import { guestCanView } from 'src/authentication/guest';

interface NewProjectFormProps {
  isDescriptionDisabled: boolean,
  editorInitialValue: string,
  code: string,
  stageReference?: ProjectStageReference | null,
  sharedSave?: SharedProjectSave,
}

const NewProjectForm = ({ isDescriptionDisabled, editorInitialValue, code, stageReference, sharedSave }: NewProjectFormProps) => {
  const { t } = useTranslation();
  const auth = useAuth();
  const canPython = !auth.isGuest || guestCanView(auth.guestSettings, 'python');
  const canBlockly = !auth.isGuest || guestCanView(auth.guestSettings, 'blockly');
  const [selectedOption, setSelectedOption] = useState(
    isDescriptionDisabled || (editorInitialValue === 'python' && canPython) || (editorInitialValue === 'blockly' && canBlockly)
      ? editorInitialValue : canPython ? 'python' : canBlockly ? 'blockly' : '',
  );
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectNameError, setProjectNameError] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();

  const handleProjectNameChange = (event: any) => {
    setProjectName(event.target.value);
    if (event.target.value.trim() !== '') {
      setProjectNameError(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (value.trim() !== '') {
      setDescriptionError(false);
    }
  };

  const handleEditorChange = (event: any) => {
    setSelectedOption(event.target.value);
    if (event.target.value.trim() !== '') {
      setEditorError(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if ((selectedOption === 'python' && !canPython) || (selectedOption === 'blockly' && !canBlockly)) return;

    // Check for empty fields and set errors
    setProjectNameError(projectName.trim() === '');
    setDescriptionError(description.trim() === '');
    setEditorError(selectedOption.trim() === '');

    setSaving(true);
    try {
      if (projectName.trim() !== '' && description.trim() !== '' && selectedOption !== '') {
        const prepared = sharedSave ? await sharedSave.prepare() : { stageReference: stageReference || null };
        if (!prepared) return;
        const projectID = await auth.createProjectAction({
          name: projectName,
          description: description,
          project_type: selectedOption,
          code: code,
          stageReference: prepared.stageReference,
        });
        if (!projectID) {
          notify(t(auth.isGuest ? 'guest.storageError' : 'projectSharing.saveError'), { severity: 'error' });
          return;
        }
        if (auth.isGuest && !sharedSave) {
          try { guestProjectRepository.clearDraft(selectedOption as 'python' | 'blockly'); } catch { /* Draft cleanup must not block opening the saved project. */ }
        }

        sharedSave?.onCreated(projectID);
        const monacoPageUrl = `/monaco-page/${projectID}`;
        const blocklyPageUrl = `/blockly-page/${projectID}`;

        if (selectedOption === 'python') {
          if (location.pathname === `/monaco-page` || location.pathname === monacoPageUrl) {
            window.location.href = monacoPageUrl;
          } else {
            navigate(monacoPageUrl);
          }
        } else {
          if (location.pathname === `/blockly-page` || location.pathname === blocklyPageUrl) {
            console.log('save after creation')
            window.location.href = blocklyPageUrl;
          } else {
            navigate(blocklyPageUrl);
          }
        }
      }
    } catch (error) {
      notify(t('projectSharing.saveError'), { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title={t('project-form.title')} description={t('project-form.description')}>
      {/* breadcrumb */}
      <Breadcrumb title={t('project-form.createNewProject')} />
      {/* end breadcrumb */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ParentCard title={t('project-form.newProjectForm')}>
            <Grid container spacing={3}>
              {/* 2 */}
              <Grid item xs={12} sm={3} display="flex" alignItems="center">
                <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                  {t('projectName')}*
                </CustomFormLabel>
              </Grid>
              <Grid item xs={12} sm={9}>
                <CustomOutlinedInput
                  startAdornment={
                    <InputAdornment position="start">
                      <IconFileTypography size="20" />
                    </InputAdornment>
                  }
                  placeholder={t('project-form.giveYourProjectAName')}
                  fullWidth
                  onChange={handleProjectNameChange}
                  error={projectNameError}
                />
              </Grid>
              {/* 3 */}
              <Grid item xs={12} sm={3} display="flex" alignItems="center">
                <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                  {t('description')}*
                </CustomFormLabel>
              </Grid>
              <Grid item xs={12} sm={9}>
                <DescriptionField
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconFileDescription size="20" />
                      </InputAdornment>
                    ),
                  }}
                  placeholder={t('project-form.describeYourProject')}
                  fullWidth
                  error={descriptionError}
                  value={description}
                  onValueChange={handleDescriptionChange}
                />
              </Grid>
              {/* 4 */}
              <Grid item xs={12} sm={3} display="flex" alignItems="center">
                <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                  {t('editor')}*
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
                  disabled={isDescriptionDisabled || Boolean(sharedSave)}
                  error={editorError}
                >
                  <MenuItem value={'python'} disabled={!canPython}>{t('monaco')}</MenuItem>
                  <MenuItem value={'blockly'} disabled={!canBlockly}>{t('blockly')}</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} sm={3}></Grid>
              <Grid item xs={12} sm={9}>
                <Button variant="contained" color="primary" onClick={handleSubmit} disabled={saving || !selectedOption || (selectedOption === 'python' ? !canPython : !canBlockly)}>
                  {t('submit')}
                </Button>
              </Grid>
            </Grid>
          </ParentCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default NewProjectForm;
