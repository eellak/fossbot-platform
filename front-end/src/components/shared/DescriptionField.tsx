import React from 'react';
import { Box, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { clampWords, countWords, DESCRIPTION_MAX_WORDS } from 'src/utils/descriptionLimits';

export type DescriptionFieldProps = TextFieldProps & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * TextField for authoring a project, course, or stage description. Input is
 * hard-capped at `DESCRIPTION_MAX_WORDS` words and the field shows a live
 * counter next to any validation message.
 */
export function DescriptionField({ value, onValueChange, helperText, error, ...props }: DescriptionFieldProps) {
  const { t } = useTranslation();
  const words = countWords(value);
  const overLimit = words > DESCRIPTION_MAX_WORDS;
  const counter = t('descriptionWordCount', { count: words, max: DESCRIPTION_MAX_WORDS });

  return (
    <TextField
      {...props}
      error={error}
      value={value}
      onChange={(event) => onValueChange(clampWords(event.target.value))}
      helperText={(
        <>
          {helperText}
          <Box component="span" sx={{ display: 'block', color: overLimit ? 'error.main' : 'inherit' }}>{counter}</Box>
        </>
      )}
    />
  );
}

export default DescriptionField;
