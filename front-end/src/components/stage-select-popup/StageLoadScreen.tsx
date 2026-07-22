import { Box, Stack, Typography } from '@mui/material';
import { SpinnerMark } from 'src/views/spinner/Spinner';

const STAGE_LOAD_STEPS = [
  'Checking stage access...',
  'Loading stage.json...',
  'Preparing simulator...',
];

type StageLoadScreenProps = {
  stageLabel?: string | null;
  activeStep?: string;
};

const StageLoadScreen = ({
  stageLabel,
  activeStep = 'Loading stage.json...',
}: StageLoadScreenProps) => (
  <Box
    sx={{
      width: '100%',
      minHeight: '50vh',
      display: 'grid',
      placeItems: 'center',
      p: 3,
    }}
  >
    <Stack
      spacing={2.25}
      sx={{
        width: 'min(520px, 100%)',
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <SpinnerMark compact />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={850}>
            Opening project stage
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {stageLabel || 'Saved stage'}
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1}>
        {STAGE_LOAD_STEPS.map((step) => {
          const active = step === activeStep;
          return (
            <Stack key={step} direction="row" spacing={1} alignItems="center" color={active ? 'text.primary' : 'text.secondary'}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: active ? 'primary.main' : 'divider',
                }}
              />
              <Typography variant="body2" fontWeight={active ? 800 : 500}>
                {step}
              </Typography>
            </Stack>
          );
        })}
        <Typography variant="caption" color="text.secondary">
          Private stages load through FOSSBot first so the simulator opens with the saved stage.
        </Typography>
      </Stack>
    </Stack>
  </Box>
);

export default StageLoadScreen;
