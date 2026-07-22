import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from 'src/authentication/AuthProvider';
import { resolveStageAssetUrl, stageAssetBaseUrlFromStageUrl } from 'src/simulator/stages/assets';
import { getMarketplaceIndex, type MarketplaceStageEntry } from 'src/stages/MarketplaceApi';
import { listProviderStages, loadStageFromProvider, type ProviderStageListItem } from 'src/stages/StagesApi';

export type StageSelectionSource = 'default' | 'github' | 'marketplace';

export interface StageSelection {
  sourceType: StageSelectionSource;
  title: string;
  url?: string;
  repoOwner?: string;
  repoName?: string;
  visibility?: string | null;
  marketplaceEntryPath?: string | null;
  commitSha?: string | null;
}

interface DefaultStageOption {
  title: string;
  description: string;
  image: string;
  url: string;
}

interface CardDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void | Promise<void>;
  onSelectStage?: (stage: StageSelection) => void | Promise<void>;
}

const defaultStages: DefaultStageOption[] = [
  {
    title: 'White Tiles',
    description: 'Good stage to start using the robot, especially the commands that make the robot move in default steps.',
    image: '/js-simulator/stages/white_tiles.png',
    url: '/js-simulator/stages/stage_white_rect.json',
  },
  {
    title: 'Objects on the floor',
    description: 'This stage can be used for obstacle avoidance and object detection exercises.',
    image: '/js-simulator/stages/stage_object.png',
    url: '/js-simulator/stages/stage_object.json',
  },
  {
    title: 'Maze',
    description: 'A simple maze, good for navigation exercises.',
    image: '/js-simulator/stages/stage_maze.png',
    url: '/js-simulator/stages/stage_maze.json',
  },
  {
    title: 'Colors on the floor',
    description: 'An exercise to help kids learn the colors.',
    image: '/js-simulator/stages/stage_colors.png',
    url: '/js-simulator/stages/stage_numbers.json',
  },
  {
    title: 'The Eiffel tower',
    description: 'An example of using 3D models within the simulator.',
    image: '/js-simulator/stages/stage_eiffel.png',
    url: '/js-simulator/stages/stage_eiffel.json',
  },
  {
    title: 'The farm',
    description: "Let's learn about the animals.",
    image: '/js-simulator/stages/stage_animals.png',
    url: '/js-simulator/stages/stage_animals.json',
  },
  {
    title: 'White paper',
    description: 'A stage with a white floor, perfect for drawing.',
    image: '/js-simulator/stages/stage_white_paper.png',
    url: '/js-simulator/stages/stage_white_paper.json',
  },
];

function marketplaceEntryPath(entry: MarketplaceStageEntry): string {
  return `stages/${entry.repoOwner}/${entry.repoName}.json`;
}

function githubRawStageUrl(stage: ProviderStageListItem): string {
  return `https://raw.githubusercontent.com/${stage.repoOwner}/${stage.repoName}/${stage.defaultBranch || 'main'}/stage.json`;
}

function resolveStageEntryAssets(entry: any, stageUrl: string): any {
  if (!entry || typeof entry !== 'object') return entry;
  const stageAssetBaseUrl = stageAssetBaseUrlFromStageUrl(stageUrl);
  const resolve = (value: unknown) => (
    typeof value === 'string'
      ? resolveStageAssetUrl(value, { stageAssetBaseUrl })
      : value
  );
  const next = { ...entry };
  next.filename = resolve(next.filename);
  next.texture = resolve(next.texture);
  next.source = resolve(next.source);
  if (next.collision && typeof next.collision === 'object') {
    next.collision = { ...next.collision, source: resolve(next.collision.source) };
  }
  return next;
}

async function legacySimulatorStageUrl(stageUrl: string): Promise<string> {
  const response = await fetch(stageUrl);
  if (!response.ok) throw new Error(`Could not load stage JSON: HTTP ${response.status}`);
  const payload = await response.json();
  const config = Array.isArray(payload) ? payload : payload?.config;
  if (!Array.isArray(config)) throw new Error('Stage JSON does not contain a simulator config array.');
  const resolvedConfig = config.map((entry) => resolveStageEntryAssets(entry, stageUrl));
  return URL.createObjectURL(new Blob([JSON.stringify(resolvedConfig)], { type: 'application/json' }));
}

