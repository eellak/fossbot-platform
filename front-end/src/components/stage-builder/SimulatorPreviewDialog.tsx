import React, { lazy, Suspense } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { StageJsonEntry } from './types';

const LazyFossbotSimulator = lazy(() =>
  import('src/simulator/FossbotSimulator').then((module) => ({ default: module.FossbotSimulator })),
);

export interface SimulatorPreviewDialogProps {
  open: boolean;
  title: string;
  config: StageJsonEntry[];
  onClose: () => void;
}

export function SimulatorPreviewDialog({ open, title, config, onClose }: SimulatorPreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pr: 6 }}>
        Preview: {title}
        <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ height: '70vh', p: 1 }}>
        <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
          {open && (
            <Suspense fallback={<Box sx={{ p: 2 }}>Loading simulator...</Box>}>
              <LazyFossbotSimulator
                initialStageConfig={config}
                config={{
                  publicAssetBaseUrl: '/simulator',
                  assetBaseUrl: '/simulator/models/robots/v2',
                  splashLogoUrl: '/simulator/images/superlogo.png',
                  splashEnabled: false,
                  telemetryDefault: false,
                  devMode: false,
                }}
                style={{ minHeight: '100%' }}
              />
            </Suspense>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
