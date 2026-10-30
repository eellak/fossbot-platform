import React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function SharedProjectNotice({ fallback, failed, retry, useDefault }: { fallback: boolean; failed: boolean; retry: () => void; useDefault: () => void }) {
  const { t } = useTranslation();
  return <Stack spacing={1}>
    <Alert severity="info">{t('projectSharing.receivedCopy')}</Alert>
    {fallback && <Alert severity="warning">{t('projectSharing.stageWarning')}</Alert>}
    {failed && <Alert severity="warning" action={<Stack direction="row" spacing={1}>
      <Button color="inherit" onClick={retry}>{t('projectSharing.retry')}</Button>
      <Button color="inherit" onClick={useDefault}>{t('projectSharing.useDefault')}</Button>
    </Stack>}>{t('projectSharing.stageUnavailable')}</Alert>}
  </Stack>;
}
