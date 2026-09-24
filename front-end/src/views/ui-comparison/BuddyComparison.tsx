import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from '@mui/material';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconPlayerPlay,
  IconRefresh,
  IconRobot,
  IconShieldCheck,
  IconTrash,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { useDispatch, useSelector } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';

type Surface = 'python' | 'blockly' | 'lesson' | 'stage';
type Focus = 'all' | 'ask' | 'working' | 'answer' | 'review';
type BuddyState = Exclude<Focus, 'all'>;

const surfaceLabels: Record<Surface, string> = {
  python: 'Python',
  blockly: 'Blockly',
  lesson: 'Lesson',
  stage: 'Stage Builder',
};

const stateLabels: Record<BuddyState, string> = {
  ask: 'Ask',
  working: 'Working',
  answer: 'Answer',
  review: 'Review',
};

// Shared rhythm for the four state panels, in MUI spacing units (1 unit = 8px) so every value
// stays on the theme scale. The names cover the values more than one panel uses; genuinely local
// values stay inline so shared rhythm reads apart from local spacing.
const panel = {
  inset: 2.5, // 20px — padding shared by panel content and the action area
  headerGap: 2, // 16px — below a panel header
  blockGap: 2.5, // 20px — between stacked blocks in a panel
  actionGap: 1.5, // 12px — between a prompt row and its primary action
  actionStackGap: 1.25, // 10px — between stacked rows inside an action area
};

// Minimum card height in px, shared by every state panel.
const panelMinHeight = 520;

type SurfaceFixture = {
  workingSteps: [string, string, string];
  answerTitle: string;
  answerBody: string;
  suggestionLabel: string;
  suggestionIsCode: boolean;
  suggestion: string[];
  reviewTarget: string;
  removed: string;
  added: string[];
  checks: [string, string];
};

const surfaceFixtures: Record<Surface, SurfaceFixture> = {
  python: {
    workingSteps: ['Reading the current workspace', 'Tracing the last run', 'Preparing an answer'],
    answerTitle: 'Your loop stops too early',
    answerBody: 'The distance check is outside the loop, so it only runs once. Move it inside to keep checking while the robot drives.',
    suggestionLabel: 'Suggested code',
    suggestionIsCode: true,
    suggestion: ['while distance > 20:', '    forward(30)', '    distance = get_distance()'],
    reviewTarget: 'main.py',
    removed: 'forward(80)',
    added: ['while distance > 20:', '  forward(30)', '  distance = get_distance()'],
    checks: ['Valid FOSSBot commands', 'Workspace unchanged'],
  },
  blockly: {
    workingSteps: ['Reading the current blocks', 'Checking generated Python', 'Preparing an answer'],
    answerTitle: 'The sensor is checked only once',
    answerBody: 'Put the distance check inside the repeat block so the robot keeps checking while it moves.',
    suggestionLabel: 'Suggested blocks',
    suggestionIsCode: true,
    suggestion: ['Repeat while distance > 20', '  Move forward at 30%', '  Read distance sensor'],
    reviewTarget: 'Blockly workspace',
    removed: 'Move forward at 80%',
    added: ['Repeat while distance > 20', '  Move forward at 30%', '  Read distance sensor'],
    checks: ['Supported Blockly blocks', 'Workspace unchanged'],
  },
  lesson: {
    workingSteps: ['Reading the selected activity', 'Checking lesson constraints', 'Preparing an answer'],
    answerTitle: 'The prompt gives away the result',
    answerBody: 'Ask learners to predict first. They will have a reason to test the code and explain what they observe.',
    suggestionLabel: 'Learner prompts',
    suggestionIsCode: false,
    suggestion: ['Predict where the robot will stop.', 'Run the code.', 'Explain why the robot stopped there.'],
    reviewTarget: 'Selected activity',
    removed: 'The robot stops at 20 cm. Explain why.',
    added: ['Predict where the robot will stop.', 'Run the code and explain the result.'],
    checks: ['Student-safe wording', 'Draft unchanged'],
  },
  stage: {
    workingSteps: ['Reading the current stage', 'Checking stage geometry', 'Preparing an answer'],
    answerTitle: 'The target sits outside the route',
    answerBody: 'Move the target inside the wall boundary so the robot can reach it without changing the rest of the stage.',
    suggestionLabel: 'Suggested position',
    suggestionIsCode: true,
    suggestion: ['Move selected target', 'x 8.0 · y 7.0', 'Keep all walls unchanged'],
    reviewTarget: 'Selected target',
    removed: 'Position x 13.4 · y 9.0',
    added: ['Position x 8.0 · y 7.0', 'Walls unchanged'],
    checks: ['Valid stage geometry', 'Stage unchanged'],
  },
};

