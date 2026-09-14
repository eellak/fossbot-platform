import React, { useState } from 'react';
import { Box, IconButton, Stack, Tooltip } from '@mui/material';
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconCamera,
  IconChevronDown,
  IconDeviceGamepad2,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

type SimulatorControlsOverlayProps = {
  onForward: () => void;
  onBackward: () => void;
  onTurnLeft: () => void;
  onTurnRight: () => void;
  onChangeCamera: () => void;
};

const controlButtonSx = {
  width: 44,
  height: 44,
  border: '1px solid',
  borderRadius: 1,
  color: 'text.primary',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  '&:hover': { color: 'primary.main', borderColor: 'primary.main', bgcolor: 'primary.light' },
  '&:active': { bgcolor: 'action.selected' },
} as const;

const overlaySurfaceSx = {
  position: 'absolute',
  right: 12,
  bottom: 12,
  zIndex: 2,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 3,
} as const;

const tooltipDelay = {
  enterDelay: 650,
  enterNextDelay: 350,
} as const;

const SimulatorControlsOverlay: React.FC<SimulatorControlsOverlayProps> = ({
  onForward,
  onBackward,
  onTurnLeft,
  onTurnRight,
  onChangeCamera,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const directions = [
    { label: t('simulatorControls.moveForward'), icon: <IconArrowUp size={22} />, action: onForward, column: 2, row: 1 },
    { label: t('simulatorControls.turnLeft'), icon: <IconArrowLeft size={22} />, action: onTurnLeft, column: 1, row: 2 },
    { label: t('simulatorControls.moveBackward'), icon: <IconArrowDown size={22} />, action: onBackward, column: 2, row: 2 },
    { label: t('simulatorControls.turnRight'), icon: <IconArrowRight size={22} />, action: onTurnRight, column: 3, row: 2 },
  ];

  if (!expanded) {
    return (
      <Tooltip title={t('simulatorControls.show')} {...tooltipDelay}>
        <IconButton
          aria-label={t('simulatorControls.show')}
          onClick={() => setExpanded(true)}
          className="visual-language-supporting-panel"
          sx={{ ...controlButtonSx, ...overlaySurfaceSx }}
        >
          <IconDeviceGamepad2 size={22} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box
      role="group"
      aria-label={t('simulatorControls.label')}
      className="visual-language-supporting-panel"
      sx={{ ...overlaySurfaceSx, display: 'flex', alignItems: 'flex-end', gap: 1, p: 1 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 44px)',
          gridTemplateRows: 'repeat(2, 44px)',
          gap: 0.75,
        }}
      >
        {directions.map((control) => (
          <Tooltip title={control.label} key={control.label} {...tooltipDelay}>
            <IconButton
              aria-label={control.label}
              sx={{ ...controlButtonSx, gridColumn: control.column, gridRow: control.row }}
              onClick={control.action}
            >
              {control.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>
      <Stack spacing={0.75}>
        <Tooltip title={t('education.workspace.changeCamera')} placement="left" {...tooltipDelay}>
          <IconButton aria-label={t('education.workspace.changeCamera')} sx={controlButtonSx} onClick={onChangeCamera}>
            <IconCamera size={22} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('simulatorControls.hide')} placement="left" {...tooltipDelay}>
          <IconButton aria-label={t('simulatorControls.hide')} sx={controlButtonSx} onClick={() => setExpanded(false)}>
            <IconChevronDown size={22} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

export default SimulatorControlsOverlay;
