import React, { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import VideocamIcon from '@mui/icons-material/Videocam';
import type { StageBuilderCameraView } from './StageBuilderScene';
import { editorColors } from './stageBuilderEditorTheme';

export interface EditorViewportCameraGizmoProps {
  currentView: StageBuilderCameraView;
  onCameraViewChange: (view: StageBuilderCameraView) => void;
}

const cameraViewLabels: Record<StageBuilderCameraView, string> = {
  perspective: 'Perspective',
  top: 'Top',
  bottom: 'Bottom',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
};

const cameraViewOptions: StageBuilderCameraView[] = ['perspective', 'top', 'bottom', 'front', 'back', 'left', 'right'];

export function EditorViewportCameraGizmo({ currentView, onCameraViewChange }: EditorViewportCameraGizmoProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  const selectView = (view: StageBuilderCameraView) => {
    onCameraViewChange(view);
    setOpen(false);
  };

  return (
    <Box ref={rootRef} sx={{ width: 170 }}>
      <Paper elevation={0} sx={{ overflow: 'hidden', bgcolor: 'rgba(11, 18, 36, 0.76)', color: editorColors.text, border: `1px solid ${editorColors.border}`, borderRadius: 0.75, boxShadow: 'none', backdropFilter: 'blur(10px)' }}>
        <ButtonBase
          onClick={() => setOpen((value) => !value)}
          sx={{
            width: '100%',
            height: 36,
            px: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: editorColors.textStrong,
            textAlign: 'left',
            '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.09)' },
            '&:focus-visible': { outline: `2px solid ${editorColors.accent}`, outlineOffset: -2 },
          }}
          aria-label="Open camera view options"
          aria-expanded={open}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <VideocamIcon sx={{ fontSize: 20, color: editorColors.textStrong, flexShrink: 0 }} />
            <Typography variant="body2" noWrap sx={{ color: editorColors.textStrong, fontWeight: 800 }}>{cameraViewLabels[currentView]}</Typography>
          </Stack>
          <KeyboardArrowDownIcon sx={{ fontSize: 18, color: editorColors.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
        </ButtonBase>
        {open && (
          <Box sx={{ px: 1, pb: 1, pt: 0.75, bgcolor: 'rgba(18, 31, 40, 0.82)' }}>
            <Stack spacing={0.25}>
              {cameraViewOptions.map((view) => {
                const selected = currentView === view;
                return (
                  <ButtonBase
                    key={view}
                    onClick={() => selectView(view)}
                    sx={{
                      width: '100%',
                      minHeight: 30,
                      px: 0.25,
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: selected ? editorColors.textStrong : editorColors.textMuted,
                      justifyContent: 'flex-start',
                      '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.08)', color: editorColors.textStrong },
                    }}
                  >
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? editorColors.textStrong : 'rgba(148, 163, 184, 0.15)'}`, bgcolor: selected ? 'rgba(226, 232, 240, 0.1)' : 'rgba(148, 163, 184, 0.04)', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'inherit', fontWeight: selected ? 800 : 700 }}>{cameraViewLabels[view]}</Typography>
                  </ButtonBase>
                );
              })}
              <ButtonBase disabled sx={{ width: '100%', minHeight: 30, px: 0.25, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start', color: editorColors.textSubtle, opacity: 0.42 }}>
                <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'rgba(148, 163, 184, 0.1)', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 700 }}>Camera</Typography>
              </ButtonBase>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
