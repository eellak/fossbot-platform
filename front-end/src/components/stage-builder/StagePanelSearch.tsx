import React, { useRef } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useEditorTheme } from './stageBuilderEditorTheme';

export function StagePanelSearch({ label, placeholder, query, onChange }: {
  label: string;
  placeholder: string;
  query: string;
  onChange: (value: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { colors } = useEditorTheme();
  return (
    <TextField
      fullWidth
      size="small"
      value={query}
      inputRef={searchInputRef}
      placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onChange(''); } }}
      inputProps={{ 'aria-label': label }}
      InputProps={{
        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: colors.textMuted }} /></InputAdornment>,
        endAdornment: query ? <InputAdornment position="end"><IconButton aria-label="Clear search" onClick={() => { onChange(''); searchInputRef.current?.focus(); }} edge="end" sx={{ width: 44, height: 44 }}><CloseIcon fontSize="small" /></IconButton></InputAdornment> : undefined,
      }}
      sx={{
        '& .MuiInputBase-root': { minHeight: 44, bgcolor: colors.panel },
        '& input': { minWidth: 0, pl: 0.5, pr: 1 },
        '& input::placeholder': { color: colors.textMuted, opacity: 1 },
        '@container (max-width: 255px)': {
          '& .MuiInputAdornment-positionStart': { display: 'none' },
          '& .MuiInputBase-root': { pl: 1 },
        },
      }}
    />
  );
}
