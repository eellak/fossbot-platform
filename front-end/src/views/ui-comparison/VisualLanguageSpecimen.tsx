import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { IconDeviceFloppy, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import PageContainer from 'src/components/container/PageContainer';

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography component="h2" variant="h5" sx={{ mb: 2 }}>{children}</Typography>
);

export default function VisualLanguageSpecimen() {
  return <PageContainer title="Visual language components" description="Development-only component comparison">
    <Box sx={{ py: 3 }}>
      <Typography component="h1" variant="h3">Visual language</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: '72ch' }}>
        Compare the same controls, surfaces, and states before applying the proposed theme across FOSSBot.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 3, mt: 3 }}>
        <Box component="section">
          <SectionTitle>Typography</SectionTitle>
          <Stack spacing={1}>
            <Typography variant="h3">Page title · 24px semibold</Typography>
            <Typography variant="h5">Section title · 18px semibold</Typography>
            <Typography variant="body1">Reading text supports explanations and lesson instructions without feeling oversized.</Typography>
            <Typography variant="body1">Ελληνικό κείμενο για έλεγχο γραμματοσειράς και αναγνωσιμότητας.</Typography>
            <Typography variant="caption" color="text.secondary">Secondary metadata · Saved a minute ago</Typography>
          </Stack>
        </Box>

        <Box component="section">
          <SectionTitle>Surfaces</SectionTitle>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h5">Content surface</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>A standalone card uses one quiet boundary and no shadow.</Typography>
              </CardContent>
            </Card>
            <Box className="visual-language-supporting-panel" sx={{ p: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
              <Typography variant="subtitle2" fontWeight={600}>Supporting panel</Typography>
              <Typography variant="body2" color="text.secondary">Toolbars and secondary regions use a subtle surface change.</Typography>
            </Box>
          </Stack>
        </Box>

        <Box component="section">
          <SectionTitle>Actions</SectionTitle>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Button variant="contained" startIcon={<IconDeviceFloppy size={20} />}>Save</Button>
            <Button variant="outlined" startIcon={<IconPlayerPlay size={20} />}>Run</Button>
            <Button variant="text">Cancel</Button>
            <Button variant="outlined" color="error" startIcon={<IconTrash size={20} />}>Delete</Button>
            <IconButton aria-label="Delete project" color="error"><IconTrash size={20} /></IconButton>
            <Button disabled>Disabled</Button>
            <Button disabled startIcon={<CircularProgress size={16} color="inherit" />}>Saving</Button>
          </Stack>
        </Box>

        <Box component="section">
          <SectionTitle>Inputs and selection</SectionTitle>
          <Stack spacing={2}>
            <TextField size="small" label="Project name" defaultValue="Line follower" helperText="Use a short, recognizable name." />
            <TextField size="small" error label="Robot address" defaultValue="192.168" helperText="Enter a complete network address." />
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
              <ToggleButtonGroup size="small" exclusive value="simulator" aria-label="Execution target">
                <ToggleButton value="simulator">Simulator</ToggleButton>
                <ToggleButton value="robot">Robot</ToggleButton>
              </ToggleButtonGroup>
              <FormControlLabel control={<Switch defaultChecked />} label="Show hints" />
            </Stack>
          </Stack>
        </Box>

        <Box component="section" sx={{ gridColumn: { lg: '1 / -1' } }}>
          <SectionTitle>Status and feedback</SectionTitle>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip size="small" color="primary" label="Selected" />
            <Chip size="small" color="success" label="Saved" />
            <Chip size="small" color="warning" label="Needs review" />
            <Chip size="small" color="error" label="Connection lost" />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
            <Alert severity="success">Project saved successfully.</Alert>
            <Alert severity="info">Simulator is the current execution target.</Alert>
            <Alert severity="warning">Connect a robot before running on hardware.</Alert>
            <Alert severity="error">Connection failed. Check the address and try again.</Alert>
          </Box>
        </Box>
      </Box>
    </Box>
  </PageContainer>;
}
