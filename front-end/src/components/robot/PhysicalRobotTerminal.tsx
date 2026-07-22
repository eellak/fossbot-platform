import React, { useEffect, useRef } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useRobotConnection } from 'src/robot/RobotConnectionContext';

const PhysicalRobotTerminal: React.FC = () => {
  const { terminalLines, clearTerminal, programState } = useRobotConnection();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [terminalLines]);

  return (
    <Stack sx={{ height: 'calc(100% - 38px)', minHeight: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Chip
          size="small"
          color={programState === 'running' ? 'warning' : 'default'}
          label={programState}
        />
        <Button size="small" color="inherit" onClick={clearTerminal}>
          Clear
        </Button>
      </Stack>

      <Box
        role="log"
        aria-live="polite"
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
      >
        {terminalLines.length === 0 ? (
          <Typography component="div" sx={{ color: '#8b949e', fontFamily: 'inherit' }}>
            Physical robot stdout and stderr will appear here.
          </Typography>
        ) : (
          terminalLines.map((line) => (
            <Box
              component="div"
              key={line.id}
              sx={{
                color: line.stream === 'stderr' ? '#ff7b72' : '#f0f6fc',
                fontFamily: 'inherit',
                lineHeight: 1.55,
              }}
            >
              {line.text}
            </Box>
          ))
        )}
        <div ref={endRef} />
      </Box>
    </Stack>
  );
};

export default PhysicalRobotTerminal;
