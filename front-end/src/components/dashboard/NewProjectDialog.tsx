import React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import NewProjectForm from './NewProjectForm';

interface NewProjectDialogProps {
  showDrawer: boolean,
  handleDrawerClose: () => void,
  isDescriptionDisabled: boolean,
  editorInitialValue: string,
  code: string
}

const NewProjectDialog = ({ showDrawer, handleDrawerClose, isDescriptionDisabled, editorInitialValue, code }: NewProjectDialogProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <Dialog
        open={showDrawer}
        onClose={handleDrawerClose}
        fullWidth
        maxWidth={'sm'}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{ sx: { position: 'fixed', top: 30, m: 0 } }}
      >
        <NewProjectForm
          isDescriptionDisabled={isDescriptionDisabled}
          editorInitialValue={editorInitialValue}
          code={code} />
      </Dialog>
    </div>
  );
};

export default NewProjectDialog;
