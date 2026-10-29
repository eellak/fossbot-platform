import React, { useRef, useState } from 'react';
import { Box, Link } from '@mui/material';
import { useAuth } from 'src/authentication/AuthProvider';
import { localStageRepository } from 'src/components/stage-builder/localStages';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import { deleteLocalStage, LocalStageRequestError } from './LocalStagesApi';
import { invalidateLocalStages } from './stageListCache';

type DeleteStageTarget = { id: number; title: string; source: 'account' } | { id: string; title: string; source: 'browser' };

export function useDeleteStage() {
  const { token } = useAuth();
  const { confirm, alert } = useConfirmDialog();
  const { notify } = useNotifications();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const deleteStage = async (stage: DeleteStageTarget): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      const confirmed = await confirm({
        title: 'Delete stage?',
        message: `Delete “${stage.title}” permanently? This cannot be undone.`,
        confirmLabel: 'Delete stage',
        cancelLabel: 'Cancel',
        danger: true,
      });
      if (!confirmed) return false;
      if (stage.source === 'browser') {
        localStageRepository.delete(stage.id, 'guest');
      } else {
        if (!token) throw new Error('Sign in before deleting a stage.');
        await deleteLocalStage(token, stage.id);
        invalidateLocalStages();
      }
      notify('Stage deleted.', { severity: 'success' });
      return true;
    } catch (error) {
      if (error instanceof LocalStageRequestError && error.code === 'stage_is_referenced' && error.references) {
        await alert({
          title: 'Stage is still in use',
          confirmLabel: 'Close',
          message: <>
            {error.message}
            {error.references.lessons.map((lesson) => lesson.archived
              ? <Box component="span" key={`lesson:${lesson.id}`} sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{lesson.courseTitle} — {lesson.title} (archived). Contact the course author to remove this reference.</Box>
              : <Link key={`lesson:${lesson.id}`} href={`/teach/courses/${lesson.courseId}?lesson=${lesson.id}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{lesson.courseTitle} — {lesson.title} (opens in a new tab)</Link>)}
            {error.references.projects.map((project) => <Link key={`project:${project.id}`} href={`/${project.projectType === 'python' ? 'monaco-page' : 'blockly-page'}/${project.id}`} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>Project: {project.title} (opens in a new tab)</Link>)}
            {error.otherReferenceCount > 0 && <><br />Other references belong to another user. Ask their author or an administrator to remove them.</>}
          </>,
        });
        return false;
      }
      notify(error instanceof Error ? error.message : 'Could not delete this stage. Try again.', { severity: 'error' });
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { deleteStage, busy };
}