function emitStageSelection(stage: StageSelection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StageSelection>('fossbot:stage-selected', { detail: stage }));
}

function StageCard({
  title,
  description,
  image,
  badges,
  disabled,
  disabledReason,
  onSelect,
}: {
  title: string;
  description?: string | null;
  image?: string | null;
  badges?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void | Promise<void>;
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {image ? (
        <CardMedia component="img" height="140" image={image} alt={title} />
      ) : (
        <Box sx={{ height: 140, display: 'grid', placeItems: 'center', bgcolor: 'grey.100', color: 'text.secondary' }}>
          <Typography variant="subtitle2" fontWeight={800}>FOSSBot stage</Typography>
        </Box>
      )}
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography gutterBottom variant="h5" component="div" sx={{ mb: 0, flex: 1 }}>{title}</Typography>
          {badges}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {description || 'No description provided.'}
        </Typography>
        {disabled && disabledReason && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {disabledReason}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ mt: 'auto' }}>
        <Button size="small" color="primary" disabled={disabled} onClick={onSelect}>Select</Button>
      </CardActions>
    </Card>
  );
}

const CardDialog: React.FC<CardDialogProps> = ({ open, onClose, onSelect, onSelectStage }) => {
  const { token } = useAuth();
  const [tab, setTab] = useState<StageSelectionSource>('default');
  const [userStages, setUserStages] = useState<ProviderStageListItem[]>([]);
  const [marketplaceStages, setMarketplaceStages] = useState<MarketplaceStageEntry[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [marketplaceError, setMarketplaceError] = useState('');
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('default');
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setUserLoading(true);
    setUserError('');
    listProviderStages(token)
      .then((stages) => { if (!cancelled) setUserStages(stages); })
      .catch((error) => { if (!cancelled) setUserError(error instanceof Error ? error.message : 'Could not load your GitHub stages.'); })
      .finally(() => { if (!cancelled) setUserLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMarketplaceLoading(true);
    setMarketplaceError('');
    getMarketplaceIndex({ page: 1, pageSize: 48, sort: 'verified' })
      .then((payload) => { if (!cancelled) setMarketplaceStages(payload.stages || []); })
      .catch((error) => { if (!cancelled) setMarketplaceError(error instanceof Error ? error.message : 'Could not load marketplace stages.'); })
      .finally(() => { if (!cancelled) setMarketplaceLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const tabCounts = useMemo(() => ({
    default: defaultStages.length,
    github: userStages.length,
    marketplace: marketplaceStages.length,
  }), [marketplaceStages.length, userStages.length]);

  const handleDefaultSelect = async (stage: DefaultStageOption) => {
    const selection = { sourceType: 'default' as const, title: stage.title, url: stage.url };
    emitStageSelection(selection);
    if (onSelectStage) await onSelectStage(selection);
    await onSelect(stage.url);
    onClose();
  };

  const handleUserSelect = async (stage: ProviderStageListItem) => {
    const stageUrl = githubRawStageUrl(stage);
    const selection = {
      sourceType: 'github' as const,
      title: stage.title || stage.repoName,
      url: stage.private ? stage.repoUrl : stageUrl,
      repoOwner: stage.repoOwner,
      repoName: stage.repoName,
      visibility: stage.visibility || (stage.private ? 'private' : 'public'),
    };
    emitStageSelection(selection);
    if (onSelectStage) {
      await onSelectStage(selection);
    } else {
      try {
        if (stage.private && token) {
          // Private repos can't use raw.githubusercontent.com; load via backend API
          const loaded = await loadStageFromProvider(token, stage.repoOwner, stage.repoName);
          const blob = new Blob([JSON.stringify(loaded.record.config)], { type: 'application/json' });
          await onSelect(URL.createObjectURL(blob));
        } else {
          await onSelect(await legacySimulatorStageUrl(stageUrl));
        }
      } catch (error) {
        setUserError(error instanceof Error ? error.message : 'Could not prepare this GitHub stage for the simulator.');
        return;
      }
    }
    onClose();
  };

  const handleMarketplaceSelect = async (stage: MarketplaceStageEntry) => {
    const stageUrl = `https://raw.githubusercontent.com/${stage.repoOwner}/${stage.repoName}/${stage.defaultBranch || 'main'}/stage.json`;
    const selection = {
      sourceType: 'marketplace' as const,
      title: stage.title,
      url: stageUrl,
      repoOwner: stage.repoOwner,
      repoName: stage.repoName,
      visibility: 'public',
      marketplaceEntryPath: marketplaceEntryPath(stage),
      commitSha: stage.commitSha,
    };
    emitStageSelection(selection);
    if (onSelectStage) {
      await onSelectStage(selection);
    } else {
      try {
        await onSelect(await legacySimulatorStageUrl(stageUrl));
      } catch (error) {
        setMarketplaceError(error instanceof Error ? error.message : 'Could not prepare this marketplace stage for the simulator.');
        return;
      }
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={selecting ? undefined : onClose} maxWidth="lg" fullWidth sx={{ '& .MuiDialog-container': { position: 'relative' } }}>
      <DialogTitle>Select a stage</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="default" label={`Defaults (${tabCounts.default})`} />
          <Tab value="github" label={`User (${tabCounts.github})`} />
          <Tab value="marketplace" label={`Marketplace (${tabCounts.marketplace})`} />
        </Tabs>

        {tab === 'default' && (
          <Grid container spacing={2}>
            {defaultStages.map((stage) => (
              <Grid key={stage.url} item xs={12} sm={6} md={3}>
                <StageCard {...stage} onSelect={() => handleDefaultSelect(stage)} />
              </Grid>
            ))}
          </Grid>
        )}

        {tab === 'github' && (
          <Stack spacing={2}>
            {!token && (
              <Alert severity="info" icon={<GitHubIcon fontSize="inherit" />}>
                Sign in and connect GitHub to choose one of your FOSSBot stage repositories. Lectures may use public or private GitHub stages.
              </Alert>
            )}
            {userError && <Alert severity="error">{userError}</Alert>}
            {userLoading ? (
              <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><Typography>Loading your GitHub stages…</Typography></Stack>
            ) : userStages.length ? (
              <Grid container spacing={2}>
                {userStages.map((stage) => (
                    <Grid key={`${stage.repoOwner}/${stage.repoName}`} item xs={12} sm={6} md={3}>
                      <StageCard
                        title={stage.title || stage.repoName}
                        description={stage.description || `${stage.repoOwner}/${stage.repoName}`}
                        badges={<Chip size="small" label={stage.private ? 'Private' : 'Public'} color={stage.private ? 'warning' : 'success'} variant="outlined" />}
                        onSelect={() => handleUserSelect(stage)}
                      />
                    </Grid>
                ))}
              </Grid>
            ) : token ? (
              <Alert severity="info">No installed FOSSBot stage repositories were found.</Alert>
            ) : null}
          </Stack>
        )}

        {tab === 'marketplace' && (
          <Stack spacing={2}>
            {marketplaceError && <Alert severity="error">{marketplaceError}</Alert>}
            {marketplaceLoading ? (
              <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={20} /><Typography>Loading marketplace stages…</Typography></Stack>
            ) : marketplaceStages.length ? (
              <Grid container spacing={2}>
                {marketplaceStages.map((stage) => (
                  <Grid key={`${stage.repoOwner}/${stage.repoName}`} item xs={12} sm={6} md={3}>
                    <StageCard
                      title={stage.title}
                      description={stage.description || `${stage.repoOwner}/${stage.repoName}`}
                      image={stage.previewUrl}
                      badges={<Chip size="small" icon={<PublicIcon />} label={stage.badges?.verified ? 'Verified' : 'Published'} color={stage.badges?.verified ? 'primary' : 'default'} variant="outlined" />}
                      onSelect={() => handleMarketplaceSelect(stage)}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Alert severity="info">No published marketplace stages were found.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      {selecting && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            bgcolor: 'rgba(255,255,255,0.85)',
            zIndex: 1300,
            borderRadius: 1,
          }}
        >
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">Loading stage…</Typography>
        </Box>
      )}
    </Dialog>
  );
};

export default CardDialog;