const writeLine = keyframes`
  0%, 12% { clip-path: inset(0 82% 0 0); opacity: .35; }
  42%, 78% { clip-path: inset(0 0 0 0); opacity: 1; }
  100% { clip-path: inset(0 82% 0 0); opacity: .35; }
`;

function DraftingMark() {
  const markRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');

  useEffect(() => {
    const mark = markRef.current;
    if (!mark || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(mark);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return <Box
    ref={markRef}
    aria-hidden="true"
    sx={{
      width: 28,
      height: 28,
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '3px',
      px: 0.75,
      borderRadius: 1,
      bgcolor: 'primary.light',
    }}
  >
    {[0, 1, 2].map((index) => <Box
      key={index}
      sx={{
        width: index === 2 ? '68%' : '100%',
        height: 2,
        borderRadius: 1,
        bgcolor: 'primary.main',
        animation: `${writeLine} 1.8s ${index * 180}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
        animationPlayState: inView && documentVisible ? 'running' : 'paused',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          clipPath: 'inset(0 0 0 0)',
          opacity: 1,
        },
      }}
    />)}
  </Box>;
}

function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return <Chip
    clickable
    label={label}
    onClick={onClick}
    sx={{
      minHeight: 40,
      bgcolor: 'action.hover',
      color: 'text.secondary',
      '&:hover, &:focus-visible': { bgcolor: 'primary.light', color: 'primary.main' },
      '@media (pointer: coarse)': { minHeight: 44 },
    }}
  />;
}

function PanelHeader({ title, detail, chip }: { title: string; detail?: string; chip?: ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ mb: panel.headerGap }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography component="h4" variant="h5" sx={{ mb: detail ? 0.5 : 0 }}>{title}</Typography>
      {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
    </Box>
    {chip}
  </Stack>;
}

function BoardLabel({ title, detail }: { title: string; detail: string }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, px: 0.25 }}>
    <Typography component="h3" variant="subtitle2" fontWeight={700}>{title}</Typography>
    <Typography variant="caption" color="text.secondary">{detail}</Typography>
  </Stack>;
}

function BuddyShell({ children, state, active }: {
  children: ReactNode;
  state: BuddyState;
  active: boolean;
}) {
  return <Box component="article" sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <BoardLabel title={stateLabels[state]} detail={state === 'working' ? 'In progress' : 'Ready'} />
    <Paper
      variant="outlined"
      sx={{
        minHeight: { xs: 'auto', sm: panelMinHeight },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2,
        borderColor: active ? 'primary.main' : 'divider',
        borderWidth: active ? 2 : 1,
        boxShadow: active ? (theme) => `0 14px 36px ${alpha(theme.palette.primary.main, 0.12)}` : 'none',
        transition: 'border-color 160ms ease-out, box-shadow 160ms ease-out',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minHeight: 64, px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main', borderRadius: 1.25 }}>
          <IconRobot size={21} aria-hidden="true" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h6" variant="h5" fontWeight={700} lineHeight={1.25}>FOSSBot Buddy</Typography>
        </Box>
      </Stack>
      {children}
    </Paper>
  </Box>;
}

function AskState({ surface, onSubmit }: { surface: Surface; onSubmit: () => void }) {
  const [draft, setDraft] = useState('');
  const prompts = surface === 'stage'
    ? ['Fix validation', 'Add a challenge', 'Improve layout']
    : surface === 'lesson'
      ? ['Make it clearer', 'Draft an activity', 'Check the lesson']
      : ['Fix my error', 'Explain this', 'Improve my work'];
  return <Stack sx={{ flex: 1, p: panel.inset }}>
    <PanelHeader title="What do you need?" />
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: panel.blockGap }}>
      {prompts.map((prompt) => <PromptChip key={prompt} label={prompt} onClick={() => setDraft(prompt)} />)}
    </Stack>
    <TextField
      multiline
      label="Ask about your work"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      sx={{
        flex: 1,
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        '& .MuiInputBase-root': { flex: 1 },
        // MUI renders every multiline field as a TextareaAutosize, which writes an inline
        // height the wrapper cannot beat without an override. The box owns the height here and
        // the textarea scrolls inside it, so the field can absorb taller sibling cards.
        '& textarea': { height: '100% !important', boxSizing: 'border-box', overflowY: 'auto !important' },
      }}
    />
    <Box sx={{ mt: 'auto', pt: panel.blockGap }}>
      <Button fullWidth variant="contained" size="large" endIcon={<IconArrowRight size={19} />} onClick={onSubmit} sx={{ minHeight: 48 }}>
        Ask Buddy
      </Button>
      <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.75} sx={{ mt: panel.actionStackGap, color: 'text.secondary' }}>
        <IconShieldCheck size={15} aria-hidden="true" />
        <Typography variant="caption">Nothing changes until you approve it</Typography>
      </Stack>
    </Box>
  </Stack>;
}

function WorkingState({ surface, onStop }: { surface: Surface; onStop: () => void }) {
  const [showSteps, setShowSteps] = useState(false);
  const stepsId = useId();
  const [done1, done2, live] = surfaceFixtures[surface].workingSteps;
  return <Stack sx={{ flex: 1, p: panel.inset }}>
    <PanelHeader title={`Checking your ${surfaceLabels[surface].toLowerCase()}`} detail="Finding the smallest useful next step." />
    <Box sx={{ mb: 4 }}>
      <Button
        size="small"
        onClick={() => setShowSteps((value) => !value)}
        aria-expanded={showSteps}
        aria-controls={stepsId}
        endIcon={<IconChevronDown size={15} />}
        sx={{
          mb: 1.5,
          px: 0,
          minWidth: 0,
          fontSize: '0.75rem',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
          '& .MuiButton-endIcon': { ml: 0.5, transition: 'transform 150ms ease-out', transform: showSteps ? 'rotate(180deg)' : 'none' },
          '@media (prefers-reduced-motion: reduce)': { '& .MuiButton-endIcon': { transition: 'none' } },
        }}
      >
        {showSteps ? 'Hide details' : 'Show details'}
      </Button>
      <Stack id={stepsId} spacing={2.25}>
        {showSteps && [done1, done2].map((label) => <Stack key={label} direction="row" spacing={1.25} alignItems="center">
          <Box sx={{ width: 28, height: 28, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'success.light', color: 'success.main' }}><IconCheck size={16} /></Box>
          <Typography variant="body2" fontWeight={500} color="text.secondary">{label}</Typography>
        </Stack>)}
        <Stack direction="row" spacing={1.25} alignItems="center">
          <DraftingMark />
          <Typography variant="body2" fontWeight={700}>{live}</Typography>
        </Stack>
      </Stack>
    </Box>
    <Box sx={{ mt: 'auto' }}>
      <Button fullWidth variant="contained" color="error" startIcon={<IconX size={18} />} onClick={onStop} sx={{ minHeight: 48 }}>Stop</Button>
    </Box>
  </Stack>;
}

function AnswerState({ surface, onFollowUp, onReview }: { surface: Surface; onFollowUp: () => void; onReview: () => void }) {
  const fixture = surfaceFixtures[surface];
  return <Stack sx={{ flex: 1 }}>
    <Box sx={{ flex: 1, p: panel.inset }}>
      <PanelHeader title={fixture.answerTitle} chip={<Chip size="small" color="secondary" label="AI-generated" />} />
      <Typography variant="body1" sx={{ mb: panel.blockGap }}>{fixture.answerBody}</Typography>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
          {fixture.suggestionIsCode ? <IconCode size={17} aria-hidden="true" /> : <IconWand size={17} aria-hidden="true" />}
          <Typography variant="caption" fontWeight={700}>{fixture.suggestionLabel}</Typography>
        </Stack>
        {fixture.suggestionIsCode
          ? <Box component="pre" sx={{ m: 0, p: 1.5, overflowX: 'auto', fontSize: 13, lineHeight: 1.65, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {fixture.suggestion.join('\n')}
          </Box>
          : <Box component="ol" sx={{ m: 0, py: 1.5, pl: 3.5, pr: 1.5, '& li': { mb: 0.75, '&:last-of-type': { mb: 0 } } }}>
            {fixture.suggestion.map((line) => <Typography component="li" key={line} variant="body2">{line}</Typography>)}
          </Box>}
      </Paper>
    </Box>
    <Box sx={{ p: panel.inset }}>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: panel.actionGap }}>
        <PromptChip label="Explain simpler" onClick={onFollowUp} />
        <PromptChip label="Show me why" onClick={onFollowUp} />
        <PromptChip label="Suggest change" onClick={onReview} />
      </Stack>
      <Button fullWidth variant="contained" endIcon={<IconArrowRight size={18} />} onClick={onFollowUp} sx={{ minHeight: 48 }}>Ask a follow-up</Button>
    </Box>
  </Stack>;
}

function ReviewState({ surface, onRevise, onDismiss }: { surface: Surface; onRevise: () => void; onDismiss: () => void }) {
  const [applied, setApplied] = useState(false);
  const fixture = surfaceFixtures[surface];
  return <Stack sx={{ flex: 1 }}>
    <Box sx={{ flex: 1, p: panel.inset }}>
      <PanelHeader
        title="Review the change"
        detail={`${fixture.added.length + 1} lines changed`}
        chip={<Chip icon={<IconShieldCheck size={16} />} color="success" label="Validated" size="small" />}
      />
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
        <Box sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight={700}>{fixture.reviewTarget}</Typography>
        </Box>
        <Box sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.7 }}>
          <Box sx={{ px: 1.5, color: 'error.main', bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) }}>− {fixture.removed}</Box>
          {fixture.added.map((line) => <Box key={line} sx={{ px: 1.5, color: 'success.main', bgcolor: (theme) => alpha(theme.palette.success.main, 0.1) }}>+ {line}</Box>)}
        </Box>
      </Paper>
      <Stack spacing={1.25} sx={{ mt: panel.blockGap }}>
        {fixture.checks.map((label) => <Stack key={label} direction="row" alignItems="center" spacing={1}>
          <IconCheck size={17} color="currentColor" />
          <Typography variant="body2">{label}</Typography>
        </Stack>)}
      </Stack>
    </Box>
    <Box sx={{ p: panel.inset }}>
      <Button fullWidth variant="contained" color={applied ? 'success' : 'primary'} startIcon={<IconCheck size={18} />} onClick={() => setApplied((value) => !value)} sx={{ minHeight: 48 }}>{applied ? 'Undo applied change' : 'Apply change'}</Button>
      <Stack direction="row" spacing={1} sx={{ mt: panel.actionStackGap }}>
        <Button fullWidth variant="outlined" startIcon={<IconWand size={17} />} onClick={onRevise} sx={{ minHeight: 44 }}>Revise</Button>
        <Button fullWidth color="error" startIcon={<IconTrash size={17} />} onClick={onDismiss} sx={{ minHeight: 44 }}>Dismiss</Button>
      </Stack>
    </Box>
  </Stack>;
}

function CompactState({ kind }: { kind: 'unavailable' | 'failed' | 'applied' }) {
  const [result, setResult] = useState<'idle' | 'primary' | 'secondary'>('idle');
  const idleConfig = {
    unavailable: { title: 'Buddy is unavailable', copy: 'Ask your teacher or administrator for access.', action: 'Check again', icon: <IconRobot size={20} /> },
    failed: { title: 'Buddy could not respond', copy: 'The provider timed out. Your work is unchanged.', action: 'Retry', icon: <IconRefresh size={20} /> },
    applied: { title: 'Change applied', copy: 'Saved in your undo history. It has not been run.', action: 'Run code', icon: <IconCheck size={20} /> },
  }[kind];
  const outcome = result === 'idle' ? null : {
    unavailable: { title: 'Still unavailable', copy: 'Access has not changed. Ask an administrator.' },
    failed: result === 'primary' ? { title: 'Trying again', copy: 'Reconnecting to the provider…' } : { title: 'Ready to report', copy: 'Include the provider and task. Do not include secrets.' },
    applied: result === 'primary' ? { title: 'Running code', copy: 'The simulator run was started.' } : { title: 'Change undone', copy: 'The previous workspace version was restored.' },
  }[kind];
  const config = { ...idleConfig, ...outcome };
  return <Paper variant="outlined" sx={{ p: panel.inset, borderRadius: 2, minWidth: 0 }}>
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 1.25, bgcolor: kind === 'failed' ? 'error.light' : kind === 'applied' ? 'success.light' : 'action.hover', color: kind === 'failed' ? 'error.main' : kind === 'applied' ? 'success.main' : 'text.secondary' }}>{config.icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>{config.title}</Typography>
        <Typography variant="body2" color="text.secondary">{config.copy}</Typography>
      </Box>
    </Stack>
    <Stack direction="row" spacing={1} sx={{ mt: panel.blockGap }}>
      {result === 'idle' ? <>
        <Button variant={kind === 'applied' ? 'contained' : 'outlined'} startIcon={kind === 'applied' ? <IconPlayerPlay size={17} /> : undefined} onClick={() => setResult('primary')} sx={{ minHeight: 44 }}>{idleConfig.action}</Button>
        {kind === 'applied' && <Button color="error" onClick={() => setResult('secondary')} sx={{ minHeight: 44 }}>Undo</Button>}
        {kind === 'failed' && <Button color="error" onClick={() => setResult('secondary')} sx={{ minHeight: 44 }}>Report</Button>}
      </> : <Button variant="outlined" onClick={() => setResult('idle')} sx={{ minHeight: 44 }}>Reset fixture</Button>}
    </Stack>
  </Paper>;
}

export default function BuddyComparison() {
  const [surface, setSurface] = useState<Surface>('python');
  const [focus, setFocus] = useState<Focus>('all');
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.customizer.activeMode === 'dark' ? 'dark' : 'light');
  const states = useMemo(() => (focus === 'all' ? ['ask', 'working', 'answer', 'review'] : [focus]) as BuddyState[], [focus]);

  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 6 }}>
    <Helmet><title>Buddy interface board</title></Helmet>
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: (theme) => alpha(theme.palette.background.default, 0.96), borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ maxWidth: 1760, mx: 'auto', px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: { lg: 'auto' } }}>
            <IconButton component={Link} to="/ui-comparison" aria-label="Back to UI comparison" sx={{ width: 44, height: 44 }}><IconArrowLeft size={21} /></IconButton>
            <Box>
              <Typography component="h1" variant="h5">Buddy interface board</Typography>
              <Typography variant="caption" color="text.secondary">Every state. One obvious next action.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <ToggleButtonGroup exclusive value={surface} onChange={(_, value) => value && setSurface(value)} size="small" aria-label="Buddy surface" sx={{ overflowX: 'auto', '& .MuiToggleButton-root': { minHeight: 44, px: 1.5, whiteSpace: 'nowrap' } }}>
              {(Object.keys(surfaceLabels) as Surface[]).map((value) => <ToggleButton key={value} value={value}>{surfaceLabels[value]}</ToggleButton>)}
            </ToggleButtonGroup>
            <ToggleButtonGroup exclusive value={mode} onChange={(_, value) => value && dispatch(setDarkMode(value))} size="small" aria-label="Color mode" sx={{ '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 } }}>
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Box>
    </Box>

    <Box component="main" sx={{ maxWidth: 1760, mx: 'auto', px: { xs: 2, md: 3 }, pt: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-end' }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography component="h2" variant="h3" sx={{ mb: 0.75 }}>Core flow</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 660 }}>Compose, wait, understand, approve. Each panel is a safe fixture and never calls a provider or changes workspace data.</Typography>
        </Box>
        <ToggleButtonGroup exclusive value={focus} onChange={(_, value) => value && setFocus(value)} size="small" aria-label="Visible Buddy states" sx={{ overflowX: 'auto', '& .MuiToggleButton-root': { minHeight: 44, px: 1.5, whiteSpace: 'nowrap' } }}>
          <ToggleButton value="all">All states</ToggleButton>
          {(Object.keys(stateLabels) as BuddyState[]).map((value) => <ToggleButton key={value} value={value}>{stateLabels[value]}</ToggleButton>)}
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: focus === 'all' ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } : { xs: '1fr', sm: 'minmax(360px, 460px)' },
        justifyContent: focus === 'all' ? 'stretch' : 'center',
        gap: { xs: 3, md: 2 },
      }}>
        {states.map((state) => <BuddyShell key={state} state={state} active={focus === state}>
          {state === 'ask' && <AskState surface={surface} onSubmit={() => setFocus('working')} />}
          {state === 'working' && <WorkingState surface={surface} onStop={() => setFocus('ask')} />}
          {state === 'answer' && <AnswerState surface={surface} onFollowUp={() => setFocus('ask')} onReview={() => setFocus('review')} />}
          {state === 'review' && <ReviewState surface={surface} onRevise={() => setFocus('ask')} onDismiss={() => setFocus('answer')} />}
        </BuddyShell>)}
      </Box>

      {focus !== 'all' && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button onClick={() => setFocus('all')} endIcon={<IconChevronDown size={18} />} sx={{ minHeight: 44 }}>Show all states</Button>
      </Box>}

      <Divider sx={{ my: { xs: 4, md: 5 } }} />

      <Box sx={{ mb: 2.5 }}>
        <Typography component="h2" variant="h3" sx={{ mb: 0.75 }}>Recovery and completion</Typography>
        <Typography color="text.secondary">Short states keep the recovery action close to the problem.</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        <CompactState kind="unavailable" />
        <CompactState kind="failed" />
        <CompactState kind="applied" />
      </Box>
    </Box>
  </Box>;
}
