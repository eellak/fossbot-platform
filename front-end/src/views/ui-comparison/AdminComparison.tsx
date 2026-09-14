import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconArrowLeft, IconPalette, IconRefresh } from '@tabler/icons-react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';
import { useDispatch, useSelector } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';

type Variant = 'current' | 'proposed';
type View = 'both' | 'current' | 'proposed';

function Preview({ variant, width, mode, revision }: {
  variant: Variant; width: number; mode: string; revision: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  const title = variant === 'current' ? 'Current' : 'Proposed';
  const detail = variant === 'current' ? 'Production composition' : 'Canonical browsing composition';

  return <Box component="section" sx={{ minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }} gap={2}>
      <Typography component="h2" variant="h5">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{detail} · {width}px · {Math.round(scale * 100)}%</Typography>
    </Stack>
    <Box ref={host} sx={{ width: '100%', height: 1100 * scale, overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <iframe
        key={`${mode}-${revision}`}
        title={`${title} admin panel preview`}
        src={`/ui-comparison/admin/${variant}?mode=${mode}`}
        onLoad={(event) => event.currentTarget.contentWindow?.postMessage({ type: 'ui-comparison-mode', mode }, '*')}
        style={{ display: 'block', border: 0, width, height: 1100, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </Box>
  </Box>;
}

const changes = [
  'One PageHeader replaces the loose title, description, and right-aligned action row.',
  'Search and role/access filters sit between the header and the collection.',
  'One outlined table surface replaces the padded card wrapped around a second page container.',
  'Username, full name, email, and sign-in provider merge into one readable identity column.',
  'Rows are left aligned with quiet dividers, chips for status, and labelled switches for flags.',
  'Delete is an icon action with a confirmation dialog; every change updates in place instead of reloading the page.',
];

export default function AdminComparison() {
  const [view, setView] = useState<View>('both');
  const [width, setWidth] = useState(1440);
  const [revision, setRevision] = useState(0);
  const dispatch = useDispatch();
  const auth = useAuth();
  const mode = useSelector((state) => (state.customizer.activeMode === 'dark' ? 'dark' : 'light'));

  if (auth.user?.role !== UserRole.ADMIN) return <Navigate to="/dashboard" replace />;

  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 3 } }}>
    <Helmet><title>Admin panel visual comparison</title></Helmet>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
      <Button component={Link} to="/admin-panel" startIcon={<IconArrowLeft size={18} />}>Back to Admin panel</Button>
      <Button component={Link} to="/ui-comparison" variant="outlined" startIcon={<IconPalette size={18} />}>Visual language board</Button>
    </Stack>
    <Typography component="h1" variant="h3">Admin panel visual comparison</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 2, maxWidth: 880 }}>
      The same users API, roles, flags, access control, and marketplace roles in both panels. The proposed panel follows the approved browsing-page composition without changing any capability. Previews are interactive; changes affect your account.
    </Typography>
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
      <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, value) => value && setView(value)} aria-label="Comparison view">
        <ToggleButton value="both">Side by side</ToggleButton>
        <ToggleButton value="current">Current</ToggleButton>
        <ToggleButton value="proposed">Proposed</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={width} onChange={(_, value) => value && setWidth(value)} aria-label="Preview width">
        <ToggleButton value={1024}>1024px</ToggleButton>
        <ToggleButton value={1440}>1440px</ToggleButton>
        <ToggleButton value={1680}>1680px</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, value) => value && dispatch(setDarkMode(value))} aria-label="Preview color mode">
        <ToggleButton value="light">Light</ToggleButton>
        <ToggleButton value="dark">Dark</ToggleButton>
      </ToggleButtonGroup>
      <Button variant="outlined" startIcon={<IconRefresh size={18} />} onClick={() => setRevision((value) => value + 1)}>Reload both</Button>
    </Stack>
    <Box component="section" sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1, maxWidth: 880 }}>
      <Typography component="h2" variant="h6" fontWeight={600} sx={{ mb: 1 }}>What the proposal changes</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.5 }}>
        {changes.map((change) => <Typography component="li" key={change} variant="body2" color="text.secondary">{change}</Typography>)}
      </Box>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: view === 'both' ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 3 }}>
      {view !== 'proposed' && <Preview variant="current" width={width} mode={mode} revision={revision} />}
      {view !== 'current' && <Preview variant="proposed" width={width} mode={mode} revision={revision} />}
    </Box>
  </Box>;
}
