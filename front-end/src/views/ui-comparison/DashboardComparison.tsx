import React, { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useDispatch, useSelector } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';

type Variant = 'current' | 'proposed';
type View = 'both' | 'current' | 'proposed';
type Surface = 'dashboard' | 'courses' | 'course-workspace' | 'python' | 'blockly' | 'components';
const surfaceLabels: Record<Surface, string> = { dashboard: 'dashboard', courses: 'courses', 'course-workspace': 'course lesson workspace', python: 'Python editor', blockly: 'Blockly editor', components: 'component' };

function Preview({ variant, surface, width, mode, revision }: {
  variant: Variant; surface: Surface; width: number; mode: string; revision: number;
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
  const detail = variant === 'current' ? 'baseline' : 'flatter + stronger blue';
  const surfacePath = surface === 'dashboard' ? '' : `/${surface}`;
  return <Box component="section" sx={{ minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
      <Typography component="h2" variant="h5">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{detail} · {width}px · {Math.round(scale * 100)}%</Typography>
    </Stack>
    <div ref={host} style={{ width: '100%', height: 1100 * scale, overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <iframe
        key={`${mode}-${revision}`}
        title={`${title} ${surface} preview`}
        src={`/ui-comparison/${variant}${surfacePath}?mode=${mode}`}
        onLoad={(event) => event.currentTarget.contentWindow?.postMessage({ type: 'ui-comparison-mode', mode }, '*')}
        style={{ display: 'block', border: 0, width, height: 1100, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  </Box>;
}

export default function DashboardComparison() {
  const [surface, setSurface] = useState<Surface>('dashboard');
  const [view, setView] = useState<View>('both');
  const [width, setWidth] = useState(1440);
  const [revision, setRevision] = useState(0);
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.customizer.activeMode === 'dark' ? 'dark' : 'light');
  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, md: 3 } }}>
    <Helmet><title>Dashboard visual comparison</title></Helmet>
    <Button component={Link} to="/dashboard" startIcon={<IconArrowLeft size={18} />} sx={{ mb: 2 }}>Back to Dashboard</Button>
    <Typography component="h1" variant="h3">FOSSBot visual language</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>Compare the same interface and component states before changing production styling.</Typography>
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
      <ToggleButtonGroup size="small" exclusive value={surface} onChange={(_, value) => value && setSurface(value)} aria-label="Comparison surface">
        <ToggleButton value="dashboard">Dashboard</ToggleButton>
        <ToggleButton value="courses">Courses</ToggleButton>
        <ToggleButton value="course-workspace">Course lesson</ToggleButton>
        <ToggleButton value="python">Python</ToggleButton>
        <ToggleButton value="blockly">Blockly</ToggleButton>
        <ToggleButton value="components">Components</ToggleButton>
      </ToggleButtonGroup>
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
        <ToggleButton value="light">Light</ToggleButton><ToggleButton value="dark">Dark</ToggleButton>
      </ToggleButtonGroup>
      <Button variant="outlined" startIcon={<IconRefresh size={18} />} onClick={() => setRevision((value) => value + 1)}>Reload both</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {surface === 'components'
        ? 'The specimen uses the same real components in both themes. Controls are interactive, but specimen changes are temporary.'
        : `Proposed uses flatter surfaces, a stronger blue accent, and clearer ${surfaceLabels[surface]} hierarchy. Previews are interactive; changes affect your account.`}
    </Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: view === 'both' ? { xs: '1fr', md: '1fr 1fr' } : '1fr', gap: 3 }}>
      {view !== 'proposed' && <Preview variant="current" surface={surface} width={width} mode={mode} revision={revision} />}
      {view !== 'current' && <Preview variant="proposed" surface={surface} width={width} mode={mode} revision={revision} />}
    </Box>
  </Box>;
}
